# Phase 0 spikes

Each spike answers one question. Write the result under **Result** in this file, dated, with numbers where you measured any. A spike that changes the design also edits `design.md` and adds a line to `decisions.md`.

Environment for all spikes: Node 22+, a Bee 2.8.x light node (local, or Bee Factory for a whole test network), `@ethersphere/bee-js` 12.x, typst.ts 0.7.x. Note exact versions in each result.

---

## S1 — typst.ts from a Swarm address

Question: do the compiler and renderer WASM modules load and run when the page and the `.wasm` files are served from `/bzz/<ref>/…` through a Bee node?

Method: build the smallest page that compiles "Hello" with `$typst.svg`, upload it as a collection, open it via the local Bee and via a public gateway. Check the `Content-Type` the manifest serves for `.wasm`. Try `instantiateStreaming`; if it fails, fall back to `instantiate` on an ArrayBuffer. typst.ts's WASM uses no threads, so no COOP/COEP headers are needed; note it if that changes (a service worker can inject them, as typst.app does).

Exit: renders in Firefox and Chromium from both origins; note load time and total bytes.

Result (2026-09-05, Chromium via a Swarm Desktop Bee 2.8.2 light node on mainnet, `spikes/s1/site/index.html`, reference `7b737cf4…ed9fb`, 42 MB collection uploaded in 30 s): **renders from `/bzz/<ref>/` on the local node. Public gateway and Firefox still open.**

- Bee serves the collection with usable types: `.html` `text/html`, `.mjs` `text/javascript` (module scripts load), `.wasm` `application/wasm` (so `instantiateStreaming` is possible), `.ttf` `font/ttf`, `.wasm.gz` `application/gzip` with **no `Content-Encoding`**, so the browser does not inflate it; the page inflates with `DecompressionStream('gzip')` itself, and that works.
- Relative module URLs and an import map resolve under `/bzz/<ref>/`; the typst.ts ESM build imports its two WASM packages by bare specifier, so a bundler or an import map is required.
- Timings on the local node (Chromium, hidden tab): fetch 28.3 MB raw WASM 452 ms, `WebAssembly.compile` 89 ms, compiler init 276 ms, three DejaVu faces (1.3 MB) 58 ms, compile of a one-page document 225 ms, renderer WASM fetch 21 ms and init 31 ms, `renderSvg` 27 ms, PDF 169 ms, JS heap 83 MB. From a plain local web server the gzip path fetched and inflated 10.8 MB in 591 ms.
- `renderToCanvas` on the main thread waits for `requestAnimationFrame`: in a hidden tab the first call took 18 s and 81 s (until a screenshot made the tab visible), the second call 31 ms. Canvas rendering belongs in a worker with `OffscreenCanvas` or must tolerate hidden tabs (S10).
- **Public gateways, checked after push-sync completed (about 5 minutes): none renders an app.** `download.gateway.ethswarm.org` serves every file with `Content-Disposition: attachment`, so the browser downloads `index.html` instead of rendering it (it does serve correct types, `Access-Control-Allow-Origin: *`, range requests, no compression; 0.64 MB/s to this machine, so 28 MB raw would take about 45 s and 10.8 MB gzip about 17 s). `api.gateway.ethswarm.org`, `gateway.fairdatasociety.org` and `bzz.link` redirect an unknown hash to `bzz.link/forbidden?hash=…`: they allow-list content. `gateway.ethswarm.org` serves its own landing page for any path. So the second origin in this spike's exit criterion does not exist today without an operator; see D-22.
- Firefox: closed 2026-09-05 with Playwright (Firefox 153 build): the Phase 1 app compiles the starter, renders to canvas, and shows diagnostics, in 9.4 s for the smoke test against the production build (`e2e/smoke.spec.ts`); Chromium 6.4 s. Module worker, `DecompressionStream`, WASM and canvas all behave the same in both.

**Freedom Browser (2026-09-05, `../freedom-browser` at 5722d2af, Electron 43, driven with its own Playwright harness; script in the session scratchpad).** Freedom is a desktop browser with native `bzz://` navigation, a bundled Rust Swarm light node ("Ant" 0.5.43, Bee-shaped HTTP API) and a permissioned `window.swarm` provider (publish, chunks, feeds, single-owner chunks, PSS, GSOC, signing identities).

