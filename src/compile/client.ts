// Main-thread side of the compile worker: one in-flight compile, monotonic ids, stale results dropped (design §4.4).
import type { Diagnostic, FontIndexEntry, FromWorker, PackageIndex, ToWorker } from './protocol';
import fontIndex from './fonts-index.json';
import packagesIndex from './packages-index.json';

export interface CompileOutput { artifact: Uint8Array | null; diagnostics: Diagnostic[]; ms: number; packages: { key: string; source: string }[] }
export type Status = { state: 'loading'; stage: string; done?: number; total?: number } | { state: 'ready'; ms: number } | { state: 'error'; message: string };

/** typst.ts release the shipped compiler comes from; part of the Cache API key so a new compiler is never served from an old cache. */
export const COMPILER_VERSION = '0.7.0';
/** What the starting document needs (fonts it uses, packages it imports); fetched in parallel with the compiler. */
const STARTER_FONTS = ['LibertinusSerif-Regular.otf', 'LibertinusSerif-Bold.otf', 'LibertinusSerif-Italic.otf', 'NewCMMath-Book.otf', 'DejaVuSansMono.ttf'];
const STARTER_PACKAGES = ['preview/cetz/0.5.2', 'preview/oxifmt/1.0.0'];
const PREFETCH_REFS = [
  ...(fontIndex as FontIndexEntry[]).filter((f) => STARTER_FONTS.includes(f.file)).map((f) => f.ref),
  ...STARTER_PACKAGES.map((k) => (packagesIndex as Record<string, string>)[k]).filter(Boolean),
];

export class CompileClient {
  private worker: Worker;
  private nextId = 1;
  private latest = 0;
  private waiters = new Map<number, (o: CompileOutput) => void>();
  status: Status = { state: 'loading', stage: 'starting' };
  onStatus: (s: Status) => void = () => {};
  /** What the worker is fetching right now during a compile (fonts, packages), or null. */
  onActivity: (what: string | null) => void = () => {};

  constructor(opts: { beeUrl: string; packageIndex?: PackageIndex; allowFallback: boolean }) {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (ev: MessageEvent<FromWorker>) => {
      const m = ev.data;
      if (m.type === 'progress') { if (this.status.state === 'ready') this.onActivity(m.stage); else this.set({ state: 'loading', stage: m.stage, done: m.done, total: m.total }); }
      else if (m.type === 'ready') this.set({ state: 'ready', ms: m.ms });
      else if (m.type === 'init-error') this.set({ state: 'error', message: m.message });
      else if (m.type === 'result') { this.onActivity(null); const w = this.waiters.get(m.id); this.waiters.delete(m.id); w?.({ artifact: m.artifact, diagnostics: m.diagnostics, ms: m.ms, packages: m.packages }); }
    };
    const compilerUrl = new URL('wasm/compiler.wasm.bin', new URL('./', document.baseURI)).href;
    const init: ToWorker = { type: 'init', beeUrl: opts.beeUrl, compilerUrl, compilerVersion: COMPILER_VERSION, fontIndex: fontIndex as FontIndexEntry[], packageIndex: opts.packageIndex ?? (packagesIndex as PackageIndex), allowFallback: opts.allowFallback , prefetch: PREFETCH_REFS };
    this.worker.postMessage(init);
  }
  private set(s: Status) { this.status = s; this.onStatus(s); }

  /** Resolves with the result, or with null if a newer compile superseded this one. */
  compile(input: { mainFile: string; texts: Record<string, string>; blobs: Record<string, string>; format?: 'vector' | 'pdf' }): Promise<CompileOutput | null> {
    const id = this.nextId++;
    if (input.format !== 'pdf') this.latest = id;
    return new Promise((resolve) => {
      this.waiters.set(id, (o) => resolve(input.format === 'pdf' || id >= this.latest ? o : null));
      const msg: ToWorker = { type: 'compile', id, mainFile: input.mainFile, texts: input.texts, blobs: input.blobs, format: input.format ?? 'vector' };
      this.worker.postMessage(msg);
    });
  }
  terminate() { this.worker.terminate(); }
}
