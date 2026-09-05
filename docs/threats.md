# Threats and failure modes

What can go wrong, who could cause it, and what swarmtyp does about it. Numbered so `design.md` and `decisions.md` can point at entries.

## What we protect

- The text of a project and its blobs (confidentiality, integrity, availability).
- The identity key of each collaborator (nobody else writes as them).
- The user's stamp balance.
- The published PDF's stability at its link.

## Who might act against it

A gateway operator; another app served from the same gateway origin; another collaborator; someone who finds a link; a package author; Typst GmbH's package server or CDN; a Bee node on the path; the person maintaining typst.ts.

## Entries

### T1 — Anyone with the link can read and write
The project id is a capability. Whoever has it reads all snapshots and may append. Mitigation now: treat links as secrets; the UI says so when it shows one. Phase 4: project key in the fragment, payloads encrypted before they reach the library (upstream hook, D-12). Vandalism is recoverable because every snapshot stays on Swarm: rollback is a UI feature, not a protocol change.

### T2 — Impersonation
Feed updates are signed by the owner key; deltas are signed and the library drops unsigned or invalid ones. A collaborator cannot write into another's `_doc` feed. Residual risk: a peer *claims* another's nickname. Show addresses (shortened) next to names.

### T3 — Gateway sees everything
In gateway mode the Bee operator sees plaintext snapshots, blobs and signalling, can log who edits what, and can refuse writes. It cannot forge writes (T2). Mitigations: encryption (Phase 4) for content; a local node (Swarm Desktop) for users who care; make the gateway URL a plain setting, never a hardcoded default.

### T4 — Package supply chain
A package from the mirror or the fallback runs inside the Typst compiler. Typst code has no network or filesystem access, so the blast radius is the rendered output, not the machine. Mirror integrity: every package is content-addressed and pinned by version; the mirror tool records upstream commit and licence; the resolver logs which source served each package. Fallback to `packages.typst.org` leaks which packages a user imports (D-08); typst.app's browser has the same leak, since it fetches tarballs from that server directly.

### T5 — SVG injection
Rendered pages are the compiler's SVG, but user SVG images pass through. Sanitise before DOM insertion or render via `<img>`/canvas so no script or foreign element runs in the app origin. Applies equally to previews of collaborators' content. A canvas preview (D-17) removes this surface from the live preview entirely; the rule still applies to every SVG path (export preview, thumbnails).

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
Two tabs with one key write one feed and may corrupt it or drop updates (S6). Mitigated 2026-09-05: each tab signs with `keccak256(identity key ‖ session id)` (`src/collab/identity.ts`), so the same person in two tabs is two members with two feeds; the member list shows both. The identity key itself never signs. Upstream asked for a session id in feed names instead (#6).

### T12 — Upstream drift
typst.ts lags typst; a typst release can change layout. `project.typstVersion` records what compiled the project; the app warns when its compiler differs. Pin versions and keep the compiler wrapper replaceable (D-04).

### T13 — Large documents
A long document with many images can push the worker's memory or make recompiles slow. Debounce, monotonic ids, and (if S2 finds it) incremental compile. Show a "compiling" indicator rather than freezing the preview.

### T14 — Shared origin on a gateway
Under `https://gateway/bzz/<ref>/` all apps share one origin. Any other app a user opens on the same gateway can read swarmtyp's localStorage and IndexedDB: the identity key (D-06), `y-indexeddb` state (D-19), settings, the Bee URL and the stamp. A malicious or compromised app on a popular gateway could then write as the user. Mitigations: subdomain gateways that give each app its own origin, encryption at rest, in-memory keys until wallet derivation; see D-20. A local node (Swarm Desktop) has the same shape, one origin for all `bzz` content, and is not exempt. typst.app owns its origin and does not face this. Freedom Browser gives every hash and every ENS name its own `bzz://` origin, so users on Freedom are not exposed (S1).

### T15 — Leaving before the write lands
A snapshot reaches the peer's feed about 0.5–3 s after the last keystroke (library debounce, then the feed write). Closing or reloading the tab in that window keeps the edit in this browser only; other members who were connected already have it over WebRTC, a late joiner does not (e2e, 2026-09-05). Mitigation: the app asks before unloading within 4 s of a local edit; the better fix is a `flush()` or a pending-writes signal in the library (`docs/upstream/swarm-collaborative-docs.md` §11).