- Opened `bzz://7b737cf4…ed9fb/?gz=1`: the page origin is `bzz://<hash>`, relative module imports, the import map, the gzip inflate, WASM, canvas and PDF all work; `window.location.host` is the hash and there is no `/bzz/<ref>/` prefix. Rendered in 2.5 s when Freedom reused the Swarm Desktop node it found on port 1633 (its default in legacy profile mode).
- With Freedom's own Ant node (catalog profile via `FREEDOM_DEV_HOME`, ultra-light mode, no stamps, 100+ peers within 30 s): the HTML and modules loaded through Ant, but the 10.8 MB WASM fetch failed. Standalone measurement of that Ant: 20 KB in 0.8 s, 461 KB in 4.3 s, 972 KB in 7.7 s (60–125 KB/s cold); a whole-file GET of the 10.8 MB `.wasm.gz` answers 200 with the right `Content-Length` and then truncates the body at 300–430 KB, repeatably; range requests work (`206`, 1 MB in 2.1 s, 2 MB of the raw file in 28 s). So a ranged loader (1 MB pieces) would get the compiler through Ant in roughly 20–100 s cold, and Ant's disk cache makes the second load local. To report upstream to Freedom/Ant: truncated streaming of large bodies.
- `window.swarm` capabilities on a fresh profile: `canPublish: false` (`reason: not-connected`, no stamps), identity modes app-scoped, bee-wallet, ethereum-wallet; limits 10 MB per data upload, 50 MB per files upload, 4 KB chunk payload. Writes through the provider need stamps the browser holds, so swarm-collaborative-docs would need a transport that writes feeds via `window.swarm` instead of bee-js (D-02 upstream) for a no-node user.
- **Ranged loader, cold Ant (second run, reference `68f86a50…33b6`, `spikes/s1/pages/index.html` `fetchRanged`, fresh profile, Bee on 1633 declined in Freedom's "External Nodes Detected" dialog, Ant never peered with that Bee):** the page loads end to end. Compiler 10.8 MB in 11 pieces of 1 MB, two in parallel, 303 s (36 KB/s, pieces 14–66 s each); fonts 1.3 MB in 15 s; renderer 0.97 MB in 10 s; compile 252 ms, render 44 ms, PDF 86 ms; done in 333 s. Against Bee on the same machine the same loader takes 334 ms for the compiler. So Freedom works today as a no-node client, with a five-minute first load in ultra-light mode and an instant second load from Ant's disk cache; light mode with a funded wallet should lift the pseudosettle throttle, not tested. Freedom's harness script is in `spikes/freedom/run-freedom.cjs`; the Ant issue draft in `spikes/freedom/ANT-ISSUE.md`.
- Consequences: D-22 gains an option; T14 does not apply in Freedom, since every hash is its own origin; D-20's subdomain-gateway argument is the same isolation Freedom gives natively. The app must load large assets in ranges (S8): it costs nothing on Bee and is required on Ant.

## S2 — Shadow filesystem, multi-file, incremental compile

Question: what API does typst.ts 0.7 give for adding and replacing sources and binaries by path, selecting the main file, and reading diagnostics? Does anything persist between compiles (memoisation, incremental compile)?

Method: a Node or browser script that loads three `.typ` files and one PNG into the shadow filesystem, compiles, edits one file, compiles again. Time both compiles on a ~20-page document. Read the typst.ts source where the docs are thin.

Exit: a written note of the exact calls to use, and two timings (cold, warm). Target for the warm path: typst.app paints a one-page document about 110 ms after the last keystroke (`competition.md` §2.2).

Result (2026-09-05, Node 22.23, typst.ts 0.7.0, `spikes/s2/s2.mjs`, `RESULTS.json`): **answered in Node; browser numbers follow in S1.**

- typst.ts 0.7.0 embeds **Typst 0.14.2** (`sys.version`); typst.app runs 0.15.1. T12 is real from day one: pin 0.14.2 in `project.typstVersion`. Checked 2026-09-05: `0.8.0-rc3` embeds Typst 0.15.0 and fixes the `loadFonts` regression below; the renderer canvas panic and the `query` behaviour are unchanged there (`docs/upstream/typst-ts.md`).
- Calls: `createTypstCompiler()` → `init({ getModule, beforeBuild: [withAccessModel(am), withPackageRegistry(reg)] })`; sources with `addSource(path, text)`, binaries with `mapShadow(path, bytes)` / `unmapShadow`; `compile({ mainFilePath, diagnostics: 'full' })` returns `{ result: Uint8Array (vector artifact), diagnostics }`; `format: 1` gives PDF; `withIncrementalServer(s => compile({ ..., incrementalServer: s }))` keeps state in WASM and returns a delta artifact the renderer merges with `manipulateData({ action: 'merge' })`. Queries need a compiled world: `runWithWorld({ mainFilePath }, w => w.compile().then(() => w.query(...)))`; `compiler.query` alone throws "document is not compiled".
- Fonts in 0.7 go through `createTypstFontBuilder()` → `addFontData` / `addLazyFont(info, blob)` → `build(r => compiler.setFonts(r))`; the legacy `loadFonts` in `beforeBuild` is ignored by the compiler. Equations need a font with a MATH table or the compile fails with "no font could be found" on the equation line.
- Package resolution is a **synchronous** callback: `PackageRegistry.resolve(spec, ctx)` must return the package directory at once, unpacking with `ctx.untar` into the access model (`FetchPackageRegistry` uses sync XHR). S3 must fetch from Swarm synchronously inside a worker or resolve imports in a pre-pass.
- WASM: compiler 28.3 MB raw (gzip 10.8 MB, zstd 7.6 MB; design §2 said 8 MB, that was the compressed figure), renderer 0.97 MB raw (gzip 355 KB). `WebAssembly.compile` 82 ms warm in V8; compiler init 0.8 s; seven DejaVu faces (3.4 MB) added in 13 ms.
- 22-page document (two included chapters, one PNG via `mapShadow`, an outline, a table, equations): cold compile 544 ms; unchanged 72 ms; one chapter edited 105 ms; one word edited 127 ms; incremental server 77 ms then **56 ms** after a one-word edit with a 6.6 KB delta against a 232 KB full artifact. Within the 110 ms target before rendering.
- Diagnostics `'full'`: `{ package, path, severity, range "line:col-line:col" (0-based), message }`, including `hint` entries; `'unix'`: one string per item, 1-based.
- Semantic tokens: 21 token types, 632 tokens for a 100-line file in 4 ms. Highlighting can come from the compiler; a Lezer or stream grammar is still needed for the keystroke-to-paint path before the worker answers.
- `unmapShadow` of the image makes the compile fail with "failed to load file (access denied), cannot read file outside of project root", which is the message a missing blob will show.
- Not answered here: renderer to SVG and canvas (S1, S10), memory (S1).

## S3 — Package resolution hook

Question: can swarmtyp intercept `@preview/...` resolution and supply package bytes from Swarm?

Method: find where typst.ts fetches packages (its registry / access-model abstraction). Known: `packages.typst.org` allows cross-origin requests and typst.app's browser fetches `preview/<name>-<version>.tar.gz` from it directly, so the fallback needs no proxy. From S2: `PackageRegistry.resolve` is synchronous and unpacks with `ctx.untar` into the `MemoryAccessModel` shared with the compiler, so the Swarm fetch is a sync XHR inside the worker (as typst.ts's own `FetchPackageRegistry` does) or a pre-pass over `#import` lines. Prototype a resolver that maps `preview/<name>/<version>` to a Swarm collection reference and serves files from it. Test with one small package (e.g. a table or chart helper).

