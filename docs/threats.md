# Threats and failure modes

What can go wrong, who could cause it, and what swarmtyp does about it. Numbered so `design.md` and `decisions.md` can point at entries.

## What we protect

- The text of a project and its blobs (confidentiality, integrity, availability).
- The identity key of each collaborator (nobody else writes as them).
- The user's stamp balance.
- The published PDF's stability at its link.

## Who might act against it

A gateway operator; another collaborator; someone who finds a link; a package author; Typst GmbH's package server or CDN; a Bee node on the path; the person maintaining typst.ts.

## Entries

### T1 — Anyone with the link can read and write
The project id is a capability. Whoever has it reads all snapshots and may append. Mitigation now: treat links as secrets; the UI says so when it shows one. Phase 4: project key in the fragment, payloads encrypted before they reach the library (upstream hook, D-12). Vandalism is recoverable because every snapshot stays on Swarm: rollback is a UI feature, not a protocol change.

### T2 — Impersonation
Feed updates are signed by the owner key; deltas are signed and the library drops unsigned or invalid ones. A collaborator cannot write into another's `_doc` feed. Residual risk: a peer *claims* another's nickname. Show addresses (shortened) next to names.

### T3 — Gateway sees everything
In gateway mode the Bee operator sees plaintext snapshots, blobs and signalling, can log who edits what, and can refuse writes. It cannot forge writes (T2). Mitigations: encryption (Phase 4) for content; a local node (Swarm Desktop) for users who care; make the gateway URL a plain setting, never a hardcoded default.

### T4 — Package supply chain
A package from the mirror or the fallback runs inside the Typst compiler. Typst code has no network or filesystem access, so the blast radius is the rendered output, not the machine. Mirror integrity: every package is content-addressed and pinned by version; the mirror tool records upstream commit and licence; the resolver logs which source served each package. Fallback to `packages.typst.org` leaks which packages a user imports (D-08).

### T5 — SVG injection
Rendered pages are the compiler's SVG, but user SVG images pass through. Sanitise before DOM insertion or render via `<img>`/canvas so no script or foreign element runs in the app origin. Applies equally to previews of collaborators' content.

### T6 — Key loss
Losing the identity key means losing the ability to write to one's own feeds; the content survives in snapshots and other peers hold it. Export/import in Phase 2; wallet derivation in Phase 3 makes the key recoverable from the wallet.

### T7 — Stamp exhaustion or expiry
Writes fail; the library raises `DOC_ERROR`. The editor must keep working locally and show a clear banner; the user finishes editing and tops up. Immutable stamps only, or feeds break.

### T8 — WebRTC metadata
Peers learn each other's IP addresses through ICE; STUN servers see who connects. A TURN relay (Phase 4 option) hides addresses at the cost of a relay operator. Signalling records on `_signal` feeds are public to anyone with the topic.

### T9 — Bee node or gateway unavailable
The app cannot load or cannot sync. A local node removes the dependency for reads and writes; a cached app (service worker, later) keeps the editor usable for reading and local editing until a node returns.

### T10 — Immutability
Nothing on Swarm can be deleted. Every snapshot, blob and PDF persists while a stamp pays. Say so in the UI before the first upload. Encryption (Phase 4) limits what "public forever" means.

### T11 — One identity, two sessions
Two tabs with one key write one feed and may corrupt it or drop updates (S6). Fix before Phase 2 ships.

### T12 — Upstream drift
typst.ts lags typst; a typst release can change layout. `project.typstVersion` records what compiled the project; the app warns when its compiler differs. Pin versions and keep the compiler wrapper replaceable (D-04).

### T13 — Large documents
A long document with many images can push the worker's memory or make recompiles slow. Debounce, monotonic ids, and (if S2 finds it) incremental compile. Show a "compiling" indicator rather than freezing the preview.
