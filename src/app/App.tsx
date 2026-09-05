import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { CompileClient, type CompileOutput, type Status } from '../compile/client';
import { PageRenderer } from '../compile/render';
import type { Diagnostic } from '../compile/protocol';
import { Editor } from '../editor/Editor';
import { addBlob, addTextFile, filesMap, isTextPath, meta, normalizePath, removeFile, renameFile, saveLocal, snapshot, textOf, projectMap } from '../project/model';
import { pendingImport, useProject, useRoute } from './useProject';
import { loadIdentity, shortAddress } from '../collab/identity';
import { colorFor } from '../editor/remote-cursors';
import { PUBLIC_READ_GATEWAY, beeHealth, uploadBytes } from '../swarm/bee';
import { createGenesis } from '../collab/genesis';
import { loadSettings, saveSettings, type Settings } from './settings';
import { Preview } from './Preview';

const STARTER = `#set page(paper: "a4")
#set text(size: 11pt)

= Hello from swarmtyp

Typst, compiled in your browser, living on Swarm. Edit on the left; the preview follows.
The default fonts (Libertinus Serif, New Computer Modern Math, DejaVu Sans Mono) load from Swarm as the document needs them.

$ integral_0^1 x^2 dif x = 1/3 $

#import "@preview/oxifmt:1.0.0": strfmt
Packages come from the Swarm mirror when they are on it: #strfmt("{:04}", 42). \`raw text\` uses the mono face.
`;

