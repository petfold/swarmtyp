// A project session (design §4.3, D-02): SwarmDoc from swarm-collaborative-docs over the SwarmRtc transport, with the
// Y.Doc persisted locally by y-indexeddb (D-19). Loaded on demand so solo use never pays for the collaboration bundle.
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { SwarmDoc, DOC_EVENTS, createSwarmRtcTransport, type AwarenessState } from '@solarpunkltd/swarm-collaborative-docs';
import { loadIdentity, sessionKey, type Identity } from './identity';

export interface Member { address: string; name: string; connected?: boolean }
export interface RemoteCursor { address: string; name: string; anchor: number; head: number }
export interface SessionEvents {
  onMembers?: (m: Member[]) => void;
  /** Addresses with an open direct channel (edits reach them live; the rest see snapshots from feeds). */
  onPeerState?: (connected: Set<string>) => void;
  onCursor?: (c: RemoteCursor | null, address: string) => void;
  onError?: (message: string) => void;
  onRemoteUpdate?: () => void;
  onSynced?: () => void;
}
export interface Session {
  topic: string; doc: Y.Doc; identity: Identity; signer: Identity;
  updateCursor(anchor: number, head: number): void;
  stop(): void;
  /** Stop and delete this device's copy of the project (D-19 "leave project"). Feeds on Swarm are untouched. */
  leave(): Promise<void>;
}

export async function openSession(opts: { topic: string; beeUrl: string; stamp?: string; stun: string; nickname: string }, ev: SessionEvents = {}): Promise<Session> {
  const identity = loadIdentity();
  const signer = sessionKey(identity);
  const swarmDoc = new SwarmDoc({
    user: { privateKey: signer.privateKey, nickname: opts.nickname },
    infra: { beeUrl: opts.beeUrl, stamp: opts.stamp || undefined, topic: opts.topic, transport: createSwarmRtcTransport(opts.stun) },
  });
  const doc = swarmDoc.doc;
  const persistence = new IndexeddbPersistence(`swarmtyp:${opts.topic}`, doc);
  await persistence.whenSynced;
  ev.onSynced?.();
  const em = swarmDoc.getEmitter();
  em.on(DOC_EVENTS.MEMBERS_UPDATED, ((m: Map<string, string>) => ev.onMembers?.(Array.from(m.entries()).map(([address, name]) => ({ address, name })))) as never);
  em.on(DOC_EVENTS.AWARENESS_UPDATED, ((s: AwarenessState) => ev.onCursor?.(s.cursor ? { address: s.address, name: s.username, anchor: s.cursor.anchor, head: s.cursor.head } : null, s.address)) as never);
  em.on(DOC_EVENTS.PEER_STATE_UPDATED, ((m: ReadonlyMap<string, string>) => ev.onPeerState?.(new Set(Array.from(m.entries()).filter(([, st]) => st === 'connected').map(([a]) => a)))) as never);
  em.on(DOC_EVENTS.DOC_ERROR, ((e: Error) => ev.onError?.(e.message)) as never);
  em.on(DOC_EVENTS.DOC_UPDATED, (() => ev.onRemoteUpdate?.()) as never);
  swarmDoc.start();
  return {
    topic: opts.topic, doc, identity, signer,
    updateCursor: (anchor, head) => swarmDoc.updateCursor({ anchor, head }),
    stop: () => { swarmDoc.stop(); void persistence.destroy(); },
    leave: async () => { swarmDoc.stop(); await persistence.clearData(); },
  };
}
