// Minimal Bee client over fetch (design §4.5, §4.9). bee-js comes in with the collaboration library in Phase 2.
export async function beeHealth(beeUrl: string): Promise<{ ok: boolean; version?: string }> {
  try { const r = await fetch(`${beeUrl}/health`); if (!r.ok) return { ok: false }; const j = await r.json(); return { ok: true, version: j.version }; } catch { return { ok: false }; }
}
export async function uploadBytes(beeUrl: string, stamp: string, bytes: Uint8Array | Blob, contentType = 'application/octet-stream'): Promise<string> {
  const r = await fetch(`${beeUrl}/bytes`, { method: 'POST', headers: { 'Content-Type': contentType, 'Swarm-Postage-Batch-Id': stamp }, body: bytes as BodyInit });
  if (!r.ok) throw new Error(`upload failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).reference as string;
}
export function bytesUrl(beeUrl: string, ref: string) { return `${beeUrl}/bytes/${ref}`; }
export async function usableStamps(beeUrl: string): Promise<{ batchID: string; depth: number; utilization: number; ttlDays: number; immutable: boolean }[]> {
  try {
    const r = await fetch(`${beeUrl}/stamps`); if (!r.ok) return [];
    const j = await r.json();
    return (j.stamps as { batchID: string; usable: boolean; depth: number; utilization: number; batchTTL: number; immutableFlag: boolean }[])
      .filter((s) => s.usable).map((s) => ({ batchID: s.batchID, depth: s.depth, utilization: s.utilization, ttlDays: s.batchTTL / 86400, immutable: s.immutableFlag }));
  } catch { return []; }
}