Exit: a document importing a package compiles with network access to `packages.typst.org` blocked.

Result (2026-09-05, Chromium, `spikes/s1/site/s3.html`, tarballs on the Swarm Desktop node as `bytes`): **answered.**

- A `PackageRegistry` of about 30 lines does it: `resolve(spec, ctx)` looks the spec up in an index (`preview/<name>/<version>` → Swarm reference), fetches the tarball with a synchronous XHR from the Bee node (`GET /bytes/<ref>`), unpacks it with `ctx.untar` into the `MemoryAccessModel` the compiler was built with (`initOptions.withAccessModel(am)`, `initOptions.withPackageRegistry(registry)`), and returns the directory. The compiler then reads the package files through the access model.
- Swarm only: `@preview/tiaoma:0.3.0` (461 KB, includes a WASM plugin, which runs) resolved in 139–153 ms and `@preview/oxifmt:1.0.0` (20 KB) in 20 ms from the local node; compile 330–601 ms cold, 3 ms warm because the unpacked files stay in the access model. The QR code rendered.
- Fallback (D-08): with oxifmt absent from the index, the same registry fetched it from `packages.typst.org` cross-origin in 107 ms; the server sends `access-control-allow-origin: *`. The registry records which source served each package, as T4 asks.
- Fallback off and package absent: the compile fails with the compiler's own message at the import line, `package not found (searched for @preview/oxifmt:1.0.0)`, which the UI can show as is.
- Costs: resolution is synchronous, so in the product it runs inside the compile worker, where synchronous XHR is allowed; on the main thread Chromium only warns. The tarball index for the mirror is one JSON or Mantaray lookup per package; the full Universe index is not needed at startup.
- D-08 can be decided once `tools/mirror` exists; the mechanism is proven.

