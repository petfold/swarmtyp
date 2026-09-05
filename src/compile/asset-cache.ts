// Immutable assets (the compiler and renderer WASM by version, fonts, packages and blobs by Swarm reference) kept in
// the browser's Cache API so a reload, a new release at the same name, or a slow node never re-downloads them
// (D-25; the compiler alone is 10.8 MB and Freedom's Ant delivers about 30 KB/s cold). Keys are synthetic URLs, so
// the cache is independent of which Bee URL or gateway served the bytes. Unavailable in some contexts (insecure
// origins, private windows): every call degrades to "no cache".
const STORE = 'swarmtyp-assets-v1';
const key = (name: string) => `https://assets.swarmtyp.invalid/${name}`;

async function open(): Promise<Cache | null> { try { return typeof caches === 'undefined' ? null : await caches.open(STORE); } catch { return null; } }

export async function cachedBytes(name: string): Promise<Uint8Array | null> {
  const c = await open(); if (!c) return null;
  try { const r = await c.match(key(name)); return r ? new Uint8Array(await r.arrayBuffer()) : null; } catch { return null; }
}
export async function putBytes(name: string, bytes: Uint8Array): Promise<void> {
  const c = await open(); if (!c) return;
  try { await c.put(key(name), new Response(bytes as BodyInit, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length) } })); } catch { /* quota */ }
}
/** Names of everything stored, e.g. to warm an in-memory map before synchronous resolvers need them. */
export async function cachedNames(prefix: string): Promise<string[]> {
  const c = await open(); if (!c) return [];
  try { return (await c.keys()).map((r) => r.url.slice(key('').length)).filter((n) => n.startsWith(prefix)); } catch { return []; }
}
