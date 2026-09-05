# Plan

Phases, each with a milestone you can demonstrate. Dates are effort guesses, not commitments. Current position: **Phase 1 started 2026-09-05.**

## Phase 0 — Spikes (1–2 weeks)

Answer the questions in `spikes.md`. No product code. Throwaway scripts live in `spikes/` and may be deleted afterwards; the *results* go into `spikes.md` and, where they change the design, into `design.md` and `decisions.md`.

Done when: every spike has a recorded result and D-03, D-04, D-17 have moved from PROPOSED to DECIDED (D-08 moved to the Phase 3 gate). **Gate passed 2026-09-05:** D-03, D-04, D-17 closed; S1 Firefox and S8 deploy timings carried into Phase 1 and D-22.

**Status 2026-09-05.** Answered: S2, S3, S4, S5, S6, S9, S10 (results in `spikes.md`). S1 answered for the local node; the public-gateway half cannot be run because no public gateway renders apps (D-22), and Firefox waits for Playwright. S7 and S8 partial: endpoints and CORS known, WASM compression path proven, no deploy script yet and no gateway timings. Proposed closures for the owner:

- D-03 → DECIDED. CodeMirror 6 with `y-codemirror.next` binds to `SwarmDoc.doc` with no awareness object; remote cursors are ours to draw (S5); typst.app uses the same pair.
- D-04 → DECIDED. typst.ts 0.7.0 covers everything the design needs: shadow filesystem, synchronous package registry, lazy fonts, incremental compile, PDF, semantic tokens (S2–S4, S9). Keep the wrapper thin; file the renderer panic and the `loadFonts` no-op upstream; it embeds Typst 0.14.2 while typst.app runs 0.15.1.
- D-08: keep as written; the mechanism and the fallback both work (S3); decide the default after `tools/mirror` exists.
- D-17 → canvas for the visible pages, SVG for export and print-quality zoom (S10).
- D-22 needs an answer before M1 is shown to anyone without a Bee node.
- S6 fixes T11 with a per-session sub-key; the upstream `sessionId` ask goes to swarm-collaborative-docs (D-02).

## Phase 1 — Solo editor on Swarm (2–3 weeks)

One person, one project, no collaboration yet. Proves the compiler runs from a `bzz` address.

- Vite + React + TypeScript shell, hash routing, settings panel (Bee URL, stamp).
- CodeMirror 6 with Typst highlighting.
- Compile worker with typst.ts; preview pane (renderer per D-17); diagnostics in the gutter.
- Multi-file project held in a local `Y.Doc` (no `SwarmDoc` yet) so Phase 2 changes nothing in the editor.
- Blob upload to Swarm and use in the document.
- Fonts served from Swarm; packages from the fallback registry with a vendored handful for the demo.
- PDF export in the browser.
- `tools/deploy`: upload `dist/` as a collection, advance the release feed.

Milestone M1: open the app at a `bzz` address through a local node or Freedom Browser (D-22), write a two-file document with an image, see it render, download a PDF. The only network calls are to the Bee node (and the package fallback, if used).