## S4 — Fonts from Swarm

Question: which fonts does typst.ts load by default, from where, and how does swarmtyp replace that source with a Swarm collection and lazy-load only what a document uses?

Method: inspect the default font loading; upload the Typst default font set as a collection; wire it in; confirm no request goes to GitHub. Shape to match (typst.app): an index up front (86 KB compressed), faces on demand, the 1.4 MB maths font only when maths appears. typst.ts 0.7 has the API for it: `getFontInfo(bytes)` gives the index entry, `addLazyFont(info, blob)` registers a face that is fetched on first use, and `preloadFontAssets({ assetUrlPrefix })` points the default set at another host (S2). Measure bytes fetched for a plain-text document versus one that uses a maths font.

Exit: correct rendering with GitHub blocked; a size table per font family.

Result (2026-09-05, Chromium, `spikes/s4/build-index.mjs` + `spikes/s1/site/s4.html`): **answered.**

- Default fonts: typst.ts's `preloadFontAssets` fetches its set from GitHub/jsdelivr; swarmtyp passes `beforeBuild: []` and registers its own faces, so no request leaves for GitHub.
- Index: a Node script runs `createTypstFontBuilder().getFontInfo(bytes)` per face (family, variant, flags, coverage), uploads each face to Swarm as `bytes`, and writes `fonts-index.json`: seven DejaVu faces, 8.6 KB of index for 3.47 MB of fonts.
- Lazy registration: `fb.addLazyFont(entry.info, loadFontSync({ info, url: bee + '/bytes/' + ref }))` for all seven took 9 ms and fetched nothing. `loadFontSync` (typst.ts `init.mjs`) does a synchronous XHR on first use, the same pattern as packages (S3).
- What a document pulls: text with a heading fetched Serif regular and bold (737 KB, 27 and 21 ms from the local node); adding italic and an equation fetched Serif italic and the maths face (924 KB); a second compile fetched nothing. Sans and Mono were never downloaded. Compile times 284 and 307 ms including the fetches, 3 ms warm.
- Size table (DejaVu, from the index): Serif 381 KB, Serif Bold 357 KB, Serif Italic 347 KB, Sans 760 KB, Sans Bold 709 KB, Sans Mono 343 KB, Math TeX Gyre 577 KB. The Typst default set (Libertinus, New Computer Modern incl. Math 1.4 MB, DejaVu Sans Mono) goes through the same pipeline in `tools/deploy`.
- Note: the default maths font must be a face with a MATH table; the heading in a text-only document already costs the bold face, which is fine.

## S5 — swarm-collaborative-docs with CodeMirror 6

Question: does `SwarmDoc` with `createSwarmRtcTransport` work with `y-codemirror.next`, across two networks, and what does an hour of editing cost in stamp?

Method: two laptops on different networks, one gateway Bee, a shared topic. Checked 2026-09-05 before starting: the library is **not on npm**; install from `github:Solar-Punk-Ltd/swarm-collaborative-docs` (default branch `master`, version 0.0.1). It builds CommonJS only (`dist/SwarmCollaborativeDocs.cjs.js`), depends on a bee-js fork (`github:Apiary-Suite/bee-js`, 12.2.1), and lists Monaco, React 19, y-webrtc and the Waku SDK as hard dependencies, so an install pulls all of them. First upstream asks: publish to npm, ESM build, move the example app's dependencies to devDependencies. Bind `swarmDoc.doc.getText('main.typ')` to CodeMirror. Bridge `AWARENESS_UPDATED` into cursors (either a local y-protocols `Awareness` or manual decorations). Type for ten minutes; log delta latency, snapshot frequency, and chunk count / stamp use from the Bee node. Check multi-file (`getText` per path) and the `files` Y.Map.

Exit: latency and cost numbers; a recommendation on debounce interval; a decision on the cursor approach.

