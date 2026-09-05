/// <reference lib="webworker" />
// The compile worker: typst.ts compiler with a shadow filesystem filled from the CRDT texts and from Swarm blobs,
// lazy fonts and packages from Swarm (design §4.4–4.7). Typst content is untrusted but runs inside the WASM sandbox.
import { createTypstCompiler, createTypstFontBuilder, MemoryAccessModel, initOptions } from '@myriaddreamin/typst.ts';
import { fetchRanged, gunzip, syncGetRanged } from './ranged';
import { cachedBytes, cachedNames, putBytes } from './asset-cache';
import type { Diagnostic, FromWorker, PackageIndex, ToWorker } from './protocol';

const post = (m: FromWorker, transfer?: Transferable[]) => (self as unknown as Worker).postMessage(m, transfer ?? []);

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
      post({ type: 'progress', stage: `package ${spec.name}:${spec.version}` });
      if (this.index[key]) { source = 'swarm'; data = bytesFor(this.index[key], `package ${key.split('/').slice(1).join(':')}`); }
      else if (this.allowFallback && spec.namespace === 'preview') { source = 'packages.typst.org'; data = syncGetRanged(`https://packages.typst.org/preview/${spec.name}-${spec.version}.tar.gz`); }
      else return undefined;
    } catch { return undefined; }
    const dir = `/@memory/swarm/packages/${key}`;
    ctx.untar(data, (path, bytes, mtime) => this.am.insertFile(`${dir}/${path}`, bytes, new Date(mtime)));
    this.cache.set(key, dir); this.served.push({ key, source });
    return dir;
  }
}

// Bytes by Swarm reference, filled from the Cache API and by prefetch before the compiler needs them, and by the
// synchronous resolvers afterwards. Synchronous XHR is the fallback only (S2/S3: typst.ts resolves fonts and packages
// synchronously, so anything not in memory costs a blocking network round trip).
const memCache = new Map<string, Uint8Array>();
function bytesFor(ref: string, label: string): Uint8Array {
  const hit = memCache.get(ref); if (hit) return hit;
  post({ type: 'progress', stage: label });
  const b = syncGetRanged(`${beeUrl}/bytes/${ref}`);
  memCache.set(ref, b); void putBytes(`ref/${ref}`, b);
  return b;
}
async function fetchRef(ref: string, onProgress?: (p: { done: number; total: number }) => void): Promise<Uint8Array> {
  const hit = memCache.get(ref) ?? (await cachedBytes(`ref/${ref}`));
  if (hit) { memCache.set(ref, hit); return hit; }
  const b = await fetchRanged(`${beeUrl}/bytes/${ref}`, { onProgress });
  memCache.set(ref, b); void putBytes(`ref/${ref}`, b);
  return b;
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
  // Warm the memory map from the Cache API (everything ever fetched), then, in parallel with the compiler download,
  // prefetch what the starting document will ask for, so the first compile finds fonts and packages already here.
  const warm = cachedNames('ref/').then((names) => Promise.all(names.map(async (n) => { const b = await cachedBytes(n); if (b) memCache.set(n.slice(4), b); })));
  const prefetch = warm.then(() => Promise.all(m.prefetch.map((ref) => fetchRef(ref).catch(() => undefined))));
  const compilerKey = `compiler/${m.compilerVersion}`;
  let gz = await cachedBytes(compilerKey);
  if (gz) post({ type: 'progress', stage: 'compiler', done: gz.length, total: gz.length });
  else { gz = await fetchRanged(m.compilerUrl, { onProgress: (p) => post({ type: 'progress', stage: 'compiler', done: p.done, total: p.total }) }); void putBytes(compilerKey, gz); }
  const wasm = await WebAssembly.compile((await gunzip(gz)) as BufferSource);
  await prefetch;
  const am = new MemoryAccessModel();
  registry = new SwarmPackageRegistry(am, m.beeUrl, m.packageIndex, m.allowFallback);
  const c = createTypstCompiler();
  await c.init({ getModule: () => wasm, beforeBuild: [initOptions.withAccessModel(am), initOptions.withPackageRegistry(registry)] });
  post({ type: 'progress', stage: 'fonts' });
  const fb = createTypstFontBuilder();
  await fb.init({ getModule: () => wasm });
  for (const e of m.fontIndex) await fb.addLazyFont(e.info as never, () => bytesFor(e.ref, `font ${e.file}`));
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
    if (!bytes) { try { bytes = await fetchRef(ref); } catch { return; } blobCache.set(ref, bytes); }
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
