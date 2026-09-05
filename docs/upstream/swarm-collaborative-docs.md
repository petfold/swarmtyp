# Upstream issues for swarm-collaborative-docs (drafts)

Target: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs (Solar Punk owns it; D-02 says extend upstream, never fork). Evidence from spikes S5 and S6 on 2026-09-05, library at `master` adcb7d5, version 0.0.1, built locally with two patches (see issue 3 and issue 9). Filed on 2026-09-05; each section links its issue. Ordered by how much they block swarmtyp.

---

## 1. Same identity in two tabs diverges silently: add a session id to feed names

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/6

**Steps.** Open the same document in two tabs with the same `privateKey` (a second device, or a browser restore), a third peer with another key. Type once in each of the two same-key tabs.

**Observed.** Every peer ends with the same document length and different content: the third peer and tab A hold tab A's edit, tab B holds only its own. No `DOC_ERROR` fires anywhere. Cause: `<topic>_doc<address>` and `<topic>_signal` are keyed by address, so both tabs write the same feeds with independent index counters, the member list (also keyed by address) never learns of the second tab, and it never gets a WebRTC channel (`PEERS_CONNECTED` never fires for it).

**Proposal.** `DocSettings.user.sessionId` (random per session, optional): the doc and signal feeds become `<topic>_doc<address>_<sessionId>` and `<topic>_signal<address>_<sessionId>` while the member list stays keyed by identity address and carries the session ids, so a joiner reads one snapshot per live session and the UI can group sessions under one identity. Second, emit `DOC_ERROR` when a feed write lands on an index that already exists, so the failure is at least visible today.

**Workaround we use.** A per-session signing key derived from the identity key plus a session id; the nickname stays the same. Costs a member entry per session.

---

## 2. Publish the package to npm

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/7

`package.json` names `@solarpunkltd/swarm-collaborative-docs` and the README says `npm install @solarpunkltd/swarm-collaborative-docs`, but the name is not on the registry (404 on 2026-09-05). Consumers must install from git, which runs into issue 9 and forces them to build the library themselves. Publishing 0.0.1 as is would already help; pairing it with issue 3 avoids a breaking change later.

---

## 3. Make `yjs` a peer dependency and externalise it from the library bundle

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/8

`vite.config.mts` externalises `@ethersphere/bee-js`, `react`, `react-dom` and `y-webrtc` but bundles `yjs`. Any consumer that also imports `yjs` (every editor binding does: `y-codemirror.next`, `y-monaco`, `y-prosemirror`) ends up with two Yjs instances. Yjs warns about this and the CRDT breaks: relative positions and types created by one instance are not recognised by the other. We had to add `'yjs'` to `external` in a local build to make CodeMirror work against `swarmDoc.doc`. Proposal: `yjs` in `peerDependencies` (and `external`), same as `react`.

---

## 4. Move the example app's dependencies out of `dependencies`

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/9

`monaco-editor`, `react`, `react-dom`, `lucide-react`, `@waku/sdk` and `@solarpunkltd/comment-system` are in `dependencies`, so installing the library pulls the whole demo app and the Waku SDK. The built ESM library is 1.75 MB (CJS 1.34 MB) because the Waku transport and the comment system are bundled in. Proposal: React and Monaco to `devDependencies` (they are only used under `src/app`); `@waku/sdk` and `@solarpunkltd/comment-system` as optional peer dependencies loaded with a dynamic `import()` inside `createWakuTransport` / the comment code, so a consumer of `createSwarmRtcTransport` pays for none of it. For a dapp served from Swarm every byte is fetched on first load, which is why this matters to us.

---

## 5. Add an ESM entry to `package.json`

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/10

The build already emits `dist/SwarmCollaborativeDocs.js` (ES) next to the CJS file, but `package.json` only has `main: dist/SwarmCollaborativeDocs.cjs.js` and `types`. Bundlers pick CJS and interop is fragile (Vite dev could not import the linked package until we aliased the ES file directly). Proposal: `"module"` and an `"exports"` map with `import`/`require`/`types`.

---

## 6. Accept a stamp function instead of a batch id

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/11

`infra.stamp` is a postage batch id that the Bee node behind `beeUrl` must own. Two things swarmtyp needs do not fit: a user who owns a batch but writes through a node that does not hold it (client-side stamping, `POST /soc` with a signed envelope, which Bee 2.8 accepts), and Freedom Browser, where writes go through a `window.swarm` provider rather than bee-js. Proposal: `infra.stamp: string | ((chunkAddress) => Envelope)` (or a small `Uploader` interface with `uploadSoc` and `uploadBytes`), so the caller decides how a write is paid and sent. Background: dappdata decision D19 (https://github.com/petfold/dappdata, `docs/DECISIONS.md`) describes a stamper service that would plug in here.

---

## 7. `PEERS_CONNECTED` fires with zero peers

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/12

`PEERS_CONNECTED` fired 5.5 s after `start()` for a lone peer whose member list was empty, at the same moment as the first `MEMBERS_UPDATED`. The README says it means "transport has at least one connected peer". Either rename it (`TRANSPORT_READY`) or fire it only when a data channel opens; today a UI that enables editing on this event does so before anyone is connected.

---

## 8. Snapshot feeds carry only local edits

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/13

After a reload each peer restores its own snapshot first, and that snapshot contains only what that peer typed: peer B's feed held 31 characters while the shared document had 91, so B showed a stale document for about 8 s until A's snapshot arrived. Documenting this is enough (a peer's feed is its contribution, the merge is the document), or the snapshot could include the merged state so a reload is complete at once at the cost of larger snapshots.

---

## 9. Installing from git fails with pnpm 11 because of the bee-js git dependency

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/14

`@ethersphere/bee-js` is `github:Apiary-Suite/bee-js` (a fork at 12.2.1). pnpm 11.25 refuses to run its build script: `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED … add to "allowBuilds"` with the exact tarball URL as the key; the `'@ethersphere/bee-js': true` entry in `pnpm-workspace.yaml` is not enough. Either add the URL-keyed `allowBuilds` entry, or depend on a published bee-js (12.2.x on npm, or 13 once the API move is done). `engines.node >= 24` also blocks Node 22 LTS users for no reason we could find; the build ran on 22.

---

## 10. Small README fixes

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/15

- `DocSettings` example uses `stun:stun.l.google.com:19302`; a note that `createSwarmRtcTransport(stunUrl, iceServers?)` accepts a full ICE list (TURN) would save a source read.
- The cursor section says awareness is not a `Y.Awareness`; add that `yCollab(ytext, null)` from `y-codemirror.next` works without one, and that remote cursors are then drawn from `AWARENESS_UPDATED` by the app.
- Mention the 500 ms snapshot debounce and the 5 s member poll as tunables (or expose them in `DocSettings`).