Result (2026-09-05, two Chromium tabs on one machine, both hidden, Swarm Desktop Bee 2.8.2 on mainnet, `spikes/s5/app`, library built from `master` adcb7d5 with two local patches: `yjs` made external, pnpm `allowBuilds` for the bee-js fork): **works end to end; numbers below are loopback and one Bee node, so network latency is not measured yet.**

- Binding: `yCollab(swarmDoc.doc.getText('main.typ'), null, { undoManager })` on CodeMirror 6 works with no awareness object; typing in one tab appears in the other. Cursors arrive as `AWARENESS_UPDATED` `{ address, username, cursor }` every 500 ms; the remote-selection decorations are ours to draw (design §4.1, as the Monaco example does).
- Delta latency, Alice → Bob over the WebRTC data channel, Date.now on both sides: 2, 7, 2, 0, 0 ms for five single characters; a 40-character burst arrived character by character with no backlog. Deltas are sent at once; the 500 ms debounce applies to snapshot writes.
- Cost: Alice's 45 characters over about 60 s caused 6 snapshot writes, each `POST /bytes` + `POST /soc` (one chunk each for a 136-character document), so about 12 chunks per minute of typing; Bob, only reading, wrote nothing. Joining writes 2–3 SOCs (member entry, signalling). Reads: `GET /feeds` every 5 s per peer (member polling), a few `GET /chunks` and `/bytes` on join. On a depth-20 batch this is noise; the debounce can stay at 500 ms.
- Join and reconnect: a new peer sees the member list in 2 s and the other peer's snapshot in about 10 s; the other peer notices the newcomer within the 5 s poll. The WebRTC channel took 27–65 s to open with both tabs hidden (Chromium throttles timers to once a second in hidden tabs, and signalling polls feeds); measure again with visible tabs and across two networks.
- Reload (both tabs at once): each peer restored its own last snapshot in 2–5 s and the merged state in 10 s; nothing was lost. Bob's own snapshot held only his edits (31 chars) until Alice's snapshot arrived, so a peer's feed does not carry remote edits; the merge does.
- `PEERS_CONNECTED` fires once the transport is ready even with zero peers; treat `MEMBERS_UPDATED` as the presence signal.
- Upstream asks recorded for D-02: publish to npm, ESM entry in `package.json`, `yjs` as a peer dependency (two copies break the CRDT), move Monaco, React and Waku out of `dependencies` (the library bundle is 1.75 MB with Waku inside), a `stamp` hook (dappdata D19), Node 24 engine pin is stricter than needed. Cursor decision: draw remote cursors ourselves from `AWARENESS_UPDATED`.
- Not yet: two networks, visible-tab reconnect time, multi-file (`getText` per path) in the same session, the `files` map.

## S6 — One key, two sessions

Question: what happens when the same identity runs in two tabs or on two devices and both write `<topic>_doc<address>`?

Method: open the same project twice with the same key; edit in both; observe the feed index and whether either session loses updates or corrupts the feed. Try a per-session sub-key (derive from the identity key plus a session id) and observe again.

Exit: a description of the failure (if any) and the mitigation swarmtyp will use; an upstream issue or PR if the fix belongs in the library.

