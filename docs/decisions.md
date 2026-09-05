# Decisions

One entry per decision. Status is DECIDED, PROPOSED (default unless overturned), or OPEN (needs a human). Do not reopen DECIDED items without a new entry that supersedes the old one.

## D-01 — Name: `swarmtyp` — DECIDED

Supersedes the earlier working name `galley`, which was a printing term (the typeset proof authors and editors mark up together) but said nothing about what this is. `swarmtyp` names both halves of the project — Swarm and Typst — is free on npm, and needs no explaining. Rejected: `galley` (opaque, taken on npm), `quire` (same problem), `swarmtype` (reads as a typeface).

## D-02 — Build on `swarm-collaborative-docs`, do not write a new sync layer — DECIDED

The library already does per-peer snapshot feeds, member discovery, signed deltas, cursors, and WebRTC signalling over Swarm feeds, and Solar Punk owns it. Anything it lacks (encryption hook, per-session keys) goes upstream. Writing a second Yjs-over-Swarm provider would split effort for no gain.

## D-03 — CodeMirror 6, not Monaco — DECIDED (2026-09-05)

Monaco is the library's proven example, but it is large, and its strengths (TypeScript language services) do not apply to Typst. CodeMirror 6 is small, has `y-codemirror.next`, and is what TypstDrive uses. Bundle size matters more here than elsewhere because Swarm serves every byte on first load. Revert to Monaco if S5 shows the CodeMirror awareness bridge is painful. Evidence, 2026-09-05: typst.app's own client is CodeMirror 6 with `y-codemirror.next` (`competition.md` §2.1). Closed 2026-09-05 after S5: `yCollab(ytext, null)` binds to `SwarmDoc.doc` with no awareness object; remote cursors are drawn from `AWARENESS_UPDATED`.

## D-04 — Use typst.ts rather than our own WASM build of typst — DECIDED (2026-09-05)

typst.ts is maintained, published on npm, and used by tinymist's preview. Keep swarmtyp's compiler wrapper thin (one module in `src/compile/`) so a self-built `wasm-bindgen` wrapper around `typst` could replace it if typst.ts falls behind or its API blocks S2/S3. Closed 2026-09-05 after S1–S4, S9, S10: every capability the design needs exists in 0.7.0 (shadow filesystem, synchronous package registry, lazy fonts, incremental compile, PDF, semantic tokens, SVG and canvas). Accepted: one Typst release of lag (0.7.0 embeds 0.14.2; 0.8.0-rc3 embeds 0.15.0). Phase 1 pins **0.7.0**; move to 0.8.0 when it is final and re-run S2. Known upstream bugs: typst.ts #888, #889 (`docs/upstream/typst-ts.md`).

## D-05 — No server, ever — DECIDED

No signalling server, relay, serverless function, or "temporary" backend. When a Swarm-native mechanism cannot carry a feature at acceptable quality, the feature degrades or waits. This is the point of the project.

## D-06 — Identity: local key first, wallet-derived later — PROPOSED

Phase 2 generates a secp256k1 key in the browser with export/import. Phase 3 derives the key from a domain-bound Sign-In with Ethereum signature (the dappdata derivation) and stores the project list through dappdata. Swarm ID is worth watching but not depending on.

## D-07 — Stamps: own node or sponsoring gateway — PROPOSED

Two supported modes only: the user's own Bee with the user's own batch, or a gateway that stamps from a sponsored batch. No "paste a batch id into a gateway" mode; Bee cannot stamp with a batch its wallet does not own.

## D-08 — Fallback to `packages.typst.org` — OPEN (decide at the Phase 3 gate, after `tools/mirror`)

On by default until the Swarm mirror covers what users import; off by default in private projects; always visible in the UI when a package came from the fallback. Decide after S3 and once the mirror exists whether to flip the default globally.

## D-09 — Licence: BSD-3-Clause — DECIDED

As `swarmfs`. Permissive, so it composes with the Apache-2.0 upstreams (typst, typst.ts, `swarm-collaborative-docs`) without friction. `LICENSE` at the repo root, copyright Solar Punk Ltd.

## D-10 — TypeScript, Vite, React — PROPOSED

Matches the Solar Punk example apps and the library's React hooks. Vite for the worker and WASM handling with `base: './'`.

## D-11 — One project = one `Y.Doc`; blobs stay outside the CRDT — PROPOSED

