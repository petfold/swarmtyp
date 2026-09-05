import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { CompileClient, type CompileOutput, type Status } from '../compile/client';
import { PageRenderer } from '../compile/render';
import type { Diagnostic } from '../compile/protocol';
import { Editor } from '../editor/Editor';
import { addBlob, addTextFile, filesMap, initProject, isTextPath, loadLocal, meta, normalizePath, removeFile, renameFile, saveLocal, snapshot, textOf, projectMap } from '../project/model';
import { beeHealth, uploadBytes } from '../swarm/bee';
import { loadSettings, saveSettings, type Settings } from './settings';
import { Preview } from './Preview';

const STARTER = `#set page(paper: "a4")
#set text(font: "DejaVu Serif", size: 11pt)
#show math.equation: set text(font: "DejaVu Math TeX Gyre")

= Hello from swarmtyp

Typst, compiled in your browser, living on Swarm. Edit on the left; the preview follows.

$ integral_0^1 x^2 dif x = 1/3 $
`;

function useForceUpdate() { const [, set] = useState(0); return useCallback(() => set((n) => n + 1), []); }

export function App() {
  const doc = useMemo(() => new Y.Doc(), []);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [status, setStatus] = useState<Status>({ state: 'loading', stage: 'starting' });
  const [bee, setBee] = useState<{ ok: boolean; version?: string } | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [compileMs, setCompileMs] = useState<number | null>(null);
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

  // Project: restore from this device, or create the starter.
  useEffect(() => {
    if (!loadLocal(doc)) initProject(doc, 'My first document', STARTER);
    const onUpdate = () => { bump(); };
    doc.on('update', onUpdate);
    filesMap(doc).observe(bump); projectMap(doc).observe(bump);
    return () => { doc.off('update', onUpdate); };
  }, [doc, bump]);

  // Compiler worker and renderer.
  useEffect(() => {
    const client = new CompileClient({ beeUrl: settings.beeUrl, allowFallback: settings.allowFallback });
    client.onStatus = setStatus; setStatus(client.status);
    clientRef.current = client;
    const renderer = new PageRenderer();
    renderer.init().then(() => { rendererRef.current = renderer; setRendererReady(true); }).catch((e) => setStatus({ state: 'error', message: 'renderer: ' + e.message }));
    beeHealth(settings.beeUrl).then(setBee);
    return () => { client.terminate(); renderer.destroy(); rendererRef.current = null; setRendererReady(false); };
  }, [settings.beeUrl, settings.allowFallback]);

  // Compile on change, debounced; drop stale results; persist locally.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = async () => {
      const client = clientRef.current; if (!client || client.status.state !== 'ready') return;
      const out = await client.compile(snapshot(doc));
      if (!out) return; // superseded
      apply(out);
    };
    const apply = (out: CompileOutput) => {
      setDiagnostics(out.diagnostics); setCompileMs(out.ms); if (out.packages.length) setPackages((p) => [...p, ...out.packages]);
      if (out.artifact && rendererRef.current) { lastArtifact.current = out.artifact; rendererRef.current.setArtifact(out.artifact); setArtifactVersion((v) => v + 1); }
    };
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { saveLocal(doc); void run(); }, 200); };
    doc.on('update', schedule);
    if (status.state === 'ready' && rendererReady) schedule();
    return () => { doc.off('update', schedule); if (timer) clearTimeout(timer); };
  }, [doc, status.state, rendererReady]);

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
        <span className="status">{statusText(status, compileMs, errors, warnings)}</span>
        {busy && <span className="status">{busy}</span>}
        <span className="spacer" />
        <label className="zoom">Zoom <input type="range" min={0.5} max={2.5} step={0.1} value={settings.zoom} onChange={(e) => { const s = { ...settings, zoom: Number(e.target.value) }; setSettings(s); saveSettings(s); }} /> {Math.round(settings.zoom * 100)}%</label>
        <button onClick={exportPdf} disabled={status.state !== 'ready'}>Export PDF</button>
        <button onClick={() => setShowSettings((v) => !v)} aria-label="Settings">⚙</button>
      </header>
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
          {activeEntry?.kind === 'text' ? <Editor key={active} ytext={textOf(doc, active)} path={active} diagnostics={diagnostics} />
            : activeEntry?.kind === 'blob' ? <div className="blob-view"><p>{active.slice(1)} is a binary file on Swarm.</p><code>{activeEntry.ref}</code><p>{activeEntry.mime}, {activeEntry.size} bytes. Use it as <code>image("{active.slice(1)}")</code>.</p>{activeEntry.mime.startsWith('image/') && <img alt="" src={`${settings.beeUrl}/bytes/${activeEntry.ref}`} />}</div>
            : <div className="blob-view">Select a file</div>}
        </main>
        <Preview renderer={rendererReady ? rendererRef.current : null} version={artifactVersion} zoom={settings.zoom} />
      </div>
      {showSettings && (
        <div className="settings">
          <h2>Settings</h2>
          <label>Bee node URL <input value={settings.beeUrl} onChange={(e) => setSettings({ ...settings, beeUrl: e.target.value })} onBlur={() => saveSettings(settings)} /></label>
          <div className="hint">{bee === null ? 'checking…' : bee.ok ? `connected, Bee ${bee.version}` : 'not reachable'}</div>
          <label>Postage batch id (for uploads) <input value={settings.stamp} onChange={(e) => setSettings({ ...settings, stamp: e.target.value.trim() })} onBlur={() => saveSettings(settings)} placeholder="64 hex characters, an immutable batch on your node" /></label>
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
