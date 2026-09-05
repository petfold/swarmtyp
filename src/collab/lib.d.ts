// Types for the vendored build; the upstream d.ts is a single re-export we do not consume.
declare module '@solarpunkltd/swarm-collaborative-docs' {
  import type * as Y from 'yjs';
  export interface CursorPosition { anchor: number; head: number }
  export interface AwarenessState { address: string; username: string; cursor: CursorPosition | null }
  export type DocTransportFactory = unknown;
  export interface DocSettings {
    user: { privateKey: string; nickname: string };
    infra: { beeUrl: string; stamp?: string; topic: string; members?: Map<string, string>; transport: DocTransportFactory };
  }
  export const DOC_EVENTS: { DOC_UPDATED: string; DOC_ERROR: string; MEMBERS_UPDATED: string; PEERS_CONNECTED: string; PEER_STATE_UPDATED: string; AWARENESS_UPDATED: string };
  export class SwarmDoc {
    constructor(settings: DocSettings);
    doc: Y.Doc;
    start(): void;
    stop(): void;
    updateCursor(cursor: CursorPosition | null): void;
    getEmitter(): { on(event: string, cb: (...args: never[]) => void): void; off(event: string, cb: (...args: never[]) => void): void };
    refreshMemberList(): Promise<void>;
  }
  export function createSwarmRtcTransport(stunUrl: string, iceServers?: RTCIceServer[]): DocTransportFactory;
  export const PLACEHOLDER_STAMP: string;
}
