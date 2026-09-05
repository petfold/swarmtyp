// The project id is the Swarm reference of an immutable "genesis" upload (D-16): unique, verifiable, no registry.
import { uploadBytes } from '../swarm/bee';
import { TYPST_VERSION } from '../project/model';

export interface Genesis { v: 1; name: string; mainFile: string; typstVersion: string; created: number; creator: string }

export async function createGenesis(beeUrl: string, stamp: string, g: Omit<Genesis, 'v' | 'typstVersion' | 'created'> & { created?: number }): Promise<{ id: string; genesis: Genesis }> {
  const genesis: Genesis = { v: 1, typstVersion: TYPST_VERSION, created: Date.now(), ...g };
  const id = await uploadBytes(beeUrl, stamp, new TextEncoder().encode(JSON.stringify(genesis)), 'application/json');
  return { id, genesis };
}
export async function readGenesis(beeUrl: string, id: string): Promise<Genesis | null> {
  try { const r = await fetch(`${beeUrl}/bytes/${id}`); if (!r.ok) return null; const g = await r.json(); return g && g.v === 1 ? (g as Genesis) : null; } catch { return null; }
}
export function isProjectId(s: string) { return /^[0-9a-f]{64}$/i.test(s); }
