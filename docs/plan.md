# Plan

Phases, each with a milestone you can demonstrate. Dates are effort guesses, not commitments. Current position: **before Phase 0**.

## Phase 0 — Spikes (1–2 weeks)

Answer the questions in `spikes.md`. No product code. Throwaway scripts live in `spikes/` and may be deleted afterwards; the *results* go into `spikes.md` and, where they change the design, into `design.md` and `decisions.md`.

Done when: every spike has a recorded result and D-03, D-04, D-08, D-17 have moved from PROPOSED/OPEN to DECIDED.

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

Milestone M1: open the app at a `bzz` address through a gateway, write a two-file document with an image, see it render, download a PDF. The only network calls are to the Bee node (and the package fallback, if used).

## Phase 2 — Two people, one document (2–3 weeks)

- Replace the local `Y.Doc` with a `SwarmDoc` session (SwarmRtc transport).
- Genesis upload and project links.
- Browser-generated identity key with export/import.
- Remote cursors and a member list.
- Handle the two-tabs / two-devices case per the S6 result.
- `y-indexeddb` persistence (D-19); key storage per the D-20 decision.
- Playwright e2e: two browser contexts, a Bee Factory network, edits converge.

Milestone M2: two people on two networks open the same link through a gateway, edit the same file and different files, see each other's cursors, both reload and lose nothing.

## Phase 3 — Close the loop (3–4 weeks)

- Package mirror on Swarm (`tools/mirror`), scheduled in CI; resolver prefers the mirror.
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
