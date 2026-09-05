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

## D-19 — Local persistence with `y-indexeddb` — DECIDED (2026-09-05)

Phase 2. One dependency on the same `Y.Doc`; reloads and node outages lose nothing typed. Feeds remain the source of truth for other peers. Store per project id; clear on "leave project". What else may live in the same origin depends on D-20.

Implemented 2026-09-05 (`src/collab/session.ts`): `IndexeddbPersistence('swarmtyp:<project id>')` on the `SwarmDoc` document, awaited before the session starts; the e2e reload check passes. "Leave project" (clearing the store) is not built yet; it is on the Phase 2 list. Closed by the owner 2026-09-05.

## D-20 — Origin isolation on gateways — DECIDED (2026-09-05)

On a path-based gateway (`https://gateway/bzz/<ref>/`) every app shares one origin, so any app served there can read swarmtyp's localStorage and IndexedDB, including a stored identity key (T14). Options: (a) recommend or require subdomain gateways (`<cid>.bzz.link` style) that give each app its own origin; (b) encrypt the key at rest with a passphrase; (c) keep keys in memory only until Phase 3's wallet derivation; (d) a combination. Decide before Phase 2 ships a key store.

Interim in the Phase 2 build (2026-09-05): the identity key lives in `localStorage` (`swarmtyp:identity`), each tab signs with a derived sub-key, and Settings shows the address with copy and import. This is option (c)'s risk profile without its protection; on a local node or path gateway any other `bzz` app can read the key (T14). Freedom Browser is not affected.

Decision (2026-09-05). **(a) now, (c) through dappdata in Phase 3, (b) never.** Now: the device key stays at rest, Settings says so, the user guide recommends Freedom Browser for that reason, and the key signs nothing but collaboration feeds, so a leak lets someone write to projects the user was in as the user, which T1 already allows anyone with the link to do; the real loss is attribution (T2) on shared-origin nodes, and that is accepted for the interim. Phase 3: the root becomes a wallet signature or a mnemonic via dappdata (its D16, D17, D21, T10), so the key is derived per session and held in memory, and nothing secret is at rest. (b), a passphrase over the stored key, would be thrown away when (c) arrives. The identity modes and the upgrade path are D-23.

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

## D-23 — Identity roots: device key, mnemonic, wallet — PROPOSED

Context. swarmtyp needs a secp256k1 key per person for feeds and attribution (design §4.10). Not every user has a wallet, and "open a link, type" (the onboarding the whole design rests on) must not need one. dappdata's derivation already accepts more than one entropy source (its D21: wallet signature, mnemonic), binds the seed to a declared app identity rather than the serving origin (its D16), and hands sub-keys to libraries such as swarm-collaborative-docs (its D17).

Proposal. One pipeline, three interchangeable roots: root secret → seed bound to swarmtyp's app identity → collaboration key → per-session sub-keys (as today, T11).

| Root | Friction | Where the secret lives | Other devices | Weakness |
|---|---|---|---|---|
| Device key (today) | none | at rest in this browser | copy and import 64 hex characters | readable by other apps on a shared origin (T14) |
| Mnemonic | shown once, typed per session or remembered by choice | memory, or at rest by choice | type it in | user must keep it |
| Wallet | one fixed signature at sign-in | memory for the session | automatic | needs a wallet |

Default is the device key. Settings offers the other two as upgrades with one sentence each on what they buy. Wallet mode caches the derived key in `sessionStorage` for the tab's lifetime so a reload does not prompt again; never in `localStorage`.

Changing root changes the address. Membership and attribution are per address, so an upgraded user appears in old projects as a second person and their earlier edits stay with the old address. Handling, in order of effort: (1) accept and say so, the user re-joins projects with the new identity; (2) a record signed by both keys, kept in the user's dappdata state, that lets the member list merge the two chips; (3) wrap the device key under the wallet-derived key so the address never changes, which puts a root back at rest and fights dappdata's model. Proposed: (1) for Phase 3, (2) if users ask, never (3).

Needs from dappdata, in its plan's swarmtyp section: the mnemonic source built, not only listed (D21); derivation taking swarmtyp's declared app identity (D16). swarmtyp must choose that identity string before the first real user because it cannot change afterwards; the ENS name is the candidate (D-22 requirement 5).

Interim until then: the device key alone, as built in Phase 2 (D-20). It is the first root of this table, so nothing built for it is thrown away; the only Phase 3 work on it is moving the derivation behind the same interface as the other two.

Costs: three onboarding texts and three recovery stories in the user guide; most early users on the weakest mode, so the T14 warning and the Freedom recommendation stay.

## D-24 — Publish as a Swarm website, with a name — PROPOSED (2026-09-05)

Context. typst.app exports "a PDF, image, or a website (in preview)"; the website is a zip the user hosts elsewhere. Typst's HTML export (0.13 onwards, `--features html`, 0.15.1 today) is experimental and emits semantic markup without CSS; `target()` lets one source serve paged and HTML output. swarmtyp already has the two halves typst.app lacks: a place to host (a Swarm collection is a website) and stable names (a feed manifest, then an ENS or GNS name on top). Freedom Browser resolves `.eth`, `.box`, `.wei`, `.gwei` and `.tez` names to `bzz://` content; `.gwei` names (Gwei Name Service, an ownerless ENS fork on Ethereum mainnet, ERC-721, under a dollar, free `.id.gwei` subnames) accept a Swarm contenthash and have a web gateway at `<name>.gwei.domains`.

Proposal. A "Publish" action with three outputs and one address:

