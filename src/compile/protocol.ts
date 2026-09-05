// Messages between the main thread and the compile worker (design §4.4).
export interface FontIndexEntry { file: string; bytes: number; ref: string; info: unknown }
export type PackageIndex = Record<string, string>; // "preview/<name>/<version>" -> Swarm reference of the tarball (bytes)

export interface Diagnostic { package: string; path: string; severity: 'error' | 'warning' | 'hint' | string; range: string; message: string }

export type ToWorker =
  | { type: 'init'; beeUrl: string; compilerUrl: string; fontIndex: FontIndexEntry[]; packageIndex: PackageIndex; allowFallback: boolean }
  | { type: 'compile'; id: number; mainFile: string; texts: Record<string, string>; blobs: Record<string, string>; format: 'vector' | 'pdf' };

export type FromWorker =
  | { type: 'progress'; stage: string; done?: number; total?: number }
  | { type: 'ready'; ms: number }
  | { type: 'init-error'; message: string }
  | { type: 'result'; id: number; format: 'vector' | 'pdf'; artifact: Uint8Array | null; diagnostics: Diagnostic[]; ms: number; packages: { key: string; source: string }[] };