Text files as `Y.Text` keyed by path, a `files` index map, a `project` map. Images, fonts and data files are immutable Swarm uploads referenced from the index. Keeps snapshots small and lets the compiler fetch blobs by reference and cache them forever.

## D-12 — Sharing: capability link now, encryption later — PROPOSED

The project id in the URL fragment grants read and write. Phase 4 adds a project key in the fragment and encrypted payloads via an upstream library hook. ACT is the wrong tool for the snapshot stream (forward-only revocation, per-upload history bookkeeping); it may suit published documents.

## D-13 — Repository under `Solar-Punk-Ltd` — PROPOSED

Same home as `swarm-collaborative-docs` and `dappdata`.

## D-14 — Transport: SwarmRtc only — DECIDED

Follows from D-05 (yWebrtc needs a server) and from what released Bee supports (GSOC pubsub does not ship yet). Re-evaluate GSOC when it lands in a Bee release.

## D-15 — STUN default — OPEN

The library example uses Google's STUN. Options: keep it, run a Solar Punk STUN, or ship a list. TURN stays optional and user-configured (Phase 4).

## D-16 — Project id = genesis reference — PROPOSED

The reference of the immutable initial `project` JSON upload is the id and the `SwarmDoc` topic. Unique, verifiable, no registry needed.

## D-17 — Preview renderer: canvas first, SVG where vectors matter — DECIDED (2026-09-05)

