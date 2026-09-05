// Main-thread side of the compile worker: one in-flight compile, monotonic ids, stale results dropped (design §4.4).
import type { Diagnostic, FontIndexEntry, FromWorker, PackageIndex, ToWorker } from './protocol';
import fontIndex from './fonts-index.json';
import packagesIndex from './packages-index.json';

export interface CompileOutput { artifact: Uint8Array | null; diagnostics: Diagnostic[]; ms: number; packages: { key: string; source: string }[] }
export type Status = { state: 'loading'; stage: string; done?: number; total?: number } | { state: 'ready'; ms: number } | { state: 'error'; message: string };

export class CompileClient {
  private worker: Worker;
  private nextId = 1;
  private latest = 0;
  private waiters = new Map<number, (o: CompileOutput) => void>();
  status: Status = { state: 'loading', stage: 'starting' };
  onStatus: (s: Status) => void = () => {};

  constructor(opts: { beeUrl: string; packageIndex?: PackageIndex; allowFallback: boolean }) {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (ev: MessageEvent<FromWorker>) => {
      const m = ev.data;
      if (m.type === 'progress') this.set({ state: 'loading', stage: m.stage, done: m.done, total: m.total });
      else if (m.type === 'ready') this.set({ state: 'ready', ms: m.ms });
      else if (m.type === 'init-error') this.set({ state: 'error', message: m.message });
      else if (m.type === 'result') { const w = this.waiters.get(m.id); this.waiters.delete(m.id); w?.({ artifact: m.artifact, diagnostics: m.diagnostics, ms: m.ms, packages: m.packages }); }
    };
    const compilerUrl = new URL('wasm/compiler.wasm.bin', new URL('./', document.baseURI)).href;
    const init: ToWorker = { type: 'init', beeUrl: opts.beeUrl, compilerUrl, fontIndex: fontIndex as FontIndexEntry[], packageIndex: opts.packageIndex ?? (packagesIndex as PackageIndex), allowFallback: opts.allowFallback };
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
