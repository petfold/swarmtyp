# Decisions

One entry per decision. Status is DECIDED, PROPOSED (default unless overturned), or OPEN (needs a human). Do not reopen DECIDED items without a new entry that supersedes the old one.

## D-01 — Name: `swarmtyp` — DECIDED

Supersedes the earlier working name `galley`, which was a printing term (the typeset proof authors and editors mark up together) but said nothing about what this is. `swarmtyp` names both halves of the project — Swarm and Typst — is free on npm, and needs no explaining. Rejected: `galley` (opaque, taken on npm), `quire` (same problem), `swarmtype` (reads as a typeface).

## D-02 — Build on `swarm-collaborative-docs`, do not write a new sync layer — DECIDED

The library already does per-peer snapshot feeds, member discovery, signed deltas, cursors, and WebRTC signalling over Swarm feeds, and Solar Punk owns it. Anything it lacks (encryption hook, per-session keys) goes upstream. Writing a second Yjs-over-Swarm provider would split effort for no gain.

## D-03 — CodeMirror 6, not Monaco — PROPOSED

Monaco is the library's proven example, but it is large, and its strengths (TypeScript language services) do not apply to Typst. CodeMirror 6 is small, has `y-codemirror.next`, and is what TypstDrive uses. Bundle size matters more here than elsewhere because Swarm serves every byte on first load. Revert to Monaco if S5 shows the CodeMirror awareness bridge is painful.

## D-04 — Use typst.ts rather than our own WASM build of typst — PROPOSED

typst.ts is maintained, published on npm, and used by tinymist's preview. Keep swarmtyp's compiler wrapper thin (one module in `src/compile/`) so a self-built `wasm-bindgen` wrapper around `typst` could replace it if typst.ts falls behind or its API blocks S2/S3.

## D-05 — No server, ever — DECIDED

No signalling server, relay, serverless function, or "temporary" backend. When a Swarm-native mechanism cannot carry a feature at acceptable quality, the feature degrades or waits. This is the point of the project.

## D-06 — Identity: local key first, wallet-derived later — PROPOSED

Phase 2 generates a secp256k1 key in the browser with export/import. Phase 3 derives the key from a domain-bound Sign-In with Ethereum signature (the dappdata derivation) and stores the project list through dappdata. Swarm ID is worth watching but not depending on.

## D-07 — Stamps: own node or sponsoring gateway — PROPOSED

Two supported modes only: the user's own Bee with the user's own batch, or a gateway that stamps from a sponsored batch. No "paste a batch id into a gateway" mode; Bee cannot stamp with a batch its wallet does not own.

## D-08 — Fallback to `packages.typst.org` — OPEN

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
