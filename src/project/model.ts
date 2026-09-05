// Project model (design §4.2, D-11): one Y.Doc per project; text files as Y.Text keyed by path; blobs as references.
import * as Y from 'yjs';

export interface ProjectMeta { name: string; mainFile: string; typstVersion: string; created: number }
export type FileEntry = { kind: 'text' } | { kind: 'blob'; ref: string; mime: string; size: number };
export const TYPST_VERSION = '0.14.2'; // embedded in typst.ts 0.7.0 (S2)
export const TEXT_EXTENSIONS = ['.typ', '.bib', '.csv', '.json', '.yaml', '.yml', '.toml', '.txt', '.svg'];

export function isTextPath(path: string) { return TEXT_EXTENSIONS.some((e) => path.toLowerCase().endsWith(e)); }
export function normalizePath(path: string) { return '/' + path.replace(/^\/+/, '').replace(/\/+/g, '/'); }

export function projectMap(doc: Y.Doc) { return doc.getMap<string | number>('project'); }
export function filesMap(doc: Y.Doc) { return doc.getMap<FileEntry>('files'); }
export function textOf(doc: Y.Doc, path: string) { return doc.getText(normalizePath(path)); }

export function initProject(doc: Y.Doc, name: string, mainSource: string) {
  const p = projectMap(doc);
  if (p.get('created')) return;
  doc.transact(() => {
    p.set('name', name); p.set('mainFile', '/main.typ'); p.set('typstVersion', TYPST_VERSION); p.set('created', Date.now());
    filesMap(doc).set('/main.typ', { kind: 'text' });
    textOf(doc, '/main.typ').insert(0, mainSource);
  });
}

export function meta(doc: Y.Doc): ProjectMeta {
  const p = projectMap(doc);
  return { name: String(p.get('name') ?? 'Untitled'), mainFile: String(p.get('mainFile') ?? '/main.typ'), typstVersion: String(p.get('typstVersion') ?? TYPST_VERSION), created: Number(p.get('created') ?? 0) };
}

export function addTextFile(doc: Y.Doc, path: string, content = '') {
  path = normalizePath(path);
  doc.transact(() => { filesMap(doc).set(path, { kind: 'text' }); const t = textOf(doc, path); if (t.length === 0 && content) t.insert(0, content); });
  return path;
}
export function addBlob(doc: Y.Doc, path: string, ref: string, mime: string, size: number) {
  path = normalizePath(path);
  filesMap(doc).set(path, { kind: 'blob', ref, mime, size });
  return path;
}
export function removeFile(doc: Y.Doc, path: string) {
  doc.transact(() => { filesMap(doc).delete(path); const t = doc.getText(path); if (t.length) t.delete(0, t.length); });
}
export function renameFile(doc: Y.Doc, from: string, to: string) {
  to = normalizePath(to);
  doc.transact(() => {
    const f = filesMap(doc); const e = f.get(from); if (!e) return;
    f.delete(from); f.set(to, e);
    if (e.kind === 'text') { const src = doc.getText(from); const dst = doc.getText(to); dst.insert(0, src.toString()); src.delete(0, src.length); }
    if (projectMap(doc).get('mainFile') === from) projectMap(doc).set('mainFile', to);
  });
}

/** Snapshot of everything the compiler needs (design §4.4). */
export function snapshot(doc: Y.Doc): { mainFile: string; texts: Record<string, string>; blobs: Record<string, string> } {
  const texts: Record<string, string> = {}; const blobs: Record<string, string> = {};
  for (const [path, e] of filesMap(doc).entries()) { if (e.kind === 'text') texts[path] = doc.getText(path).toString(); else blobs[path] = e.ref; }
  return { mainFile: meta(doc).mainFile, texts, blobs };
}

// Phase 1 persistence: the whole Y.Doc state in localStorage (D-19 replaces this with y-indexeddb in Phase 2).
const KEY = 'swarmtyp:project:local';
export function loadLocal(doc: Y.Doc): boolean {
  try { const b64 = localStorage.getItem(KEY); if (!b64) return false; Y.applyUpdate(doc, Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))); return true; } catch { return false; }
}
export function saveLocal(doc: Y.Doc) {
  try { const u = Y.encodeStateAsUpdate(doc); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); localStorage.setItem(KEY, btoa(s)); } catch { /* quota or private mode */ }
}
