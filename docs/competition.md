# Competition: typst.app

Status: observed 2026-09-05 from the public playground (https://typst.app/play/), the marketing site, the pricing page, the web-app documentation and the terms. No account was used and nothing was downloaded beyond what a browser fetches to show the page. Version numbers and prices date quickly; re-check before quoting them.

Why this file exists: typst.app is the incumbent hosted Typst editor, and it is built from the same open parts swarmtyp plans to use. Knowing exactly where its closed part starts tells us what we must build, what we can borrow the *idea* of, and what we must not touch.

## 1. What it is

Typst GmbH (Berlin) develops the Typst compiler in the open (Apache-2.0) and sells a closed, hosted web app on top of it. Compiler 0.15.1 is current. Their site claims members of 3,500 universities and laboratories and 1,000 businesses, 55K GitHub stars, 400+ contributors, and 1,550+ packages and templates on Typst Universe. Data is hosted in Germany. Terms §7 grant customers only "a non-exclusive, non-transferable, non-sublicensable worldwide right to use the contractually agreed Service via a browser"; the compiler alone is open source.

## 2. What the browser receives

Everything below was read from the network log, the resource timing table, the DOM and the strings of the served bundle. The playground is the full editor with accounts, sharing and multi-file switched off.

### 2.1 Architecture

- **UI**: React. One main bundle (3.5 MB decoded, brotli on the wire), CSS 229 KB.
- **Editor**: CodeMirror 6. The bundle contains `y-codemirror.next`'s `YSyncConfig` (a `Y.Text`, an awareness object, an `UndoManager`), Yjs internals, and `remote.awareness.peers` for collaborator cursors. This is swarmtyp's D-03 and design §4.1, already in production at the incumbent.
- **Sync**: a binary WebSocket to an editing server (`EDITING_WEBSOCKET_URL`). This is the only collaboration component that is server-side. swarmtyp replaces it with `swarm-collaborative-docs` (feeds + WebRTC).
- **Local persistence**: Yjs updates in IndexedDB, database `playground/<id>`, object store `updates` (the `y-indexeddb` schema). An anonymous edit survives a reload.
- **Compiler**: one wasm-bindgen module, 31.7 MB decoded / 7.8 MB brotli, served immutable. Six exports: `state_new`, `accept`, `acceptError`, `handle`, `main`, `memory`; 80 imports, all from `wbg`. A 12 KB worker bootstrap and a 722 KB glue chunk drive it as a message-passing actor. It contains the compiler, the rasteriser and Hunspell spellcheck (dictionaries `en.dic` 1.8 MB + `en.aff` fetched separately). No WASM threads, no SharedArrayBuffer.
- **Preview**: raster. One `<canvas>` per page, painted with `putImageData`. Roughly one paint per five keystrokes when typing continuously, so compiles are coalesced.
- **Fonts**: a font index (`font-index-v2.mpk`, msgpack, 1.36 MB decoded / 86 KB brotli) plus a preview sprite for the font picker load at start. Faces load one at a time, on demand, by hashed filename. The playground document pulled three Libertinus Serif faces (≈0.3 MB each) and NewCMMath-Book (1.4 MB).
- **Packages**: fetched by the browser straight from `packages.typst.org`: the full `preview/index.json` (2.1 MB decoded) at startup, then `preview/<name>-<version>.tar.gz` per import (tiaoma 0.3.0: 451 KB). The package server therefore allows cross-origin requests.
- **Service worker**: registered, with a versioned Cache Storage and code that sets `Cross-Origin-Embedder-Policy`; the page reports `crossOriginIsolated: true`. Assets are cache-immutable for a year.
- **Backend calls from the playground**: one GraphQL request to `api.typst.app`, Mixpanel, and a Plausible-style pageview beacon. Compiling never touches a server.

### 2.2 Measurements (Chromium, warm cache, one-page A5 document, 2026-09-05)

| Metric | Value |
|---|---|
| Last keystroke → canvas paint | 109 ms |
| DOMContentLoaded / load | 1.47 s / 1.89 s |
| Compiler WASM on the wire | 7.8 MB (brotli), 31.7 MB decoded |
| Main JS bundle, decoded | 3.5 MB |
| Font index on the wire | 86 KB (1.36 MB decoded) |
| Package index, decoded | 2.1 MB |
| NewCMMath-Book | 1.4 MB |
| Hunspell en dictionary | 1.8 MB |

### 2.3 Feature inventory (playground, free)

- **Toolbar**: font picker, bold, italic, underline, heading level, list, enumeration, maths, code block, insert reference, add comment (Pro), scroll preview to cursor, zoom out / percentage / zoom in, preview in popup, Share (sign-up gate), quick PDF export, export menu.
- **File**: new file, upload file, rename, package project (Pro), quick export PDF, export as PDF / PNG / SVG, download ZIP.
- **Edit**: undo, redo, search and replace, go to line, select all, line and block comment, add suggestion/comment (Pro).
- **View**: file, search, outline, "Improve" and settings panels; collaborator cursors; toolbar; scroll on type; wrap lines; split direction; theme; cursor size; editor-only / preview-only / both; preview in popup; colour-blindness simulation; present and speaker mode (Pro); zoom and fit.
- **Help**: tutorial, reference, forum, tips, hints on error, feedback, support, debug.
- **Improve panel**: compiler errors, comments, misspellings.
- **Settings**: compiler version ("Latest (Typst 0.15.1)"); experimental HTML export and accessibility extras; editor font size, line numbers, writing direction, editor font family; Vim mode; spellcheck with a personal dictionary.

## 3. Pro, On-Premises, and what stays hidden

Pricing on 2026-09-05: Free $0; Pro $7.99 per month (14% off yearly); On-Premises custom, from five members.

| Feature | Tier | Lives in | Visible without paying? | swarmtyp |
|---|---|---|---|---|
| Create, edit, share, collaborate, community packages | Free | client + sync server | yes | Phase 1–3, no account |
| Convert LaTeX / Word / Markdown / ODT to Typst | Free | server | no; documented | not planned (would need a server or a WASM converter) |
| "Assists" for compiler errors | Free | client | partly ("Show hints on error") | later, if typst.ts exposes hints |
| 200 MB / 100 files per project | Free | server | n/a | stamps, no quota |
| Review comments (anchored to a text range, threads, resolve, 1,000 per project, not in PDF) | Pro | client UI + server store | UI only; behaviour fully documented | "Later, maybe" (second CRDT layer) |
| Private packages and templates (`@local/` namespace, `typst.toml` form, per-project sharing) | Pro | server registry | documented | a project-scoped or team-scoped package collection on Swarm would be the analogue; not planned |
| GitHub / GitLab sync (pull, push, CRDT-merge, experimental) | Pro | server (OAuth) | documented | needs a server secret or a user token; out of scope by D-05 |
| Zotero / Mendeley sync (read-only `.bib`, refreshed every 5 min) | Pro | server | documented | out of scope by D-05 |
| Invite by email (read / review / write) | Pro | server | documented | capability links now; encrypted projects Phase 4 |
| Presentation and speaker mode (fullscreen, second window, pen, laser, timer, blackout) | Pro | client only | UI gated; documented | free to build, "Later, maybe" |
| Folders, 2 GB / 1,000 files | Pro | server | n/a | n/a |
| Own data centre, LDAP, distribute packages and fonts, priority support | On-Prem | server | documented | swarmtyp has no instance to host |

Verdict: **no subscription is needed to understand the product.** Every Pro feature is described step by step under https://typst.app/docs/web-app/, and all but one (presentation mode) are server-side integrations whose mechanics are irrelevant to a serverless design. The one thing a month of Pro would show is the comments UX, which matters only when swarmtyp designs its own comments layer. Defer until then.

## 4. Business model

Open-core with a hosted-convenience upsell, the model Overleaf established for LaTeX. The compiler is the free funnel (adoption, packages, teaching); the web app monetises collaboration, storage and integrations; On-Premises and commercial support contracts for the compiler monetise organisations. The Free tier is deliberately generous, including real-time collaboration and sharing, which buys growth. Pro is priced low ($7.99 against Overleaf's roughly triple) and bundles workflow features that academics ask for once they co-author (comments) and that organisations need (private packages, Git, LDAP on-prem).

Does it make sense? Yes for them. Their defensible assets are the brand, the compiler roadmap they control, Typst Universe (which they run centrally at `packages.typst.org`), the documentation, and the community. The editor itself is thin over open parts, as §2 shows: anyone with a sync server can match it. That is also the point for swarmtyp: the part of typst.app that costs money to run and that users pay for, the sync server and storage, is the part Swarm makes unnecessary. swarmtyp does not compete on hosting margin; users pay for storage through postage stamps and Solar Punk runs no server. Whether Solar Punk sponsors a gateway (D-07) is a cost question, not a revenue question, and belongs to the people who run the gateway. Whether, when and how to approach Typst GmbH is D-21.

## 5. What swarmtyp may take, and what it may not

- **Not the bundle.** The JavaScript, the WASM, the CSS, the icons, the font index and the previews served by typst.app are Typst GmbH's works, licensed for use "via a browser" only (Terms §7). Copying any of it, with or without rebranding, is infringement. Nothing from it enters this repository (D-18).
- **The compiler, from source.** The same compiler they compile into their WASM is Apache-2.0 at https://github.com/typst/typst. typst.ts builds it for us (D-04). We get the identical engine legitimately.
- **Fonts, from upstream.** Libertinus, New Computer Modern, DejaVu, Inter and Cascadia are all under open font licences. Fetch them from their own releases and record each licence in the font collection manifest.
- **Dictionaries, from upstream.** Hunspell dictionaries are available under open licences that vary per language; source them from their maintainers, not from typst.app's `/assets/dictionaries/`.
- **The reference documentation.** It is built from the typst repository (`docs/` plus doc comments) with `cargo docit compile` into a static site or a PDF. That makes a Swarm-hosted copy of the Typst reference possible later; check the licence of `typst-dev-assets` first.
- **Ideas and behaviour.** Feature sets, UX, asset strategy and the numbers above are observations, not property. Learn freely.
- **The name.** "Typst" is their trademark; use it descriptively ("a Typst editor"), never their logo. Their brand guidelines are linked from the site footer.

## 6. What we learn: consequences for the design

1. **D-03 confirmed by the incumbent.** CodeMirror 6 + `y-codemirror.next` is what typst.app ships. Recommend DECIDED after S5.
2. **Fonts (S4, design §4.7)**: a compact index up front, one face at a time on demand, maths font only when maths appears. Proven at scale.
3. **Preview (T5, new D-17, new S10)**: a raster canvas preview cannot carry an SVG injection. typst.ts offers both SVG and canvas renderers; measure both and default to canvas if quality holds.
4. **Packages (S3, D-08)**: `packages.typst.org` serves tarballs cross-origin, so the fallback works from a `bzz` origin with no proxy. Do not copy the 2.1 MB startup index; the mirror publishes a small index and the resolver fetches per package.
5. **Latency target (S2)**: 109 ms keystroke-to-paint for a one-page document.
6. **Bundle budget (S8)**: they ship about 9 MB compressed before fonts; typst.ts compiler + renderer is ~13 MB uncompressed. Lazy-load the renderer; measure over a gateway.
7. **Cross-origin isolation (S1)**: not needed while typst.ts has no threads. If it ever is, a service worker can add the COOP/COEP headers a gateway will not send, as typst.app does.
8. **Offline (new D-19)**: `y-indexeddb` on the same `Y.Doc` gives the reload-safety typst.app has, for one dependency.
9. **Shared gateway origin (new T14, new D-20)**: typst.app owns its origin. On a path-based `bzz` gateway every app shares one origin, so IndexedDB, localStorage and a stored identity key are readable by any other app on that gateway. Subdomain gateways or encrypted key storage; decide before Phase 2 ships a key store.
10. **Spellcheck and presentation mode** are client-only features typst.app charges for or bundles; both are candidates for "Later, maybe".

## 7. Where swarmtyp is different

Free forever by construction: no account, no sign-up gate on sharing, multi-file or collaboration; no server that can be shut down or breached; every snapshot content-addressed and retrievable; publishing to a permanent `bzz` link; private projects a gateway operator cannot read (Phase 4); a package mirror that does not depend on one company's registry. What swarmtyp cannot match without a server: Git and bibliography sync, email invites, file conversion, and quotas as a product. Those are accepted losses under D-05.

## 8. Their web-app roadmap (as published 2026-09-05)

Items that overlap with swarmtyp's plan or would erode its differentiation if shipped: offline PWA, version history, change tracking, chat-like comments, Git integration, private packages in teams, presentation mode (shipped), compiler version picker (shipped), spell check (shipped). Version history is the one to watch: swarmtyp gets it from immutable snapshots for free and should surface it early.
