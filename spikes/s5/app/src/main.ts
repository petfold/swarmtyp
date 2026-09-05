// S5: SwarmDoc (swarm-collaborative-docs) + CodeMirror 6 via y-codemirror.next. One tab = one peer.
// URL: ?name=Alice&key=<hex>&topic=<room>&stamp=<batch>&bee=http://127.0.0.1:1633&stun=stun:stun.l.google.com:19302
import * as Y from 'yjs';
import { EditorState } from '@codemirror/state';
import { EditorView, basicSetup } from 'codemirror';
import { yCollab } from 'y-codemirror.next';
import { SwarmDoc, DOC_EVENTS, createSwarmRtcTransport, type DocSettings } from '@solarpunkltd/swarm-collaborative-docs';

const params = new URLSearchParams(location.search);
const name = params.get('name') || 'peer';
let key = params.get('key');
if (!key) {
  const b = crypto.getRandomValues(new Uint8Array(32)); key = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  params.set('key', key); history.replaceState(null, '', '?' + params.toString());
}
const topic = params.get('topic') || 'swarmtyp-s5';
const stamp = params.get('stamp') || undefined;
const beeUrl = params.get('bee') || 'http://127.0.0.1:1633';
const stun = params.get('stun') || 'stun:stun.l.google.com:19302';

const t0 = performance.now();
const events: { t: number; wall: number; ev: string; info?: unknown }[] = [];
const logEl = document.getElementById('log')!;
const log = (ev: string, info?: unknown) => {
  const t = Math.round(performance.now() - t0);
  events.push({ t, wall: Date.now(), ev, info });
  const line = `${String(t).padStart(6)} ms  ${ev}${info !== undefined ? ' ' + JSON.stringify(info) : ''}`;
  logEl.textContent += line + '\n'; logEl.scrollTop = logEl.scrollHeight; console.log('S5 ' + line);
};

// Count Bee requests by route and method (stamp usage proxy).
const counts: Record<string, number> = {};
const origFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith(beeUrl)) {
    const route = new URL(url).pathname.split('/').slice(0, 2).join('/');
    const k = `${(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()} ${route}`;
    counts[k] = (counts[k] || 0) + 1;
  }
  return origFetch(input, init);
};

const xo = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
  const u = String(url);
  if (u.startsWith(beeUrl)) { const route = new URL(u).pathname.split('/').slice(0, 2).join('/'); const k = `${method.toUpperCase()} ${route}`; counts[k] = (counts[k] || 0) + 1; }
  // @ts-expect-error spread of the original signature
  return xo.call(this, method, url, ...rest);
};
document.getElementById('who')!.textContent = `— ${name}`;
document.getElementById('info')!.textContent = `topic=${topic} bee=${beeUrl} stamp=${stamp ? stamp.slice(0, 8) + '…' : '(none, placeholder)'} key=${key.slice(0, 8)}…`;

const settings: DocSettings = {
  user: { privateKey: key, nickname: name },
  infra: { beeUrl, stamp, topic, transport: createSwarmRtcTransport(stun) },
};
const swarmDoc = new SwarmDoc(settings);
const em = swarmDoc.getEmitter();
em.on(DOC_EVENTS.DOC_UPDATED, (doc: Y.Doc) => log('DOC_UPDATED', { len: doc.getText('main.typ').length }));
em.on(DOC_EVENTS.MEMBERS_UPDATED, (m: Map<string, string>) => log('MEMBERS_UPDATED', Array.from(m.values())));
em.on(DOC_EVENTS.PEERS_CONNECTED, () => log('PEERS_CONNECTED'));
em.on(DOC_EVENTS.DOC_ERROR, (e: Error) => log('DOC_ERROR', e.message));
em.on(DOC_EVENTS.AWARENESS_UPDATED, (s: unknown) => log('AWARENESS_UPDATED', s));

const ytext = swarmDoc.doc.getText('main.typ');
const undoManager = new Y.UndoManager(ytext);
swarmDoc.doc.on('update', (_u: Uint8Array, origin: unknown) => { if (origin !== null && typeof origin === 'object') log('local update', { len: ytext.length }); });
const view = new EditorView({
  state: EditorState.create({
    doc: ytext.toString(),
    extensions: [basicSetup, yCollab(ytext, null as never, { undoManager }), EditorView.updateListener.of((u) => {
      if (u.selectionSet) { const r = u.state.selection.main; swarmDoc.updateCursor({ anchor: r.anchor, head: r.head }); }
    })],
  }),
  parent: document.getElementById('editor')!,
});
swarmDoc.start();
log('started', { name, topic, stamp: !!stamp });

(window as unknown as { __s5: unknown }).__s5 = {
  get text() { return ytext.toString(); },
  events, counts, view, swarmDoc,
  type(s: string) { view.dispatch({ changes: { from: view.state.doc.length, insert: s } }); log('typed', { chars: s.length, len: ytext.length }); },
};
