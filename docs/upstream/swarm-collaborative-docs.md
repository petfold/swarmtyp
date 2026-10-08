# Upstream issues for swarm-collaborative-docs (drafts)

Target: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs (Solar Punk owns it; D-02 says extend upstream, never fork). Evidence from spikes S5 and S6 on 2026-09-05, library at `master` adcb7d5, version 0.0.1, built locally with two patches (see issue 3 and issue 9). Filed on 2026-09-05; each section links its issue. Ordered by how much they block swarmtyp.

**Status 2026-10-08.** The maintainer (bosi95) answered and closed all twelve on 2026-10-05, after PRs #18 and #19 (merged 2026-09-25 and 2026-09-30) and the npm release `@solarpunkltd/swarm-collaborative-docs@0.1.0` (2026-10-01). 0.1.0 is breaking against adcb7d5 (room keys, session identity, member map type, new events); what it means for swarmtyp is D-26, measured in S12; what to ask for next is D-27.

| # | Outcome in 0.1.0 |
|---|---|
| 6 | Fixed differently: the library derives a session key from the identity key and `user.sessionId`; swarmtyp's `sessionKey()` can go. Members are grouped per identity through announce feeds signed by the identity key |
| 7 | Published to npm, 0.1.0 |
| 8 | Fixed: `yjs` and `@ethersphere/bee-js` are peer dependencies and external |
| 9 | Fixed: no runtime dependencies; Waku and GSOC moved to `src/experimental/`, not shipped; `y-webrtc` an optional peer loaded by dynamic `import()`. ESM build 54 KB (13 KB gzip), was 1.75 MB |
| 10 | Fixed: `"type": "module"`, `.mjs`/`.cjs` behind an exports map |
| 11 | **Closed although not done**: the reply says "Not in 0.1.0; keeping this open as an enhancement" and asks for Freedom's provider API. Superseded by #20 (draft 13), which answers that question |
| 12 | Fixed: `DOC_READY`, `TRANSPORT_READY`, `PEERS_CONNECTED` (never for a lone peer), plus `DOC_SYNC_STATE` |
| 13 | Answered: the snapshot was always the merged state; gate editing on `DOC_SYNC_STATE` |
| 14 | Fixed: published bee-js 13 instead of the Apiary fork; `engines.node >= 22.12` |
| 15 | Fixed: `createSwarmRtcTransport({ iceServers })`, tunables listed in the README (fixed, not settable) |
| 16 | Fixed: feeds re-read on channel open and every 15 s without a channel; state-vector exchange; `flush()`, `WRITE_PENDING`/`WRITE_DONE`. S12 found two faults in the last part, see 14 below |
| 17 | Fixed: `CursorPosition.scope` |

Drafts 13–16 at the end come from reading 0.1.0, from S12 and from reading Freedom 20152029 (2026-10-08). Filed 2026-10-08 as #20–#23 (D-27).

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

---