Result (2026-09-05, a third tab with Alice's key as "Alice2", `spikes/s5/app`): **silent divergence, no error.** The member list is keyed by address, so neither Bob nor the first Alice tab sees a new member and Alice2 sees only Bob; Alice2 never gets a WebRTC channel (`<topic>_signal` records for one address collide) and `PEERS_CONNECTED` never fires; both Alice tabs write snapshots to the same `<topic>_doc<address>` feed with independent index counters. After each Alice tab typed once, all three documents were 147 characters long with three different contents: Alice1 and Bob held "[A1 edit]", Alice2 held "[A2 edit]"; no `DOC_ERROR` anywhere. T11 confirmed.

Mitigation swarmtyp will use: a per-session signing key derived from the identity key plus a random session id (dappdata's D17 sub-key pattern), so every session owns its own `_doc` and `_signal` feeds; the nickname stays the same and the UI groups addresses by identity. Cost: the member list grows by one entry per session and a joiner reads one snapshot per entry, so stale entries need pruning. Upstream (D-02): a `sessionId` in `DocSettings` that suffixes the doc and signal feed names while members are keyed by identity, and a `DOC_ERROR` when a feed write lands on an index that already exists.

## S7 — Bee from the browser

Question: which Bee endpoints does the whole stack need (feeds, bytes, soc, tags), do they work cross-origin from a `bzz` origin against a local Bee (Swarm Desktop) and against a gateway, and how does a gateway stamp on the user's behalf?

Method: list endpoint calls from S1–S5 logs; test CORS with the local node's default config and with Swarm Desktop; talk to whoever runs the Solar Punk gateway about sponsored stamping.

Exit: a table of endpoints × origin × works/needs config; a stamping plan for the gateway mode.

Result (partial, 2026-09-05): Swarm Desktop's Bee 2.8.2 answers cross-origin requests from any origin (`Access-Control-Allow-Origin` echoes the request origin, credentials allowed, all Swarm headers listed, preflight 204), so a `bzz`-hosted page can call the local node without configuration. Endpoints used so far, all cross-origin from a `bzz` or Vite origin against the Desktop node: `POST /bzz` (collection upload, 42 MB in 30 s), `GET /bzz/<ref>/<path>`, `POST /bytes` and `GET /bytes/<ref>` (packages, fonts, snapshots), `POST /soc` and `GET /feeds` (the collaboration library's feeds), `GET /chunks`, `GET /stamps`, `GET /health`, `GET /tags`. Cross-origin detail found in Phase 1: Bee's CORS exposes only `Content-Disposition`, so a page on another origin (a `bzz://` page in Freedom talking to a Bee on `127.0.0.1:1633`) cannot read `Content-Range`, `ETag` or `Accept-Ranges`; a ranged loader must cope with an unknown total (`src/compile/ranged.ts` walks pieces until a short one). Ant exposes them. Worth a small Bee issue (`Access-Control-Expose-Headers`). Stamping plan for users without a node: dappdata's D3/D12 model (batch owned by a derived key, stamps signed in the browser, uploaded through any CORS-enabled node) once swarm-collaborative-docs accepts a stamp hook; until then the sponsoring-gateway mode of D-07. No public gateway renders apps today (D-22).

## S8 — Deploy pipeline and first load

Question: how long does the app take to become usable from a gateway on a normal connection, and does the deploy script (upload collection, advance feed, feed manifest) work end to end?

Method: `tools/deploy` prototype with bee-js; deploy the S1 page plus fonts; measure time-to-first-render cold and with a warm cache from three locations.

Exit: numbers; a list of what to defer or split to get under a target you set (suggest: usable within 10 s on 50 Mbit/s cold). Reference: typst.app ships about 9 MB compressed before fonts and fires `load` after 1.9 s with a warm cache (`competition.md` §2.2).

Result (partial, 2026-09-05): Bee serves stored bytes as they are, no compression, so the compiler WASM is 28.3 MB on the wire unless swarmtyp compresses it itself. Storing `typst_ts_web_compiler_bg.wasm.gz` (10.8 MB) and inflating with `DecompressionStream('gzip')` works from a `bzz` address (S1). zstd would give 7.6 MB but needs a decoder in JS; brotli about 7.5 MB, same. Remaining: the deploy script and timings over a gateway.

## S9 — PDF export in the browser

Question: does typst.ts produce a PDF in the worker for a 20-page document with images, and how long does it take?

Method: extend S2; call the PDF exporter; save the file; open it.

Exit: a valid PDF and a timing.

Result (2026-09-05): **answered.** Node: `compile({ format: 1 })` on the S2 22-page document with an image produced a valid PDF-1.7 of 190 KB in 154 ms (`spikes/s2/out.pdf`). Browser (S1 page from the `bzz` address): the one-page document exported a 25.6 KB PDF in 169 ms, offered as a download link. Not yet from inside a worker, which changes nothing about the call.

## S10 — Preview renderer: canvas vs SVG (D-17)

Question: does typst.ts's canvas renderer give a preview good enough to be the default (text sharpness at 100–200 %, zoom behaviour, DPR 2, memory on a 20-page document), and how do its latency and memory compare with the SVG renderer?

Method: extend S2. Render the same 20-page document both ways; measure time from compiled artifact to painted page, memory, and behaviour on zoom and on a high-DPI display. Check whether the canvas path re-renders on zoom or scales pixels. Confirm that on the canvas path no SVG from the document reaches the DOM.

Exit: a table (renderer × metric); a recommendation for D-17.

Result (2026-09-05, Chromium, main thread, hidden tab, `spikes/s1/site/s10.html`, the S2 22-page A4 document, artifact 224 KB):

| Renderer | Produce | Put on screen | Memory | Zoom |
|---|---|---|---|---|
| SVG (`renderSvg`, whole document) | 173 ms, 4.7 MB of SVG text | `innerHTML` 0.85–1.2 s for 22 pages | JS heap +25 MB; DOM holds 4.7 MB of markup | free, vector |
| Canvas (`renderCanvas` per page, one session) | first page after 97–141 ms; 22 pages in 2.6–4.2 s (about 120–190 ms per page) | immediate per page | 168 MB of pixels at 2 px/pt, 379 MB at 3 px/pt (22 canvases) | re-render, 3.0 s for 22 pages at 3 px/pt |

- Both modes must render only the pages in view. The SVG string for a long document is too big to insert whole, and canvases for every page do not fit in memory; per visible page, canvas costs about 120 ms and SVG about 8 ms plus insertion. The renderer also offers `renderSvgDiff` and session `manipulateData({ action: 'merge' })` for the S2 incremental deltas, not measured here.
- `renderToCanvas` (the convenience call) renders every page inside `requestAnimationFrame` and adds a DOM text layer for selection; in a hidden tab it stalls until the tab is shown (S1). Per-page `renderCanvas` with an explicit 2D context does not wait for a frame.
- Upstream bug: `renderCanvas` accepts `HTMLCanvasElement | CanvasRenderingContext2D` by its types, but an element makes the WASM panic (`RuntimeError: unreachable`); pass `canvas.getContext('2d')`. Also set `session.pixelPerPt` and `session.backgroundColor` as typst.ts's own code does.
- Recommendation for D-17: canvas for the live preview of visible pages (2–3 pages, about 300 ms after a compile, no markup reaches the DOM), rendered in a worker with `OffscreenCanvas` (`TypstWorker.renderCanvas` exists) so hidden tabs and the main thread stop mattering; SVG for export and for a print-quality zoom. Confirm with Firefox before closing.

## S11 — Websites on Swarm from swarmtyp (D-24)

Question: can a published document be a Swarm website that ordinary visitors can open by name, and can Typst's HTML export run in the browser build?

Method: (1) publish a two-page starter as a collection (`index.html`, SVG pages, PDF) with the release tooling; open it in Freedom by reference and through `bzz.link` and `<name>.gwei.domains` (a `.gwei` test name, or a free `.id.gwei` subname, with its contenthash set to the collection's feed manifest); record which gateways render a static site, given that D-22 found they refuse apps. (2) Check whether `typst-ts-web-compiler` 0.7/0.8 exposes the HTML exporter (the CLI has it; the web typings in 0.7.0 do not mention it); if not, estimate the upstream change. (3) Compile a `target()`-aware sample to HTML with the Typst CLI and note what a swarmtyp stylesheet must cover (headings, figures, math as SVG or MathML, code, footnotes).

Exit: a table of gateways versus rendering; yes/no on HTML export in the web build with an upstream issue if no; a list of what the stylesheet needs; a go/no-go for the paged site as the first release.

Result, part 1 (2026-09-05, `spikes/s11/build-site.mjs`, `spikes/s1/site/s11.html`): **a paged site works today; public gateways behave as D-22 found, with two named exceptions.** The browser compiler produced a two-page document (equation, footnote, page numbers) as one SVG (165 KB) plus the PDF (68 KB); a static `index.html` with the SVG inline and a PDF link was uploaded as a collection (`acee373d…19bf`, 235 KB). Found on the way: typst.ts's `renderSvg` output is not well-formed XML because its inline `<script>` contains unescaped `&&`; served as a standalone `image/svg+xml` file, Freedom and Chromium stop at the first bare `&` and render only the first page (`xmlParseEntityRef: no name`). Stripping the script (it only drives text selection in the live preview) fixes it and the file parses as XML; inlining the SVG in the HTML avoids the issue as well. Upstream: typst.ts #891.

| Where | Result for a static site by reference |
|---|---|
| Local Bee (`127.0.0.1:1633/bzz/<ref>/`) | renders, 2 pages, PDF link, no failed requests |
| Freedom Browser (`bzz://<ref>/`, fresh profile, bundled Ant) | renders both pages with the equation in 4–6 s once Ant is up (235 KB; Ant itself took about 2 min to start), per-hash origin, no parse error after the script strip |
| `download.gateway.ethswarm.org/bzz/<ref>/` | 200 with correct types, but `Content-Disposition: attachment` on every file, including `.svg`: browsers download, nothing renders |
| `bzz.link/bzz/<ref>/`, `<cid>.bzz.link`, `api.gateway.ethswarm.org`, `gateway.fairdatasociety.org` | 302 to `bzz.link/forbidden?hash=…`, an approval form; its text: hashes registered with ENS "can always be accessed via bzz.link subdomains, for example myensname.bzz.link", so an ENS name with a Swarm contenthash bypasses the allow-list |
| `gateway.ethswarm.org/bzz/<ref>/` | 200 but the gateway's own landing page, not the content |
| `https://swarmtyp.gwei.domains/` (the owner registered `swarmtyp.gwei`, 0.0005 ETH plus gas, and set its website to the site's feed manifest) | **renders in an ordinary browser**: 200, `text/html` inline, both pages, the PDF served as `application/pdf` inline, no failed requests; Cloudflare in front (`cache-control: public, max-age=300`, `cf-cache-status: HIT`); its source says it proxies `download.gateway.ethswarm.org` with the attachment header removed |
| Freedom Browser, `bzz://swarmtyp.gwei/` | resolves the GNS contenthash itself (`src/main/ens-resolver.js`, GNS NameNFT contract) and renders in 8 s once Ant is up; origin `bzz://swarmtyp.gwei`; showed revision 2 immediately after the feed update, since it reads the feed live |
| Update delay after a feed update (revision 2, feed advanced 16:56:15 UTC) | local node through the manifest: 25 s; Freedom: immediate; `swarmtyp.gwei.domains`: 3 min 32 s (first poll to show it at 16:59:47 UTC; bounded by the 5 min edge cache plus the download gateway's feed lookup) |

Consequences for D-24: the paged site is a go for Phase 3; a name is not a nicety but the only way ordinary browsers reach the site (ENS via `<name>.bzz.link`, GNS via `<name>.gwei.domains`, the latter proven with `swarmtyp.gwei`); both gateways are operated by others and proxy through `download.gateway.ethswarm.org`, so availability follows that gateway (D-22). The whole chain now exists end to end: compile in the browser, upload a collection, advance a feed, name bound once to the feed manifest, site readable in Brave, Chromium and Freedom, updates without a transaction. To finish the table: register one `.gwei` test name (owner's wallet, under a dollar) or claim a free `.id.gwei` subname (gas only), and one ENS subname if available, point them at the site's feed manifest, and record whether the pages render and how long an update takes to show (5 min cache on gwei.domains). Prepared 2026-09-05 (`spikes/s11/site-feed.mjs`): the site has a feed manifest `fff4e38e…2910` (topic `swarmtyp/s11-site`, key `S11_SITE_FEED_KEY` in `.env.local`) that resolves on the local node; the value to paste as the name's contenthash is `bzz://fff4e38ecaeb5253c1c7eae0e24daf655cc9ae995df806e507af0094de072910`. Claiming and setting contenthash are wallet transactions on Ethereum mainnet and are the owner's to do.

Result, part 2 (2026-09-05): **HTML export is not in the web build.** `typst-ts-web-compiler` on `main` accepts `fmt` of `vector` or `pdf` only (`packages/compiler/src/lib.rs`), the JS wrapper's `CompileFormatEnum` is `vector | pdf`, and the crate's features list `pdf`, `svg`, `ast` but no `html`; the `html` feature (`typst-html` + `typst-svg`) exists in `reflexo-typst` and is on by default only in the CLI. Exposing it in the web compiler is a feature flag plus a `"html"` arm and a wasm size cost; asked upstream (typst.ts #892) before deciding whether swarmtyp builds its own compiler variant (D-04 keeps that door open).

Result, part 3 (2026-09-05): **not run, by decision.** Typst GmbH is building HTML export itself: tracking issue typst/typst#5512 (NLnet-funded, six months of full-time work), the roadmap lists "HTML export (in progress)", and 0.15.0 (2026-06-15) added MathML for equations, `lang` on the root element, image dimensions, and an experimental "bundle" export that writes several output files from one project. Still open there: CSS (deferred to a later phase, with the stated plan to emit CSS from set rules as an option), shapes and curves, and any timeline for leaving the feature flag. The owner's call: do not build what Typst is building. swarmtyp's flowing site waits for the exporter; when it leaves the flag, the work on our side is the typst.ts web-build flag (part 2) and a thin stylesheet or Typst's own CSS option. Watch #5512 and the 0.16 notes.