**Status 2026-09-05, first slice deployed.** Reference `47c3af90…884e` on the Swarm Desktop node compiles the starter document in 465 ms from `/bzz/<ref>/`. Done: Vite/React shell with settings (Bee URL, batch id, fallback toggle, zoom); `Y.Doc` project model with files map, rename, delete, main-file switch and per-device persistence in localStorage; compile worker with ranged gzip WASM loading, lazy fonts from Swarm, package registry (mirror index, then `packages.typst.org` if allowed, source shown in the UI), blob shadowing by reference, stale-result dropping; canvas preview of visible pages (D-17); CodeMirror 6 with a stream-parser Typst mode and compiler diagnostics in the gutter and a Problems panel; blob upload to Swarm; PDF export; `tools/deploy` (collection upload, no feed yet). Build: 13 MB, 10.8 MB of it the compiler. **Status 2026-09-05, later: M1 reached on the local node.** Stable address `bzz/b656fac5…a100/` (feed manifest, topic `swarmtyp/release`, advanced by `pnpm release`); the Typst default font set is on Swarm (Libertinus Serif, New Computer Modern incl. Math, DejaVu Sans Mono, 13 faces, 6.5 MB, licences in the index); six packages vendored with licences (`tools/mirror/vendor.mjs`) and served with the fallback off; in the deployed build an image uploaded through the file input rendered in a figure and a 30 KB PDF exported; Playwright smoke test passes in Chromium and Firefox (`pnpm test:e2e`, needs a reachable Bee node). **Freedom Browser (D-22), 2026-09-05:** `bzz://b656fac5…a100/` opened on a fresh profile with Freedom's own Ant in ultra-light mode; Freedom resolved the feed manifest, the app and its assets came through Ant in ranged pieces, the starter compiled in 768 ms and rendered, 335 s after navigation (the compiler at about 50 KB/s cold; the second load comes from Ant's disk cache). Every large fetch is ranged now, including the synchronous font and package loads in the worker. Found and fixed the same day: from a `bzz://` page the maths face (1.4 MB) was cut at 1 MB because Bee hides `Content-Range` cross-origin; the loaders now walk pieces without a known total, and the status bar shows what the worker is fetching (T13). Re-verified in Chromium and Firefox; Freedom re-run below. Note: a dev build bakes `VITE_STAMP` into the bundle (fine for a personal deploy, not for a shared release; the settings panel overrides it).

## Phase 2 — Two people, one document (2–3 weeks)

- Replace the local `Y.Doc` with a `SwarmDoc` session (SwarmRtc transport).
- Genesis upload and project links.
- Browser-generated identity key with export/import.
- Remote cursors and a member list.
- Handle the two-tabs / two-devices case per the S6 result.
- `y-indexeddb` persistence (D-19); key storage per the D-20 decision.
- Playwright e2e: two browser contexts, a Bee Factory network, edits converge.

Milestone M2: two people on two networks open the same link through a gateway, edit the same file and different files, see each other's cursors, both reload and lose nothing.

After M2: the first public post to the Typst community and the questions to Typst GmbH listed in D-21.

## Phase 3 — Close the loop (3–4 weeks)

- Package mirror on Swarm (`tools/mirror`), scheduled in CI; resolver prefers the mirror. Decide D-08 (fallback default) here.
- Publish: PDF to Swarm, `published` feed, shareable link.
- Identity from Sign-In with Ethereum (dappdata derivation); project list via dappdata.
- Swarm Desktop path documented and tested (local Bee, own stamp).
- Source ↔ preview jumping if typst.ts source maps cooperate.

Milestone M3: a new user with a wallet and Swarm Desktop creates a project, imports `@preview` packages with the fallback switched off, invites a co-author, publishes a PDF at a stable link, and finds the project again on another device.

## Phase 4 — Private projects and hardening

- Encryption hook in `swarm-collaborative-docs` (upstream), project key carried in the link fragment; encrypted snapshots, deltas and blobs.
- TURN option in settings; own STUN default (D-15).
- ENS name for the app and for published documents.
- Incremental compile if S2 found a path; large-document performance.
- Accessibility pass; keyboard-only operation.

Milestone M4: a project whose feeds a gateway operator can see but cannot read.

## Later, maybe

Comments and suggestions as a second CRDT layer; templates from Swarm; a read-only "viewer" build for published documents; a local-first mode that queues writes while a Bee node is unreachable (D-19 is the first half); version history as a UI over the snapshots swarmtyp already keeps (typst.app lists it on its roadmap, `competition.md` §8); presentation and speaker mode (client-only, a paid feature at typst.app); spellcheck with upstream Hunspell dictionaries; the Typst reference documentation built from the typst repository and hosted on Swarm.

## Out of scope

WYSIWYG editing, Typst language server features beyond highlighting, mobile layout, any server component.