function useForceUpdate() { const [, set] = useState(0); return useCallback(() => set((n) => n + 1), []); }

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const route = useRoute();
  const project = useProject(route, settings, STARTER);
  const doc = project.doc;
  const identity = useMemo(() => loadIdentity(), []);
  const [status, setStatus] = useState<Status>({ state: 'loading', stage: 'starting' });
  const [bee, setBee] = useState<{ ok: boolean; version?: string } | null>(null);
  const [readSource, setReadSource] = useState<'node' | 'gateway' | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [compileMs, setCompileMs] = useState<number | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [packages, setPackages] = useState<{ key: string; source: string }[]>([]);
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [active, setActive] = useState('/main.typ');
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const clientRef = useRef<CompileClient | null>(null);
  const rendererRef = useRef<PageRenderer | null>(null);
  const [rendererReady, setRendererReady] = useState(false);
  const lastArtifact = useRef<Uint8Array | null>(null);
  const bump = useForceUpdate();

  // Re-render on document changes (files map, project map, texts).
  useEffect(() => {
    if (!doc) return;
    const onUpdate = () => bump();
    doc.on('update', onUpdate); filesMap(doc).observe(bump); projectMap(doc).observe(bump);
    return () => { doc.off('update', onUpdate); filesMap(doc).unobserve(bump); projectMap(doc).unobserve(bump); };
  }, [doc, bump]);

  // Compiler worker and renderer.
  useEffect(() => {
    let client: CompileClient | null = null; let cancelled = false;
    const renderer = new PageRenderer();
    renderer.init().then(() => { rendererRef.current = renderer; setRendererReady(true); }).catch((e) => setStatus({ state: 'error', message: 'renderer: ' + e.message }));
    // Reads (fonts, packages, blobs) come from the configured node when it answers, else from the public read gateway
    // (D-25): a browser opening the app from a gateway or with no node still compiles; writes keep needing a node.
    beeHealth(settings.beeUrl).then((h) => {
      if (cancelled) return;
      setBee(h);
      const readUrl = h.ok ? settings.beeUrl : PUBLIC_READ_GATEWAY;
      setReadSource(h.ok ? 'node' : 'gateway');
      client = new CompileClient({ beeUrl: readUrl, allowFallback: settings.allowFallback });
      client.onStatus = setStatus; setStatus(client.status); client.onActivity = setActivity;
      clientRef.current = client;
    });
    return () => { cancelled = true; client?.terminate(); clientRef.current = null; renderer.destroy(); rendererRef.current = null; setRendererReady(false); };
  }, [settings.beeUrl, settings.allowFallback]);

  // Compile on change, debounced; drop stale results; persist locally.
  useEffect(() => {
    if (!doc) return;
    const d = doc;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = async () => {
      const client = clientRef.current; if (!client || client.status.state !== 'ready') return;
      setCompiling(true);
      try { const out = await client.compile(snapshot(d)); if (out) apply(out); } finally { setCompiling(false); }
    };
    const apply = (out: CompileOutput) => {
      setDiagnostics(out.diagnostics); setCompileMs(out.ms); if (out.packages.length) setPackages((p) => [...p, ...out.packages]);
      if (out.artifact && rendererRef.current) { lastArtifact.current = out.artifact; rendererRef.current.setArtifact(out.artifact); setArtifactVersion((v) => v + 1); }
    };
    const schedule = (_u: Uint8Array, origin: unknown) => { if (origin !== 'remote' && origin !== 'swarm-rtc' && route.kind === 'project') lastLocalEdit.current = Date.now(); /* library origins mark peers' updates */ if (timer) clearTimeout(timer); timer = setTimeout(() => { if (route.kind === 'local') saveLocal(d); void run(); }, 200); };
    d.on('update', schedule);
    if (status.state === 'ready' && rendererReady) schedule(new Uint8Array(), 'remote');
    return () => { d.off('update', schedule); if (timer) clearTimeout(timer); };
  }, [doc, status.state, rendererReady, route.kind]);

  // A snapshot reaches Swarm about 0.5–3 s after the last keystroke (library debounce, then the feed write). Leaving in
  // that window keeps the edit only in this browser (e2e/collab.spec.ts found this), so ask before unloading.
  const lastLocalEdit = useRef(0);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (Date.now() - lastLocalEdit.current < 4000) { e.preventDefault(); e.returnValue = ''; } };
    addEventListener('beforeunload', guard);
    return () => removeEventListener('beforeunload', guard);
  }, []);

  const share = async () => {
    if (!doc) return;
    if (!settings.stamp) { alert('Sharing creates the project on Swarm and needs a postage batch id: set one in Settings.'); return; }
    setBusy('creating project on Swarm…');
    try {
      const name = meta(doc).name;
      const { id } = await createGenesis(settings.beeUrl, settings.stamp, { name, mainFile: meta(doc).mainFile, creator: identity.address });
      pendingImport.update = Y.encodeStateAsUpdate(doc); pendingImport.name = name;
      location.hash = `#/p/${id}`;
    } catch (e) { alert(String((e as Error).message)); } finally { setBusy(null); }
  };
  const projectLink = route.kind === 'project' ? `${location.origin}${location.pathname}#/p/${route.id}` : null;

  if (!doc || project.phase !== 'ready') return <div className="app"><header className="topbar"><strong>swarmtyp</strong><span className="status">{project.error ? `could not open project: ${project.error}` : project.phase === 'waiting' ? 'waiting for the document: no member\u2019s snapshot has arrived yet (the person who shared the link must have opened it at least once)' : route.kind === 'project' ? 'opening project: reading snapshots from Swarm…' : 'opening…'}</span></header></div>;
  const files = Array.from(filesMap(doc).entries()).sort(([a], [b]) => a.localeCompare(b));
  const m = meta(doc);
  const activeEntry = filesMap(doc).get(active);
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;

  const onUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    if (!settings.stamp) { alert('Set a postage batch id in Settings to upload files.'); return; }
    for (const f of Array.from(fileList)) {
      const path = normalizePath(f.name);
      if (isTextPath(path)) { addTextFile(doc, path, await f.text()); continue; }
      setBusy(`uploading ${f.name}…`);
      try { const ref = await uploadBytes(settings.beeUrl, settings.stamp, f, f.type || 'application/octet-stream'); addBlob(doc, path, ref, f.type, f.size); }
      catch (e) { alert(String((e as Error).message)); } finally { setBusy(null); }
    }
  };
  const exportPdf = async () => {
    const client = clientRef.current; if (!client) return;
    setBusy('exporting PDF…');
    try {
      const out = await client.compile({ ...snapshot(doc), format: 'pdf' });
      if (!out?.artifact) { alert('PDF export failed: ' + (out?.diagnostics[0]?.message ?? 'no output')); return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.artifact as BlobPart], { type: 'application/pdf' })); a.download = `${m.name.replace(/[^\w.-]+/g, '_') || 'document'}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } finally { setBusy(null); }
  };
  const newFile = () => { const name = prompt('New file path (e.g. chapters/one.typ)'); if (!name) return; setActive(addTextFile(doc, name, isTextPath(name) ? '' : '')); };
  const setMain = (path: string) => projectMap(doc).set('mainFile', path);

  return (
    <div className="app">
      <header className="topbar">
        <strong>swarmtyp</strong>
        <input className="project-name" value={m.name} onChange={(e) => projectMap(doc).set('name', e.target.value)} />
        <span className="status">{compiling ? 'compiling…' + (activity ? ` fetching ${activity}` : '') : statusText(status, compileMs, errors, warnings)}</span>
        {busy && <span className="status">{busy}</span>}
        <span className="spacer" />
        <label className="zoom">Zoom <input type="range" min={0.5} max={2.5} step={0.1} value={settings.zoom} onChange={(e) => { const s = { ...settings, zoom: Number(e.target.value) }; setSettings(s); saveSettings(s); }} /> {Math.round(settings.zoom * 100)}%</label>
        {route.kind === 'project' && (
          <span className="members" title="People in this project (session addresses; the same person in two tabs shows twice)">
            <span className="member me" style={{ borderColor: colorFor(project.session?.signer.address ?? '') }}>{settings.nickname || 'anonymous'} (you)</span>
            {project.members.filter((p) => p.address !== project.session?.signer.address).map((p) => <span key={p.address} className={p.connected ? 'member connected' : 'member'} style={{ borderColor: colorFor(p.address) }} title={`${p.address}\n${p.connected ? 'direct connection: edits arrive live' : 'no direct connection yet: edits arrive as snapshots from Swarm'}`}>{p.name} <small>{shortAddress(p.address)}</small></span>)}
          </span>
        )}
        {route.kind === 'local'
          ? <button onClick={share} title="Create the project on Swarm and get a link others can open">Share…</button>
          : <>
              <button onClick={() => { if (projectLink) { void navigator.clipboard?.writeText(projectLink); alert(`Project link copied. Anyone with it can read and write (T1).\n${projectLink}`); } }}>Copy link</button>
              <button className="leave" title="Remove this project's copy from this browser; the project stays on Swarm for everyone with the link" onClick={() => { if (confirm('Leave this project? Its copy on this device is deleted. The project stays on Swarm and you can open the link again later.')) { const s = project.session; void (s ? s.leave() : Promise.resolve()).finally(() => { location.hash = ''; }); } }}>Leave</button>
            </>}
        <button onClick={exportPdf} disabled={status.state !== 'ready'}>Export PDF</button>
        <button onClick={() => setShowSettings((v) => !v)} aria-label="Settings">⚙</button>
      </header>
      {readSource === 'gateway' && route.kind === 'local' && <div className="banner">No Bee node answers at {settings.beeUrl}: fonts and packages come from the public read gateway, so you can write and export. Uploading images and sharing a project need a node with a postage batch (⚙ Settings).</div>}
      {project.error && <div className="banner">Swarm write failed: {project.error}. Your edits stay in this browser; check the postage batch in Settings (T7).</div>}
      <div className="body">
        <aside className="files">
          <div className="files-head"><span>Files</span><button onClick={newFile} title="New text file">+</button><label className="upload" title="Upload file (images and fonts go to Swarm as blobs)">↑<input type="file" multiple hidden onChange={(e) => void onUpload(e.target.files)} /></label></div>
          <ul>
            {files.map(([path, e]) => (
              <li key={path} className={path === active ? 'active' : ''}>
                <button className="file" onClick={() => setActive(path)} title={e.kind === 'blob' ? `${e.mime} ${e.size} bytes, ${e.ref.slice(0, 8)}…` : path}>{path === m.mainFile ? '● ' : ''}{path.slice(1)}{e.kind === 'blob' ? ' ◆' : ''}</button>
                <span className="file-actions">
                  {e.kind === 'text' && path !== m.mainFile && <button title="Set as main file" onClick={() => setMain(path)}>main</button>}
                  <button title="Rename" onClick={() => { const to = prompt('Rename to', path.slice(1)); if (to && normalizePath(to) !== path) { renameFile(doc, path, to); if (active === path) setActive(normalizePath(to)); } }}>✎</button>
                  <button title="Delete" onClick={() => { if (confirm(`Delete ${path}?`)) { removeFile(doc, path); if (active === path) setActive(m.mainFile); } }}>×</button>
                </span>
              </li>
            ))}
          </ul>
          <div className="problems">
            <div className="files-head"><span>Problems</span><span>{errors} errors, {warnings} warnings</span></div>
            <ul>{diagnostics.filter((d) => d.severity !== 'hint').map((d, i) => <li key={i} className={d.severity}><button className="file" onClick={() => { if (filesMap(doc).has(d.path)) setActive(d.path); }}>{d.path.slice(1)}:{d.range.split('-')[0]} {d.message}</button></li>)}</ul>
            {packages.length > 0 && <div className="packages">Packages: {Array.from(new Map(packages.map((p) => [p.key, p.source])).entries()).map(([k, s]) => <span key={k} title={`served from ${s}`}>{k.replace('preview/', '@preview/')} ({s})</span>)}</div>}
          </div>
        </aside>
        <main className="editor">
          {activeEntry?.kind === 'text' ? <Editor key={active} ytext={textOf(doc, active)} path={active} diagnostics={diagnostics} cursors={project.cursors} onSelection={(a, h) => project.session?.updateCursor(a, h)} />
            : activeEntry?.kind === 'blob' ? <div className="blob-view"><p>{active.slice(1)} is a binary file on Swarm.</p><code>{activeEntry.ref}</code><p>{activeEntry.mime}, {activeEntry.size} bytes. Use it as <code>image("{active.slice(1)}")</code>.</p>{activeEntry.mime.startsWith('image/') && <img alt="" src={`${settings.beeUrl}/bytes/${activeEntry.ref}`} />}</div>
            : <div className="blob-view">Select a file</div>}
        </main>
        <Preview renderer={rendererReady ? rendererRef.current : null} version={artifactVersion} zoom={settings.zoom} />
      </div>
      {showSettings && (
        <div className="settings">
          <h2>Settings</h2>
          <label>Your name (shown to collaborators) <input value={settings.nickname} onChange={(e) => setSettings({ ...settings, nickname: e.target.value })} onBlur={() => saveSettings(settings)} placeholder="anonymous" /></label>
          <div className="hint">Identity address {shortAddress(identity.address)} (this device; each tab signs with its own sub-key). The key sits in this browser's storage for this origin: on a local node or a path-based gateway other Swarm apps opened at the same address can read it (T14); Freedom Browser isolates it. <button onClick={() => { void navigator.clipboard?.writeText(localStorage.getItem('swarmtyp:identity') || ''); alert('Identity key copied. Keep it secret; paste it into another device to be the same person there.'); }}>Copy identity key</button> <button onClick={() => { const k = prompt('Paste an identity key (64 hex characters)'); if (k) { try { import('../collab/identity').then(({ importIdentity }) => { importIdentity(k); location.reload(); }); } catch (e) { alert(String((e as Error).message)); } } }}>Import…</button></div>
          {projectLink && <div className="hint">Project link: <code>{projectLink}</code></div>}
          <label>Bee node URL <input value={settings.beeUrl} onChange={(e) => setSettings({ ...settings, beeUrl: e.target.value })} onBlur={() => saveSettings(settings)} /></label>
          <div className="hint">{bee === null ? 'checking…' : bee.ok ? `connected, Bee ${bee.version}` : `not reachable; fonts, packages and images are read from ${PUBLIC_READ_GATEWAY} instead, uploads and sharing need a node`}</div>
          <label>Postage batch id (for uploads) <input value={settings.stamp} onChange={(e) => setSettings({ ...settings, stamp: e.target.value.trim() })} onBlur={() => saveSettings(settings)} placeholder="64 hex characters, an immutable batch on your node" /></label>
          <label>STUN server (for direct connections between collaborators, D-15) <input value={settings.stun} onChange={(e) => setSettings({ ...settings, stun: e.target.value })} onBlur={() => saveSettings(settings)} /></label>
          <label><input type="checkbox" checked={settings.allowFallback} onChange={(e) => { const s = { ...settings, allowFallback: e.target.checked }; setSettings(s); saveSettings(s); }} /> Fetch missing packages from packages.typst.org (D-08; leaks which packages you use)</label>
          <div className="hint">Compiler: Typst {m.typstVersion} via typst.ts 0.7.0. Project created {m.created ? new Date(m.created).toLocaleString() : '—'}. Everything you upload is public and permanent on Swarm (T10).</div>
          <button onClick={() => setShowSettings(false)}>Close</button>
        </div>
      )}
    </div>
  );
}

function statusText(s: Status, ms: number | null, errors: number, warnings: number) {
  if (s.state === 'loading') return s.total ? `loading ${s.stage} ${Math.round((s.done ?? 0) / s.total * 100)}%` : `loading ${s.stage}…`;
  if (s.state === 'error') return `compiler failed: ${s.message}`;
  return ms === null ? 'compiler ready' : `compiled in ${ms} ms` + (errors ? `, ${errors} error${errors > 1 ? 's' : ''}` : '') + (warnings ? `, ${warnings} warning${warnings > 1 ? 's' : ''}` : '');
}