1. **Paged site.** Every page rendered to SVG (S10, works today, exact) inside a small static HTML shell with the PDF attached. No dependence on Typst's HTML export; equations and layout are what the preview shows. This is the first release.
2. **Flowing site.** Typst HTML export plus a swarmtyp stylesheet (a few themes), for documents written with `target()` in mind; multi-file projects map to pages with generated navigation. Ships when typst.ts exposes the HTML exporter in the web compiler and Typst lifts the experimental flag, or earlier behind a "preview" label like typst.app's.
3. **PDF only**, as planned.

Each publish uploads a collection (`index.html`, assets, blobs copied by reference) with the publisher's stamp; the `published` feed's manifest gives one stable `bzz://` address that every later publish updates without another transaction. Names: bind the feed manifest to a name once. `.gwei` registration and contenthash from inside the app through the user's wallet (cheap, one screen, fits D-23's wallet root); `.eth` by a deep link to the ENS app rather than reimplementing it; the free `.id.gwei` subnames as the no-cost path. Visitors without Freedom reach the site through `<name>.gwei.domains` or bzz.link, to be verified (S11), since D-22 found most public gateways refuse to render apps; a static site may fare differently.

Why. It turns "content outlives the app" into a product: the document, its site and its name live on Swarm and Ethereum, not on typst.app or a host. It is the one export typst.app cannot offer as one click, and the natural on-ramp for people who want a page, not a paper. Publishing costs the publisher stamp; a site that nobody tops up expires, and the UI must say so (T7).

S11 part 1 (2026-09-05): the paged site works from the browser compiler and renders on a local node and in Freedom; every public gateway that renders inline does so only for named content (`<ens>.bzz.link`, `<name>.gwei.domains`, both proxying `download.gateway.ethswarm.org`), so the name is the product, not an extra. HTML export is absent from the typst.ts web build (part 2), which keeps the flowing site in Phase 4 unless upstream adds it. Decided by the owner 2026-09-05 (S11 part 3): Typst GmbH is actively building HTML export (typst/typst#5512, NLnet-funded; 0.15.0 added MathML and a multi-file bundle export; CSS deferred), so swarmtyp builds nothing of its own for the flowing site and waits for the exporter, then asks typst.ts to expose it in the web build. The paged site does not wait. Proven end to end 2026-09-05 with `swarmtyp.gwei` (owner's wallet): `https://swarmtyp.gwei.domains/` renders the paged site in an ordinary browser and `bzz://swarmtyp.gwei/` in Freedom; a feed update reached both without a transaction (S11 table).

Not decided: whether the paged site is the default or the fallback; whether swarmtyp maintains themes at all; the `target()` conventions we recommend to authors; wallet-only name purchase versus a sponsored `.id.gwei` subname for wallet-less users (D-23). Spike S11 first.

## D-25 — What `swarmtyp.gwei` and its subdomains point at — PROPOSED (2026-09-05)

Context. The owner registered `swarmtyp.gwei` (S11) and asked whether it should open the editor, with published documents under other names or under subdomains. Facts (S11, GNS README): only the parent's owner can mint subdomains, each is its own ERC-721 with its own contenthash, free apart from gas, and the gateway serves `<sub>.swarmtyp.gwei.domains`; the gateway ignores `Range` and serves whole bodies (the app's loader copes, `fetchRanged` accepts a 200), while `download.gateway.ethswarm.org/bytes/<ref>` answers `Range` with 206 and `Access-Control-Allow-Origin: *`, so a browser with no node can read fonts and packages from it.

Proposal.
1. **Root → the editor.** `swarmtyp.gwei` points at the release feed manifest (`b656fac5…a100`), so `https://swarmtyp.gwei.domains/` and `bzz://swarmtyp.gwei/` open the current app and every release is a feed update, no transaction. The gateway gives the app its own origin (`swarmtyp.gwei.domains`), which removes T14 for gateway users; Freedom already isolates per name. Verify first on a subdomain (`app.swarmtyp.gwei`) that the 12 MB load, the worker and the fonts work through the gateway, then re-point the root.
2. **swarmtyp's own pages as subdomains**, minted by the owner: `guide.swarmtyp.gwei` (the user guide, written in Typst and published with the paged-site path, so the guide is also the first real published document), `demo.swarmtyp.gwei` (the S11 sample). A handful, minted by hand.
3. **Users' documents under users' names**, not under `swarmtyp.gwei`: subdomains can only be minted by the owner's wallet, so per-user or per-document subdomains would need the owner, or a signing service, in the loop (D-05 forbids the service, and the owner does not scale). Publishing offers the user's own `.gwei` (0.0005 ETH), a free `.id.gwei`, or ENS; the app fills in the contenthash for them.
4. **Reads without a node.** When the configured Bee URL does not answer, the app reads fonts, packages and blobs from `download.gateway.ethswarm.org` (ranged, CORS open); writes still need a node and a stamp, shown as today. This is the "read gateway" of D-22 without running one.
5. **A background text inside the editor**: a first-run panel and an "About" entry, three sentences on what swarmtyp is and where the guide lives, linking to `guide.swarmtyp.gwei`; the starter document stays the hands-on demo.

Costs: names are yearly (the manage panel shows `swarmtyp.gwei` expiring 2027-09-05; RENEW is a transaction, and a lapsed name drops the app's address), so the renewal goes on the owner's calendar and into the release checklist; two or three owner transactions for subdomains; the app-through-gateway test before the root moves; the read fallback is a small change in `src/swarm/` plus a status line saying which source is in use.

