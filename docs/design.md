# Design

Status: proposal, 2026-09-04. No code exists. Phase 0 spikes (`spikes.md`) test the assumptions marked *(spike)*.

## 1. Goal

A Typst editor that several people can use at once, in the browser, with nothing behind it but Swarm: the app, the documents, the images and fonts, the packages, and the published PDFs all live on Swarm. No server owned by anyone.

Non-goals for now: WYSIWYG editing, comments and review workflow, a mobile UI, offline-first with later merge (Yjs makes it possible and D-19 keeps local state across reloads, but we do not design for long offline periods yet).

## 2. Why Typst fits

Three things line up.

- The compiler is open-source Rust and runs as WebAssembly in the browser. [typst.ts](https://github.com/Myriad-Dreamin/typst.ts) (v0.7.0, June 2026) ships it as `@myriaddreamin/typst-ts-web-compiler` and `@myriaddreamin/typst-ts-renderer`: 28.3 MB and 0.97 MB raw, 10.8 MB and 0.36 MB gzipped (S2). typst.ts 0.7.0 embeds Typst 0.14.2. Edit → compile → preview needs no server.
- Typst source is plain text. Co-editing is one `Y.Text` CRDT per file, the simplest Yjs case. Solar Punk already has a library that does exactly this over Swarm: `@solarpunkltd/swarm-collaborative-docs`.
- Swarm serves static apps and mutable pointers. A `bzz` collection hosts the bundle; feeds carry document state; content addresses name every asset.

What we are *not* doing: porting typst.app. Typst GmbH keeps the web app closed; only the compiler is open (Apache-2.0). swarmtyp is an independent editor on the open compiler.

typst.app's own browser client is built from the same open parts: CodeMirror 6 with `y-codemirror.next`, Yjs, a WASM compiler in a worker, lazily loaded fonts, packages fetched by the browser. Only its sync server, storage and accounts are closed (`competition.md` §2). Those are exactly what swarmtyp replaces with Swarm. Nothing from their bundle is copied (D-18).

## 3. Overview

```
                            browser (one collaborator)
 ┌───────────────────────────────────────────────────────────────────────┐
 │  CodeMirror 6 ── y-codemirror.next ── Y.Doc ── SwarmDoc (swarm-collab-docs)
 │       │  ▲                              │            │   ▲
 │  preview │ diagnostics                  │ debounce   │   │ WebRTC data channel
 │       ▼  │                              ▼            │   │ (deltas, cursors)
 │  renderer (WASM) ◄── vector artifact ── compile worker (WASM)         │
 │                                          ▲      ▲       ▲            │
 │                                     sources  blobs  packages, fonts  │
 └──────────────────────────────────────────┼──────┼───────┼─────┼──────┘
                                            │      │       │     │
                       Bee node or gateway ─┴──────┴───────┴─────┘
                                            │
        Swarm: app bundle · snapshot feeds · member feed · signalling feeds
               · blobs · package mirror · font set · published PDFs
```

Only two kinds of network traffic leave the browser: HTTP to a Bee node (local or gateway) and WebRTC to other collaborators. WebRTC signalling itself goes through Swarm feeds, so no signalling server exists.

## 4. Components

### 4.1 Editor

CodeMirror 6 with a Typst language mode (syntax highlighting: look for a community Lezer grammar first; otherwise adapt tinymist's TextMate grammar or write a stream parser) and `y-codemirror.next` for the CRDT binding. See `decisions.md` D-03 on why CodeMirror rather than Monaco.

Remote cursors: `swarm-collaborative-docs` reports cursors through its own `AWARENESS_UPDATED` event, not a `Y.Awareness` instance. Either feed a local `y-protocols` Awareness from those events or draw cursors ourselves, as the library's Monaco example does. *(spike S5)*

### 4.2 Project model

One project is one `Y.Doc`, and one `SwarmDoc` session. Layout:

```
Y.Doc
├─ Y.Map  'project'   { name, mainFile, typstVersion, created }
├─ Y.Map  'files'     path → { kind: 'text' | 'blob', ref?, mime?, size? }
└─ Y.Text '<path>'    one per text file (.typ, .bib, .csv, .json, .yaml)
```

Text files live in the CRDT. Binary files (images, fonts, data) do not: they are immutable Swarm uploads, and `files` holds their references. `typstVersion` pins the compiler the project was last compiled with, so a newer app can warn before it changes layout.

The project id is the reference of a "genesis" upload: the initial `project` map as JSON, uploaded once. It is unique, content-addressed, and doubles as the `SwarmDoc` topic. Nobody can move it.

### 4.3 Collaboration

`swarm-collaborative-docs` does the work; swarmtyp only wires it. The library's model:

- Each peer writes Yjs snapshots to its own feed `<topic>_doc<address>` (debounced).
- Peers find each other through the shared feed `<topic>_members` and announce joins.
- Live deltas and cursors travel over the chosen transport. swarmtyp uses `createSwarmRtcTransport`: WebRTC data channels, with SDP offer/answer written to per-peer `<topic>_signal` feeds. It needs a STUN server and a Bee node, nothing else.
- A late joiner reads every member's latest snapshot and merges; Yjs makes order irrelevant.

Every feed write is signed by the peer's secp256k1 key, and deltas are signed too, so a peer cannot write as another.

Why not the other transports: `yWebrtc` needs a signalling server (violates D-05); `SwarmPubSub` (GSOC) needs a Bee build from an unreleased branch; `Waku` relies on a public sandbox. If GSOC pubsub ships in a Bee release, it becomes the natural upgrade for presence.

Known risk: one user in two tabs or on two devices shares one key, so both write the same `_doc` feed. *(spike S6: confirmed, silent divergence.)* Fix in Phase 2: each browser session signs with a sub-key derived from the identity key and a per-tab session id, so it is its own member with its own feed; the identity key is the person, the sub-keys are their sessions (`threats.md` T11). A session id in the feed name would be the cleaner upstream fix (swarm-collaborative-docs #6).

### 4.4 Compile pipeline

The compiler and renderer run in a Web Worker so typing never stalls.

```
Y.Doc update (local or remote)
  → debounce 150–300 ms
  → snapshot all text files + current 'files' index
  → worker.postMessage({ id, mainFile, texts, blobRefs })
        worker: refresh shadow filesystem
                fetch missing blobs from Bee by reference (cache by reference)
                resolve packages (4.6), fonts (4.7)
                compile → vector artifact + diagnostics
  → main thread: renderer draws pages (incremental where the artifact allows)
                 diagnostics → editor gutter and a problems panel
```

Requests carry a monotonic id; the main thread drops results older than the newest request. Recompiles of unchanged input are cheap because typst memoises internally; typst.ts exposes an incremental server whose delta artifacts the renderer merges *(S2: 56 ms and 6.6 KB for a one-word edit in 22 pages)*. Reference point: typst.app paints a one-page document about 110 ms after the last keystroke (`competition.md` §2.2); S2 uses that as its target.

The "world" the compiler sees is a virtual filesystem (typst.ts calls this the shadow filesystem) that swarmtyp fills from the CRDT and from Swarm. Nothing touches a real disk.

### 4.5 Blobs

A user drops an image: swarmtyp uploads it to Swarm with the user's stamp, gets a reference, and adds `{ kind: 'blob', ref, mime, size }` under the chosen path in `files`. Every collaborator's worker fetches by reference when the compiler asks for that path. Content addressing makes the cache trivial: a reference never changes meaning, so cache forever (Cache API, keyed by reference).

### 4.6 Packages

`#import "@preview/name:1.2.3"` normally fetches from Typst GmbH's package server. swarmtyp resolves in this order:

1. in-memory / Cache API cache;
2. the swarmtyp package mirror on Swarm: a Mantaray manifest mapping `preview/<name>/<version>` → collection reference, its root published on a feed swarmtyp controls (mutable pointer, immutable content);
3. optional fallback to `packages.typst.org`, on by default until the mirror is complete, off in a private project (D-08).

The package server allows cross-origin requests: typst.app's browser fetches `preview/<name>-<version>.tar.gz` from it directly, so the fallback needs no proxy. typst.app also loads the whole `preview/index.json` (2.1 MB) at startup; swarmtyp does not. The mirror publishes a compact index and the resolver fetches one package at a time.

The mirror is filled by `tools/mirror`: it walks the public `typst/packages` repository, uploads each package directory as a collection, records the declared licence, and advances the feed. Run it on a schedule in CI. The compiler must let us intercept package resolution *(spike S3)*.

### 4.7 Fonts

typst.ts downloads its default font assets from GitHub. Not acceptable here. swarmtyp uploads a chosen font set (the Typst defaults: Libertinus Serif, New Computer Modern, DejaVu Sans Mono, plus a small CJK fallback if size allows) as a Swarm collection and loads fonts lazily. Project-specific fonts are ordinary blobs registered with the world. *(spike S4)* typst.app has the same shape: a compact font index up front, then one face at a time as the document needs it, so a document without maths never downloads the 1.4 MB maths font (`competition.md` §2.1). The Swarm font collection carries such an index.

### 4.8 Preview

typst.ts renders pages either as SVG or onto a canvas. SVG is crisp at any zoom and selectable, but a project's own SVG *images* pass through the compiler into it, so it must be sanitised before it reaches the DOM (`threats.md` T5). A canvas preview cannot carry markup at all; typst.app paints raster pages into a `<canvas>`. D-17 proposes canvas for the live preview and SVG where vectors matter (export, print-quality zoom); S10 measures both. Any SVG that does reach the DOM is sanitised first. Click-to-source jumping is a later nicety; tinymist's preview does it on top of typst.ts, so the plumbing exists.

### 4.9 Export and publish

PDF export runs in the worker through the compiler. Publishing uploads the PDF to Swarm with the publisher's stamp and returns a reference; a "keep latest" option writes that reference to a per-project `published` feed owned by the publisher, giving a stable `bzz` link, and an optional ENS name on top. Old versions stay retrievable for as long as a stamp pays for them. The same publish can produce a website (D-24): a paged site from SVG renders of the pages in a static shell, later a flowing site from Typst's HTML export with a swarmtyp stylesheet, uploaded as one collection with the PDF; the `published` feed manifest is the site's stable address and a `.gwei` or `.eth` name bound to that manifest never needs another transaction.

### 4.10 Identity, keys, stamps

`SwarmDoc` needs a secp256k1 private key. Phase 2 generates one in the browser, stores it locally, and lets the user export or import it. That key is a root, not the signing key: each browser session signs with a sub-key derived from it, and Phase 3 puts other roots (mnemonic, wallet signature via dappdata) behind the same derivation, so nothing may assume the stored key is permanent or unique per person (D-23). Where it is stored matters: on a path-based gateway every `bzz` app shares one origin, so localStorage and IndexedDB are readable by any other app served there (`threats.md` T14, D-20). Phase 3 derives it from a domain-bound wallet signature (Sign-In with Ethereum), the dappdata pattern, so one wallet yields the same collaboration identity on every device; dappdata also holds the user's project list.

Writes need a postage stamp. Two working modes:

- Own Bee node (Swarm Desktop or a local light node): the user's own batch. Bee accepts batches only from its own wallet, so "paste a batch id" only makes sense here.
- Gateway: a Bee node someone else runs, which stamps on the user's behalf from a sponsored batch, possibly behind a token. Reads need no stamp at all.

Snapshots, signalling records, member entries, blobs, and published PDFs all consume stamp. Immutable stamps everywhere; a mutable stamp corrupts feeds.

### 4.11 Hosting the app

`vite build` → `dist/` → upload as a collection with `index.html` as index document → reference. A feed plus feed manifest gives a stable address that follows every release (`recipes.md` recipe 3 in the swarm skill); an ENS name is optional.

Constraints on the bundle:

- All asset URLs relative (`base: './'`); the app is served under `/bzz/<address>/`.
- Hash-based routing only; there is no server to rewrite paths.
- Workers created with module URLs relative to `import.meta.url`.
- WASM loads through the gateway; if the manifest does not serve `application/wasm`, use `WebAssembly.instantiate` on an ArrayBuffer instead of `instantiateStreaming`. *(spike S1)*
- First load fetches ~29 MB of raw WASM plus fonts, and Bee serves bytes as stored, with no content negotiation. Ship the WASM gzipped and inflate it in the browser with `DecompressionStream('gzip')` (10.8 MB on the wire), or zstd with a small decoder (7.6 MB); measure over a gateway and cache aggressively. *(spike S8)*
- typst.ts's WASM uses no threads, so the page needs no cross-origin isolation. If that changes, a service worker can add the COOP/COEP headers a gateway will not send; typst.app does exactly this.

### 4.12 Sharing and joining

A project link is `<app address>#/p/<project id>`. Opening it makes `SwarmDoc` add the visitor to `<topic>_members` and pull every member's snapshot. Anyone with the link can read and write; the id is a capability. Fine for the first releases; `threats.md` T1 and D-12 describe the path to private projects (project key in the fragment, encrypted payloads, which needs an encryption hook in the library — Solar Punk owns it, so this is an upstream feature, not a fork).

### 4.13 Local persistence

`y-indexeddb` keeps the `Y.Doc`'s updates in IndexedDB, so a reload, a closed laptop or an unreachable Bee node loses nothing that was typed; on reconnect the normal snapshot and delta paths carry the backlog. The peer's own snapshot feed stays the source of truth for everyone else (D-19; typst.app persists the same way). Subject to the origin caveat in 4.10.

## 5. What lives on Swarm

| Item | Structure | Writer | Stamp |
|---|---|---|---|
| App bundle | collection → feed → (ENS) | swarmtyp CI | swarmtyp, immutable |
| Package mirror | Mantaray manifest → feed | swarmtyp CI | swarmtyp, immutable |
| Font set | collection | swarmtyp CI | swarmtyp, immutable |
| Project genesis | immutable upload (= project id) | creator | creator |
| Snapshots | feed `<topic>_doc<address>` per peer | each peer | peer |
| Member list | feed `<topic>_members` | each peer | peer |
| WebRTC signalling | feed `<topic>_signal` per peer | each peer | peer |
| Blobs | immutable uploads, referenced from `files` | uploader | uploader |
| Published PDF | immutable upload; optional `published` feed | publisher | publisher |
| Project list | dappdata (Phase 3) | user | user |

## 6. Flows

Create: user names a project → genesis upload → `SwarmDoc` starts on that topic → first `main.typ` created → snapshot written.

Edit: keystroke → Y.Text update → `SwarmDoc` debounces, writes a snapshot to the peer's feed, broadcasts a signed delta over WebRTC → peers apply the delta → each peer's compile worker recompiles → preview updates.

Join: open link → read members → fetch snapshots → merge → exchange SDP through `_signal` feeds → data channels open → live.

Reload: same as join, from the user's own last snapshot first.

Publish: export PDF in worker → upload → reference (→ `published` feed) → share link.

## 7. Limits to accept

- A collaborator must reach a Bee node. Swarm Desktop users have one; others use a gateway.
- WebRTC across some NATs needs TURN. Without it two peers may never connect directly; they still converge through snapshot feeds, only slower.
- Stamp cost scales with edits. Every snapshot is an upload; the debounce interval is the tuning knob. *(spike S5 measures)*
- typst.ts is a single-maintainer project one step behind typst releases. Pin versions; keep the compiler wrapper thin so a swap to a self-built WASM is possible (D-04).
- No access control beyond "who has the link" until Phase 4.

## 8. Repository layout (proposed)

```
swarmtyp/
├─ CLAUDE.md, README.md
├─ docs/
├─ src/
│  ├─ app/        shell, hash routing, settings (beeUrl, stamp, identity)
│  ├─ editor/     CodeMirror setup, Typst mode, Yjs binding, remote cursors
│  ├─ project/    Y.Doc schema, files index, genesis, blob handling
│  ├─ collab/     SwarmDoc wiring, key store, membership UI model
│  ├─ compile/    worker entry, shadow FS, package resolver, font loader, render bridge
│  ├─ swarm/      Bee client, uploads, publish, cache
│  └─ ui/
├─ tools/
│  ├─ deploy/     build → upload → feed update
│  └─ mirror/     typst/packages → Swarm mirror
├─ e2e/           Playwright: two browser contexts against a Bee Factory network
└─ .github/workflows/
```

If the shadow-filesystem-over-Swarm world proves reusable, it moves to its own package later; not before it exists.
