/// <reference lib="webworker" />
// The compile worker: typst.ts compiler with a shadow filesystem filled from the CRDT texts and from Swarm blobs,
// lazy fonts and packages from Swarm (design §4.4–4.7). Typst content is untrusted but runs inside the WASM sandbox.
import { createTypstCompiler, createTypstFontBuilder, MemoryAccessModel, initOptions } from '@myriaddreamin/typst.ts';
import { loadFontSync } from '@myriaddreamin/typst.ts/dist/esm/init.mjs';
import { fetchRanged, gunzip } from './ranged';
import type { Diagnostic, FromWorker, PackageIndex, ToWorker } from './protocol';

const post = (m: FromWorker, transfer?: Transferable[]) => (self as unknown as Worker).postMessage(m, transfer ?? []);

function syncGet(url: string): Uint8Array {
  const xhr = new XMLHttpRequest();
  xhr.overrideMimeType('text/plain; charset=x-user-defined');
  xhr.open('GET', url, false); xhr.send(null);
  if (xhr.status !== 200) throw new Error(`GET ${url} -> ${xhr.status}`);
  return Uint8Array.from(xhr.response as string, (c) => c.charCodeAt(0));
}

/** Packages: the mirror index first (Swarm), then packages.typst.org if allowed (D-08). Resolution is synchronous (S3). */
class SwarmPackageRegistry {
  private cache = new Map<string, string>();
  served: { key: string; source: string }[] = [];
  constructor(private am: MemoryAccessModel, private beeUrl: string, private index: PackageIndex, private allowFallback: boolean) {}
  resolve(spec: { namespace: string; name: string; version: string }, ctx: { untar: (data: Uint8Array, cb: (path: string, data: Uint8Array, mtime: number) => void) => void }): string | undefined {
    const key = `${spec.namespace}/${spec.name}/${spec.version}`;
    const hit = this.cache.get(key); if (hit) return hit;
    let data: Uint8Array, source: string;
    try {
      if (this.index[key]) { source = 'swarm'; data = syncGet(`${this.beeUrl}/bytes/${this.index[key]}`); }
      else if (this.allowFallback && spec.namespace === 'preview') { source = 'packages.typst.org'; data = syncGet(`https://packages.typst.org/preview/${spec.name}-${spec.version}.tar.gz`); }
      else return undefined;
    } catch { return undefined; }
    const dir = `/@memory/swarm/packages/${key}`;
    ctx.untar(data, (path, bytes, mtime) => this.am.insertFile(`${dir}/${path}`, bytes, new Date(mtime)));
    this.cache.set(key, dir); this.served.push({ key, source });
    return dir;
  }
}

let compiler: ReturnType<typeof createTypstCompiler> | null = null;
let registry: SwarmPackageRegistry | null = null;
let beeUrl = '';
const blobCache = new Map<string, Uint8Array>();
const shadowed = new Set<string>();

async function init(m: Extract<ToWorker, { type: 'init' }>) {
  const t0 = performance.now();
  beeUrl = m.beeUrl;
  post({ type: 'progress', stage: 'compiler' });
  const gz = await fetchRanged(m.compilerUrl, { onProgress: (p) => post({ type: 'progress', stage: 'compiler', done: p.done, total: p.total }) });
  const wasm = await WebAssembly.compile((await gunzip(gz)) as BufferSource);
  const am = new MemoryAccessModel();
  registry = new SwarmPackageRegistry(am, m.beeUrl, m.packageIndex, m.allowFallback);
  const c = createTypstCompiler();
  await c.init({ getModule: () => wasm, beforeBuild: [initOptions.withAccessModel(am), initOptions.withPackageRegistry(registry)] });
  post({ type: 'progress', stage: 'fonts' });
  const fb = createTypstFontBuilder();
  await fb.init({ getModule: () => wasm });
  for (const e of m.fontIndex) await fb.addLazyFont(e.info as never, loadFontSync({ info: e.info, url: `${m.beeUrl}/bytes/${e.ref}` }));
  await fb.build(async (r) => c.setFonts(r));
  compiler = c;
  post({ type: 'ready', ms: Math.round(performance.now() - t0) });
}

async function compile(m: Extract<ToWorker, { type: 'compile' }>) {
  if (!compiler || !registry) throw new Error('compiler not initialised');
  const t0 = performance.now();
  for (const [path, text] of Object.entries(m.texts)) compiler.addSource(path, text);
  // Blobs: fetch by reference (content-addressed, cache forever), then shadow at the file's path.
  const wanted = new Set(Object.keys(m.blobs));
  await Promise.all(Object.entries(m.blobs).map(async ([path, ref]) => {
    let bytes = blobCache.get(ref);
    if (!bytes) { const r = await fetch(`${beeUrl}/bytes/${ref}`); if (!r.ok) return; bytes = new Uint8Array(await r.arrayBuffer()); blobCache.set(ref, bytes); }
    compiler!.mapShadow(path, bytes); shadowed.add(path);
  }));
  for (const path of shadowed) if (!wanted.has(path)) { compiler.unmapShadow(path); shadowed.delete(path); }
  const before = registry.served.length;
  const r = await compiler.compile({ mainFilePath: m.mainFile, format: m.format === 'pdf' ? 1 : 0, diagnostics: 'full' } as never);
  const artifact = (r as { result?: Uint8Array }).result ?? null;
  const diagnostics = ((r as { diagnostics?: Diagnostic[] }).diagnostics ?? []) as Diagnostic[];
  post({ type: 'result', id: m.id, format: m.format, artifact, diagnostics, ms: Math.round(performance.now() - t0), packages: registry.served.slice(before) }, artifact ? [artifact.buffer] : []);
}

self.onmessage = async (ev: MessageEvent<ToWorker>) => {
  const m = ev.data;
  try {
    if (m.type === 'init') await init(m);
    else if (m.type === 'compile') await compile(m);
  } catch (e) {
    if (m.type === 'init') post({ type: 'init-error', message: String((e as Error).message ?? e) });
    else post({ type: 'result', id: m.id, format: m.format, artifact: null, diagnostics: [{ package: '', path: m.mainFile, severity: 'error', range: '0:0-0:0', message: String((e as Error).message ?? e) }], ms: 0, packages: [] });
  }
};
