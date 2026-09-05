// Fetch a large asset in Range pieces. Bee and gateways answer ranges; Freedom's Ant truncates whole bodies
// over a few hundred KB (S1, freedom-hq/ant#79), so ranges are the only path that works everywhere.
export interface RangedProgress { done: number; total: number; pieces: number }

// Hosts that answer every Range request with the first piece (a cache in front ignores the offset) and hide
// Content-Range cross-origin, so a piece walk never ends (S11, download.gateway.ethswarm.org). They serve whole bodies
// fine, so ask for the whole body there. The walkers below also detect a repeated piece from any other host.
const WHOLE_BODY_HOSTS = ['download.gateway.ethswarm.org'];
const wholeBody = (url: string) => WHOLE_BODY_HOSTS.some((h) => url.includes(`//${h}/`));
// A whole-body request to such a host can still be answered from a cache entry that a Range request created (a 206 with
// the first piece; seen on download.gateway.ethswarm.org). Ask under a cache key of our own, and if a 206 still comes
// back, once more under a fresh key. Bee ignores unknown query parameters on /bytes and /bzz.
const wholeUrl = (url: string, fresh = false) => url + (url.includes('?') ? '&' : '?') + 'whole=' + (fresh ? Date.now().toString(36) : '1');
async function fetchWhole(url: string): Promise<Uint8Array> {
  let r = await fetch(wholeUrl(url));
  if (r.status === 206) r = await fetch(wholeUrl(url, true));
  if (r.status !== 200) throw new Error(`GET ${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}
const samePiece = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.length > 0 && a[0] === b[0] && a[a.length - 1] === b[b.length - 1] && a.subarray(0, 64).every((v, i) => v === b[i]) && a.subarray(a.length >> 1, (a.length >> 1) + 64).every((v, i) => v === b[(a.length >> 1) + i]);

export async function fetchRanged(url: string, opts: { piece?: number; parallel?: number; onProgress?: (p: RangedProgress) => void } = {}): Promise<Uint8Array> {
  const piece = opts.piece ?? 1 << 20;
  const parallel = opts.parallel ?? 2;
  if (wholeBody(url)) return fetchWhole(url);
  const first = await fetch(url, { headers: { Range: `bytes=0-${piece - 1}` } });
  if (first.status === 200) return new Uint8Array(await first.arrayBuffer()); // no range support: the whole body came back
  if (first.status !== 206) throw new Error(`GET ${url}: ${first.status}`);
  const firstBytes = new Uint8Array(await first.arrayBuffer());
  const total = Number(first.headers.get('content-range')?.split('/')[1]);
  if (!total) {
    // Cross-origin without Access-Control-Expose-Headers: Content-Range is hidden. Walk pieces until a short one.
    const parts: Uint8Array[] = [firstBytes]; let got = firstBytes.length;
    while (parts[parts.length - 1].length === piece) {
      const r = await fetch(url, { headers: { Range: `bytes=${got}-${got + piece - 1}` } });
      if (r.status === 416) break;
      if (r.status !== 206) throw new Error(`GET ${url} piece at ${got}: ${r.status}`);
      const b = new Uint8Array(await r.arrayBuffer());
      if (samePiece(b, parts[parts.length - 1])) return fetchWhole(url); // server ignored the offset
      parts.push(b); got += b.length;
      opts.onProgress?.({ done: got, total: 0, pieces: parts.length });
      if (b.length === 0) break;
    }
    const out = new Uint8Array(got); let o = 0; for (const b of parts) { out.set(b, o); o += b.length; }
    return out;
  }
  const out = new Uint8Array(total); out.set(firstBytes, 0);
  const offsets: number[] = [];
  for (let o = firstBytes.length; o < total; o += piece) offsets.push(o);
  let next = 0, done = firstBytes.length, pieces = 1;
  opts.onProgress?.({ done, total, pieces });
  const worker = async () => {
    while (next < offsets.length) {
      const o = offsets[next++]; const end = Math.min(o + piece, total) - 1;
      let tries = 0;
      for (;;) {
        try {
          const r = await fetch(url, { headers: { Range: `bytes=${o}-${end}` } });
          if (r.status !== 206) throw new Error(`status ${r.status}`);
          const buf = new Uint8Array(await r.arrayBuffer());
          if (buf.length !== end - o + 1) throw new Error(`short piece ${buf.length}`);
          out.set(buf, o); done += buf.length; pieces++;
          opts.onProgress?.({ done, total, pieces });
          break;
        } catch (e) { if (++tries > 5) throw e; await new Promise((r) => setTimeout(r, 250 * tries)); }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, offsets.length) }, worker));
  return out;
}

export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (!(bytes[0] === 0x1f && bytes[1] === 0x8b)) return bytes; // already inflated (a proxy did it)
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Synchronous ranged GET for workers (typst.ts resolves fonts and packages synchronously, S2/S3). */
export function syncGetRanged(url: string, piece = 1 << 20): Uint8Array {
  const get = (range: string) => {
    const xhr = new XMLHttpRequest();
    xhr.overrideMimeType('text/plain; charset=x-user-defined');
    xhr.open('GET', url, false); xhr.setRequestHeader('Range', range); xhr.send(null);
    if (xhr.status !== 200 && xhr.status !== 206 && xhr.status !== 416) throw new Error(`GET ${url} ${range}: ${xhr.status}`);
    return { status: xhr.status, total: Number(xhr.getResponseHeader('Content-Range')?.split('/')[1]), bytes: xhr.status === 416 ? new Uint8Array() : Uint8Array.from(xhr.response as string, (c) => c.charCodeAt(0)) };
  };
  const wholeOnce = (u: string) => { const xhr = new XMLHttpRequest(); xhr.overrideMimeType('text/plain; charset=x-user-defined'); xhr.open('GET', u, false); xhr.send(null); return xhr; };
  const whole = () => { let xhr = wholeOnce(wholeUrl(url)); if (xhr.status === 206) xhr = wholeOnce(wholeUrl(url, true)); if (xhr.status !== 200) throw new Error(`GET ${url}: ${xhr.status}`); return Uint8Array.from(xhr.response as string, (c) => c.charCodeAt(0)); };
  if (wholeBody(url)) return whole();
  const first = get(`bytes=0-${piece - 1}`);
  if (first.status === 200) return first.bytes; // no range support: whole body came back
  const parts: Uint8Array[] = [first.bytes]; let got = first.bytes.length;
  // Known total: fetch the rest; unknown total (Content-Range hidden cross-origin): walk until a short piece.
  while (first.total ? got < first.total : parts[parts.length - 1].length === piece) {
    const end = first.total ? Math.min(got + piece, first.total) - 1 : got + piece - 1;
    let tries = 0, b: Uint8Array;
    for (;;) { try { const r = get(`bytes=${got}-${end}`); if (first.total && r.bytes.length !== end - got + 1) throw new Error(`short piece ${r.bytes.length}`); b = r.bytes; break; } catch (e) { if (++tries > 5) throw e; } }
    if (!first.total && samePiece(b, parts[parts.length - 1])) return whole(); // server ignored the offset
    parts.push(b); got += b.length;
    if (b.length === 0) break;
  }
  const out = new Uint8Array(got); let o = 0; for (const b of parts) { out.set(b, o); o += b.length; }
  return out;
}
