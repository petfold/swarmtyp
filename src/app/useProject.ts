// One hook decides where the Y.Doc comes from: this device (route `local`) or a Swarm project session (route `#/p/<id>`).
import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { filesMap, initProject, loadLocal } from '../project/model';
import type { Member, RemoteCursor, Session } from '../collab/session';
import type { CursorInfo } from '../editor/remote-cursors';
import type { Settings } from './settings';

export type Route = { kind: 'local' } | { kind: 'project'; id: string };
export function parseRoute(hash: string): Route { const m = /^#\/p\/([0-9a-f]{64})$/i.exec(hash); return m ? { kind: 'project', id: m[1].toLowerCase() } : { kind: 'local' }; }
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  useEffect(() => { const on = () => setRoute(parseRoute(location.hash)); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return route;
}

/** State carried from the local document into a freshly created project (set by the Share action before the hash changes). */
export const pendingImport: { update: Uint8Array | null; name: string | null } = { update: null, name: null };

export interface ProjectState { doc: Y.Doc | null; session: Session | null; members: Member[]; cursors: CursorInfo[]; error: string | null; phase: 'opening' | 'waiting' | 'ready'; remoteVersion: number }

export function useProject(route: Route, settings: Settings, starter: string): ProjectState {
  const [state, setState] = useState<ProjectState>({ doc: null, session: null, members: [], cursors: [], error: null, phase: 'opening', remoteVersion: 0 });
  const cursorMap = useRef(new Map<string, RemoteCursor>());
  const routeKey = route.kind === 'project' ? route.id : 'local';

  useEffect(() => {
    let cancelled = false; let session: Session | null = null;
    cursorMap.current.clear();
    setState({ doc: null, session: null, members: [], cursors: [], error: null, phase: 'opening', remoteVersion: 0 });
    (async () => {
      if (route.kind === 'local') {
        const doc = new Y.Doc();
        if (!loadLocal(doc)) initProject(doc, 'My first document', starter);
        if (!cancelled) setState((s) => ({ ...s, doc, phase: 'ready' }));
        return;
      }
      const { openSession } = await import('../collab/session');
      const nickname = settings.nickname || 'anonymous';
      session = await openSession({ topic: route.id, beeUrl: settings.beeUrl, stamp: settings.stamp, stun: settings.stun, nickname }, {
        onMembers: (members) => !cancelled && setState((s) => ({ ...s, members: members.map((m) => ({ ...m, connected: s.members.find((o) => o.address === m.address)?.connected })) })),
        onPeerState: (connected) => !cancelled && setState((s) => ({ ...s, members: s.members.map((m) => ({ ...m, connected: connected.has(m.address) })) })),
        onCursor: (c, address) => { if (c) cursorMap.current.set(address, c); else cursorMap.current.delete(address); if (!cancelled) setState((s) => ({ ...s, cursors: Array.from(cursorMap.current.values()) })); },
        onError: (message) => !cancelled && setState((s) => ({ ...s, error: message })),
        onRemoteUpdate: () => !cancelled && setState((s) => ({ ...s, remoteVersion: s.remoteVersion + 1 })),
      });
      if (cancelled) { session.stop(); return; }
      const doc = session.doc;
      // Only the creator initialises (from the local document it shared). A visitor whose copy is still empty waits for
      // a member's snapshot: every peer's `initProject` inserts into the same named Y.Text, so a second init would
      // merge into a doubled document (found by e2e/collab.spec.ts). The UI shows the waiting state until then.
      if (filesMap(doc).size === 0 && pendingImport.update) { Y.applyUpdate(doc, pendingImport.update); pendingImport.update = null; }
      pendingImport.name = null;
      if (!cancelled) setState((s) => ({ ...s, doc, session, phase: filesMap(doc).size === 0 ? 'waiting' : 'ready' }));
      if (filesMap(doc).size === 0) {
        const onChange = () => { if (filesMap(doc).size > 0) { filesMap(doc).unobserve(onChange); if (!cancelled) setState((s) => ({ ...s, phase: 'ready' })); } };
        filesMap(doc).observe(onChange);
      }
    })().catch((e) => !cancelled && setState((s) => ({ ...s, error: String((e as Error).message ?? e), phase: 'ready' })));
    return () => { cancelled = true; session?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, settings.beeUrl, settings.stamp, settings.stun, settings.nickname]);

  return state;
}
