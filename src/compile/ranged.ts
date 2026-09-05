// Fetch a large asset in Range pieces. Bee and gateways answer ranges; Freedom's Ant truncates whole bodies
// over a few hundred KB (S1, freedom-hq/ant#79), so ranges are the only path that works everywhere.
export interface RangedProgress { done: number; total: number; pieces: number }

export async function fetchRanged(url: string, opts: { piece?: number; parallel?: number; onProgress?: (p: RangedProgress) => void } = {}): Promise<Uint8Array> {
  const piece = opts.piece ?? 1 << 20;
  const parallel = opts.parallel ?? 2;
  const head = await fetch(url, { headers: { Range: 'bytes=0-0' } });
  if (head.status !== 206) {
    // No range support: fall back to a plain GET.
    const res = head.status === 200 ? head : await fetch(url);
    if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  const total = Number(head.headers.get('content-range')?.split('/')[1]);
  if (!total) throw new Error(`no Content-Range total for ${url}`);
  const out = new Uint8Array(total);
  const offsets: number[] = [];
  for (let o = 0; o < total; o += piece) offsets.push(o);
  let next = 0, done = 0, pieces = 0;
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