## 11. Edits made before the channel opens can be missed; no way to flush

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/16 (2026-09-05, observed in swarmtyp's two-context Playwright test against Bee 2.8.2, master adcb7d5).

- A member's snapshot feed is read once, when the member is first seen (`fetchLatestFromMember` from the member poll or the join notification). If the member writes a newer snapshot before the WebRTC channel opens (here about 30 s after joining), nobody fetches it; later deltas over the channel are applied by index without filling the gap, so Yjs holds them pending. In one run the full-state exchange in `setupDataChannel` reached only one side (the initiator received nothing; the answerer received 1244 B), so the gap was never closed. In the next runs the exchange was two-way. Suggested: re-read the member's feed when the channel opens, or exchange state vectors (`Y.encodeStateVector` → `Y.encodeStateAsUpdate(doc, sv)`) on open instead of a one-shot full state, which also cuts the payload.
- Without a channel there is no convergence after join: a member's feed is never re-read while the session runs, so if ICE fails (Firefox gave up after about 30 s of checking while the answer took 43 s to arrive through the signal feed; the library then re-offered) the peers stay on each other's join-time snapshot until one reloads. Suggested: poll known members' feeds at a slow interval while their connection state is not `connected`, or re-fetch on `PEER_STATE_UPDATED` transitions.
- `publishSnapshot` runs 500 ms after the last update and then writes the feed. There is no `flush()` and no "pending writes" signal, so an app cannot warn the user before unload with certainty; swarmtyp guesses with a 4 s window after the last local edit. Suggested: `SwarmDoc.flush(): Promise<void>` and a `WRITE_PENDING` / `WRITE_DONE` pair of events, or expose `publishInFlight` plus the debounce timer state.
- `PEER_STATE_UPDATED` is exactly what an app needs to show "live" versus "via Swarm" per member; worth a line in the README.

---

## 12. Cursor payload has no file path

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/17

`updateCursor({ anchor, head })` carries positions only. In a multi-file document a peer's caret in `chapters/two.typ` is drawn at the same offsets in whatever file the receiver has open. Suggested: an optional `scope`/`path` string in `CursorPosition`, passed through untouched, or a free-form `meta` object on awareness state.

---

## 13. Write through Freedom's `window.swarm` as it is: a storage interface, a feed layout one identity can own, a member list kept as GSOC entries

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/20 (2026-10-08). swarmtyp chose this route (D-27); spike S13 passed the same day and its results are posted there: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/20#issuecomment-6066979556 It replaces the earlier idea of reopening #11 and asking Freedom for a new method: Freedom needs no change.

**Why.** Freedom no longer lets pages reach a node's HTTP API (freedom-browser #428, commit 1da190bd of 2026-09-28, in 0.8.7-rc.1 and rc.2 of 2026-10-08): requests from web content to any host on port 1633, on the port Freedom's own node uses, or to the origin of a configured external node are cancelled; "dApps that need the node use `window.swarm`". The provider (`src/renderer/lib/swarm-provider.js`, freedom-browser 20152029) offers `swarm_requestAccess`, `swarm_getCapabilities`, `swarm_publishData`, `swarm_publishFiles`, `swarm_publishChunk`, `swarm_readChunk`, `swarm_createFeed`, `swarm_updateFeed`, `swarm_listFeeds`, `swarm_writeFeedEntry`, `swarm_readFeedEntry`, `swarm_writeSingleOwnerChunk`, `swarm_readSingleOwnerChunk`, `swarm_getSigningIdentity`, `swarm_getMessagingIdentity`, `swarm_sendPss`, `swarm_sendGsoc`, `swarm_subscribe`, `swarm_unsubscribe`. It signs every write itself, with its identity for the page's site; a page cannot hand it a key. 0.1.0 owns its feeds by keys the page derives (a room-derived key, the identity key, a key per tab), so none of its writes can go through Freedom as it stands.

**What Freedom already allows.**
- `swarm_writeSingleOwnerChunk({ identifier, data, span })` writes a chunk at any identifier, built as `makeContentAddressedChunk(data, span).toSingleOwnerChunk(identifier, signer)`, the same bytes bee-js writes for a feed entry. With `identifier = keccak256(topic ‖ index)` it is a feed entry any bee-js reader reads, owned by Freedom's identity. `span` lets a page wrap the root chunk of a larger upload (`swarm_publishData`, up to 10 MB), which is what bee-js does for payloads over 4 KB.
- `swarm_sendGsoc({ topic, data })` signs with a key that depends on the topic alone: identifier `keccak256(topic)`, key mined with bee-js's deterministic `gsocMine` towards `keccak256("freedom-gsoc-v1:" + topic)` at proximity 12, uploaded as an ordinary chunk. Any client computes the same key with bee-js. Only the send half of GSOC is used; nobody subscribes, so no full node is needed.
- Reads: `swarm_readFeedEntry({ topic, owner, index })`, `swarm_readSingleOwnerChunk`, `swarm_readChunk` through Freedom's node, 600 requests and 5 MB per minute per site once connected.
- Writes need one feed-access grant and one messaging grant per site, and a node that can publish (Freedom's publishing setup: a light node with a usable batch).

**Proposal for the library.**
1. A storage interface under `SwarmDoc`, `Members`, `DocFeed` and `SwarmSignal`: read a feed entry, write a feed entry owned by "me", write a member-list entry, upload bytes, report whether writing is possible. A Bee adapter on bee-js is the default and behaves as 0.1.0 does; a `window.swarm` adapter maps onto the methods above. This is the seam #11 asked for, widened to reads.
2. One feed layout that one identity can own: a person's snapshot and signal feeds are owned by their identity, with the session id in the topic, as #6 first proposed; the announce entry names each session and its feed owner; each tab still signs deltas and offers with its own random key held in the page. With Bee the page signs, with Freedom Freedom does; the chunks are the same.
3. The member list as GSOC entries: entry *i* at topic `hex(keccak256("swarmdoc:v1:dir:" + secret)) + ":" + i`, appended with the same claim, verify and retry as today's directory. The topic carries a hash of the room key, never the key, because Freedom logs GSOC topics.

**Costs.** A room-format change for every client (swarmtyp takes it with its own move to 0.1.0, D-26); joining computes one key per member-list entry (about 0.02 to 1 s each in Freedom's measurements, cached); in Freedom a person is identified by Freedom's identity for the site, so the same person in another browser is a second identity; the format depends on Freedom keeping its GSOC derivation (`freedom-gsoc-v1:`).

---

## 14. `WRITE_DONE` fires while a write is still queued; a failed write also ends in `WRITE_DONE`

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/21 (2026-10-08). Evidence: S12 (`spikes/s12/check-collab-0.1.mjs`, mock Bee answering each SOC upload after 1.5 s, 0.1.0 from npm).

**`WRITE_DONE` too early.** One edit at 0 s and another at 1.0 s:

```
0.00 s  WRITE_PENDING
1.00 s  WRITE_PENDING
2.03 s  snapshot index 0 written, WRITE_DONE
3.54 s  snapshot index 1 written, WRITE_DONE
```

For 1.5 s an app is told nothing is pending while the second edit is not on Swarm. `publishSnapshot`'s `finally` checks `pendingUpdates` and `debounceTimer` but not the publishes already chained on `publishQueue`. Suggested: count queued publishes (increment in `drainPendingUpdates`, decrement in `finally`) and emit `WRITE_DONE` only at zero.

**Failure looks like success.** With SOC uploads answering 500, `flush()` resolved, `DOC_ERROR` fired, then `WRITE_DONE`. An app that shows "saved" on `WRITE_DONE` says so after a failed write, and nothing retries it: the captured updates are dropped, and the state reaches the feed only if the user types again (the next snapshot is the full document). Suggested: `flush()` rejects, or resolves `{ ok: false }`, when a write in its window failed; `WRITE_DONE` carries `{ ok }` or a `WRITE_FAILED` event exists; and a failed publish is retried with backoff on a fresh index (the claimed-index rule stays).

Worth a README line: `beforeunload` cannot await `flush()`. The pattern is to call `flush()` and `preventDefault()` while a write is pending, so the browser's prompt buys the time the write needs.

---

## 15. A read-only participant: let `stamp` be optional

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/22 (2026-10-08). Evidence: S12.

The README says there is no read-only participant mode. In S12 a visitor with no batch id, or with a batch the node does not have, got `DOC_ERROR` from `start()` and init stopped there: no `DOC_READY`, no `DOC_SYNC_STATE`. But the member poll and the 15 s snapshot poll ran anyway: the visitor had the other member's text after 8 s and followed a later edit, while retrying a directory write the node refused (5 times in 28 s, since its own identity is never listed). So reading already works, unannounced, and the gate the README tells apps to use never opens.

Proposal: `infra.stamp` optional. Without it, skip `validateStamps` and every write (directory, announce, snapshot, signal, retire), never dial (there is no signal feed to answer from), keep the polls, and emit `DOC_READY { memberCount, readOnly: true }` and `DOC_SYNC_STATE` as usual. The library reads with `GET /chunks/{address}` and `GET /feeds/{owner}/{topic}` only; `download.gateway.ethswarm.org` serves `/chunks` with `Access-Control-Allow-Origin: *` (checked 2026-10-08), so a browser with no node could follow a room, at the 15 s poll. For swarmtyp this is how a project link opens for someone with no node and no batch, including a Freedom user who has not done Freedom's publishing setup.

---

## 16. README: what protects the WebRTC fast path

Filed: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/23 (2026-10-08).

"Who can write what" says deltas sent over WebRTC carry a signature checked against the sender's session address. That holds for the JSON `doc` notifications. The SwarmRtc channel also carries binary frames, every local update forwarded at once and the reply to a state vector, and `setupDataChannel` applies those without a signature check. Outsiders still cannot inject: the channel's DTLS fingerprint comes in the SDP the peer wrote to its own signal feed, so only that session key's holder can send on it. Saying that would be accurate; apps quote the sentence in their own threat models (swarmtyp's T2 did).

---

## 17. Encryption, the way Fileverse does it

Filed as part of #20 on 2026-10-09: https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs/issues/20#issuecomment-6068266427. Analysis from Fileverse's dDocs and dSheets (`../fileverse-ddoc`, `../fileverse-dsheets`, their `sync-local/crypto` and our Swarm storage modules there). Shared need: swarmtyp's private projects (D-12, Phase 4) and the Fileverse forks (`plan.md`, "Alongside swarmtyp").

**How Fileverse encrypts.**
- *Live editing.* Each document has a `roomKey`, a secp256k1 private key. Every Yjs update is ECIES-encrypted to that key's public key before it reaches Fileverse's sync server, which stores and relays only ciphertext; whoever holds `roomKey` decrypts.
- *Revocation.* The owner mints a new `roomKey` (an epoch) and re-encrypts the server's durable log into a new session; peers keep the old key for a short dual-decrypt window; the server holds an owner-wrapped copy of the key for recovery.
- *Storage.* Snapshots (IPFS; Swarm in our modules) and images are AES-256-GCM under a per-document key: the blob is a 12-byte nonce, then ciphertext and tag. Keys travel in the link's fragment; our Swarm demo's `#skey=` carries the feed owner's key (write) and the document key (read).
- The server authenticates peers with UCAN and sees ciphertext, identities and timing.

**What carries over.** The library already holds the right secret: the room key exists only in the link's fragment, and every feed address is a hash of it.
1. *A content key and one layer.* Derive a symmetric key from the room secret, in the scheme the room already uses for its digests (`keccak256("swarmdoc:v1:content:" + secret)`, or HKDF), and AES-256-GCM every payload the library writes: snapshot entries, directory and announce entries (they name identities and sessions), and signal records (SDP carries IP addresses). WebCrypto does it; each payload grows by 28 bytes, and snapshots could drop base64 and come out smaller than today. Live deltas and carets already travel over DTLS. Every write and read passes through the storage interface proposed in #20, so this is one layer there: encrypt on write, decrypt on read. It is Fileverse's storage model, and most of the value: the Bee node or gateway, and every node that stores a chunk, then hold ciphertext.
2. *Read-only links.* Fileverse has view-only shares. Split the secret: `readKey = keccak256("swarmdoc:v1:read:" + secret)`. Derive the namespace and the content key from `readKey`; keep the directory's key derived from the full secret. A viewer link carries `readKey` and the creator's identity, and the viewer discovers members through the announce feeds' `known` lists from the creator onwards, not through the directory. With #20's directory as GSOC entries, whoever can compute an entry's address can also write it, so the directory must stay out of a viewer's reach. The viewer can read and decrypt everything but cannot list itself, so no member ever merges its feeds. With read-only participants (#22) such a link needs no postage batch.
3. *Revocation.* Swarm has no server log to re-encrypt, so rotation is a new room: a fresh secret, the current state written there as its first snapshot, and the new key given only to the remaining members. A `rotate()` could do it in one call and leave a "moved" notice in the old room with the new key wrapped (ECIES) for each remaining identity. The old room stays readable to whoever had its key, as Fileverse's old epochs do.
4. *Keys for named people.* Fileverse wraps keys with ECIES for secp256k1 public keys. Library identities are secp256k1 keys, and their public keys can be recovered from any signed payload, so a room key can be wrapped for one member, or placed behind ACT as the README's "Future improvements" suggests. Either way an invited person needs no bearer link.

**What does not carry over.** The parts that need Fileverse's server: the durable, sequenced log; the epoch cutover with a dual-decrypt window on a live connection; UCAN authorisation; the server-held recovery copy of the key. On Swarm the equivalents are the feeds themselves, a new room per rotation, a signature on every write, and recovery from the member's own key (or dappdata's derivation).

**Limits.** Metadata still shows: feed owners (identity and session addresses), chunk sizes and timing are visible to the nodes that store them, although without the secret nobody can tie a feed to a room. A key leaked once reads everything ever written under it, because nothing on Swarm can be deleted; the same holds for Fileverse's old epochs.

**Proposal.** An `encryption` option in the storage layer of #20, on by default for new rooms: content key derived from the room secret, AES-256-GCM on every payload, and a version byte in each payload so later key schemes can coexist. Read keys and `rotate()` as a second step. One issue, or part of the #20 pull request, since it lives in the same layer.