typst.ts ships both renderers. Canvas output cannot carry markup, which removes the SVG-injection surface (T5) from the live preview by construction; typst.app paints raster pages the same way. SVG stays for export and for zoom levels where raster looks poor, always sanitised. Closed 2026-09-05 after S10: canvas for the pages in view (about 120 ms per A4 page at 2 px/pt, no markup reaches the DOM), rendered with an explicit 2D context or `OffscreenCanvas` in a worker so hidden tabs do not stall it (typst.ts #889); SVG for export and print-quality zoom, sanitised; a selectable text layer is a later addition. Only visible pages are rendered in either mode.

## D-18 — Nothing from typst.app's bundle enters this repository — PROPOSED

Their JavaScript, WASM, CSS, icons, font index and dictionaries are Typst GmbH's works, licensed for browser use only (their Terms §7). swarmtyp uses the compiler from source via typst.ts, fonts and dictionaries from their upstream projects, and learns from typst.app's behaviour, not its files. `competition.md` §5.

## D-19 — Local persistence with `y-indexeddb` — PROPOSED

Phase 2. One dependency on the same `Y.Doc`; reloads and node outages lose nothing typed. Feeds remain the source of truth for other peers. Store per project id; clear on "leave project". What else may live in the same origin depends on D-20.

## D-20 — Origin isolation on gateways — OPEN

On a path-based gateway (`https://gateway/bzz/<ref>/`) every app shares one origin, so any app served there can read swarmtyp's localStorage and IndexedDB, including a stored identity key (T14). Options: (a) recommend or require subdomain gateways (`<cid>.bzz.link` style) that give each app its own origin; (b) encrypt the key at rest with a passphrase; (c) keep keys in memory only until Phase 3's wallet derivation; (d) a combination. Decide before Phase 2 ships a key store.

## D-21 — Relationship with Typst GmbH and upstream maintainers — OPEN

Context. swarmtyp competes with the free tier of typst.app, the product that funds Typst GmbH, and depends on three things other people maintain: the compiler (Typst GmbH, Apache-2.0), typst.ts (one maintainer, D-04) and swarm-collaborative-docs (Solar Punk, D-02). The owner does not want to carry swarmtyp with great effort. Two questions: whether, when and how to approach Typst GmbH; and where support that lowers maintenance can come from.

Contact. Options: (a) now, with the plan; (b) after M1 or M2, with a link they can open; (c) never, rely on the licence. Leaning (b): a plan is a competitor announcing itself, a working editor at a Swarm address is a community project they can point to. Before that, one short forum or Discord post with two concrete questions: is a Swarm mirror of Universe welcome, and is there a preferred path for embedding the compiler in a browser. Say plainly that swarmtyp is not a port of their app. What to ask for, all free to them: a listing on their Tools page, a forum announcement, a word on name and brand use, the package server staying open to cross-origin requests. Do not expect money or code: the web app is what they keep closed. Risk of asking is low; the compiler is Apache-2.0.

Maintenance. Typst GmbH cannot lower it. Three levers can: push features upstream so swarmtyp stays thin (typst.ts: font source, package resolver hook; swarm-collaborative-docs: encryption hook, stamp hook, signer interface; see `competition.md` §6 and dappdata D17–D20); design for standing still (pinned versions, a static bundle at a Swarm address, content that outlives the app, a read-only viewer build); and co-maintainers from where the appetite already is, the server-backed editors in `references.md` and the Swarm side, which is the more plausible source of support than Typst GmbH.

Trademark. "Typst" descriptively, never their logo; the name stays swarmtyp. Read their brand guidelines before the first public post.

Decide before the first public post, after M1 at the earliest.

## D-22 — Who serves the app to users without a Bee node — DECIDED (2026-09-05)

Context (S1, 2026-09-05). The design assumes "a Bee node or gateway". In 2026 no public Swarm gateway renders arbitrary content: `download.gateway.ethswarm.org` forces downloads, `api.gateway.ethswarm.org`, `gateway.fairdatasociety.org` and `bzz.link` allow-list hashes and redirect the rest to a forbidden page, `gateway.ethswarm.org` is a landing page. Reads through them are fine for data (dappdata S2 used them for feeds), not for hosting a page. A user with Swarm Desktop or a light node is unaffected. Options: (a) Solar Punk runs a read gateway for the app bundle, fonts and packages (reads need no stamp; cost is bandwidth), with writes still going to the user's own node or a sponsoring gateway per D-07; (b) ask bzz.link's operator to allow-list swarmtyp's release feed; (c) require a local node (Swarm Desktop) and say so, which excludes the "open a link" onboarding; (d) mirror the release on ordinary web hosting as well, which contradicts D-05 in spirit though not in mechanism; (e) Freedom Browser (tested 2026-09-05, S1): native `bzz://` with a per-hash origin and a bundled light node, so a `bzz://swarmtyp.eth/` link works with no node and no gateway, at 36 KB/s cold in ultra-light mode today (a five-minute first load, then cached) and with a large-body truncation bug that the ranged loader in S1 sidesteps; writes would go through its `window.swarm` provider, which needs an upstream transport in swarm-collaborative-docs. Leaning (a) plus (b) for the web, (e) as the recommended client; decide before M1 is demonstrated to anyone outside.

**Decision (Peter, 2026-09-05).** In-browser Swarm clients are the path: Freedom Browser now, weeb-3 when its write path is verified. No Solar Punk gateway is planned; swarmtyp must work well in Freedom (per-hash `bzz://` origin, ranged loading, `window.swarm` for writes once swarm-collaborative-docs has a provider transport) and in weeb-3 when it is ready. The gateway requirements below stay as reference in case someone runs one; a plain HTTP gateway remains a supported read path for people with their own node.

What a Solar Punk read gateway must do for (a), to raise with whoever would run it (2026-09-05; none exists on record yet):
1. Serve `GET /bzz/<ref>/<path>` inline: no `Content-Disposition: attachment`, Bee's content types passed through (`text/javascript` for `.mjs`, `application/wasm`), `Accept-Ranges` and `206` for range requests (the app loads large assets in 1 MB ranges), `Cache-Control: immutable` for content addresses.
2. No allow-list, or allow-list swarmtyp's release feed and ENS name; the failing public gateways redirect unknown hashes to a forbidden page.
3. CORS `Access-Control-Allow-Origin: *` on reads, so a page served from one gateway can read feeds, fonts and packages from another.
4. Origin isolation: serve apps from a subdomain per reference or name (`<cid>.gw.example` or `swarmtyp.gw.example`), not only path-based, or every app on the gateway shares one origin and localStorage and IndexedDB (T14, D-20). Needs wildcard DNS and a wildcard certificate.
5. Resolve the app's ENS name (`bzz://swarmtyp.eth` style) to its contenthash so the link is stable across releases.
6. Bandwidth budget: a cold first load is about 12 MB compressed per user (compiler 10.8 MB, renderer 1 MB, fonts and code), then cached by the browser; a CDN or `Cache-Control` in front keeps repeat cost near zero. Compression on the proxy is optional since the app inflates its own gzip.
7. Reads only, or also writes: writes through the gateway mean a sponsored batch and abuse controls (rate limit per identity, quota, dappdata T7); reads need no stamp. The alternative for writes is dappdata's model, where the user's own batch is stamped in the browser and any CORS-enabled node uploads it.
8. Operations: who owns it, uptime expectation, logs and what they retain (T3: the operator sees plaintext until Phase 4 encryption), and whether Solar Punk's existing Bee infrastructure can add a proxy rather than run a new node.
