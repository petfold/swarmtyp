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
- Open: a public gateway (`download.gateway.ethswarm.org`, `api.gateway.ethswarm.org`, `gateway.fairdatasociety.org`, `bzz.link` all 404 minutes after upload; `gateway.ethswarm.org` now serves a landing page for any path) — retry once push-sync completes; Firefox (the snap build cannot run headless here; use Playwright in S8).

## S2 — Shadow filesystem, multi-file, incremental compile

Question: what API does typst.ts 0.7 give for adding and replacing sources and binaries by path, selecting the main file, and reading diagnostics? Does anything persist between compiles (memoisation, incremental compile)?

Method: a Node or browser script that loads three `.typ` files and one PNG into the shadow filesystem, compiles, edits one file, compiles again. Time both compiles on a ~20-page document. Read the typst.ts source where the docs are thin.

Exit: a written note of the exact calls to use, and two timings (cold, warm). Target for the warm path: typst.app paints a one-page document about 110 ms after the last keystroke (`competition.md` §2.2).

Result (2026-09-05, Node 22.23, typst.ts 0.7.0, `spikes/s2/s2.mjs`, `RESULTS.json`): **answered in Node; browser numbers follow in S1.**

- typst.ts 0.7.0 embeds **Typst 0.14.2** (`sys.version`); typst.app runs 0.15.1. T12 is real from day one: pin 0.14.2 in `project.typstVersion`.
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

Result: —

## S4 — Fonts from Swarm

Question: which fonts does typst.ts load by default, from where, and how does swarmtyp replace that source with a Swarm collection and lazy-load only what a document uses?

Method: inspect the default font loading; upload the Typst default font set as a collection; wire it in; confirm no request goes to GitHub. Shape to match (typst.app): an index up front (86 KB compressed), faces on demand, the 1.4 MB maths font only when maths appears. typst.ts 0.7 has the API for it: `getFontInfo(bytes)` gives the index entry, `addLazyFont(info, blob)` registers a face that is fetched on first use, and `preloadFontAssets({ assetUrlPrefix })` points the default set at another host (S2). Measure bytes fetched for a plain-text document versus one that uses a maths font.

Exit: correct rendering with GitHub blocked; a size table per font family.

Result: —

## S5 — swarm-collaborative-docs with CodeMirror 6

Question: does `SwarmDoc` with `createSwarmRtcTransport` work with `y-codemirror.next`, across two networks, and what does an hour of editing cost in stamp?

Method: two laptops on different networks, one gateway Bee, a shared topic. Checked 2026-09-05 before starting: the library is **not on npm**; install from `github:Solar-Punk-Ltd/swarm-collaborative-docs` (default branch `master`, version 0.0.1). It builds CommonJS only (`dist/SwarmCollaborativeDocs.cjs.js`), depends on a bee-js fork (`github:Apiary-Suite/bee-js`, 12.2.1), and lists Monaco, React 19, y-webrtc and the Waku SDK as hard dependencies, so an install pulls all of them. First upstream asks: publish to npm, ESM build, move the example app's dependencies to devDependencies. Bind `swarmDoc.doc.getText('main.typ')` to CodeMirror. Bridge `AWARENESS_UPDATED` into cursors (either a local y-protocols `Awareness` or manual decorations). Type for ten minutes; log delta latency, snapshot frequency, and chunk count / stamp use from the Bee node. Check multi-file (`getText` per path) and the `files` Y.Map.

Exit: latency and cost numbers; a recommendation on debounce interval; a decision on the cursor approach.

Result: —

## S6 — One key, two sessions

Question: what happens when the same identity runs in two tabs or on two devices and both write `<topic>_doc<address>`?

Method: open the same project twice with the same key; edit in both; observe the feed index and whether either session loses updates or corrupts the feed. Try a per-session sub-key (derive from the identity key plus a session id) and observe again.

Exit: a description of the failure (if any) and the mitigation swarmtyp will use; an upstream issue or PR if the fix belongs in the library.

Result: —

## S7 — Bee from the browser

Question: which Bee endpoints does the whole stack need (feeds, bytes, soc, tags), do they work cross-origin from a `bzz` origin against a local Bee (Swarm Desktop) and against a gateway, and how does a gateway stamp on the user's behalf?

Method: list endpoint calls from S1–S5 logs; test CORS with the local node's default config and with Swarm Desktop; talk to whoever runs the Solar Punk gateway about sponsored stamping.

Exit: a table of endpoints × origin × works/needs config; a stamping plan for the gateway mode.

Result (partial, 2026-09-05): Swarm Desktop's Bee 2.8.2 answers cross-origin requests from any origin (`Access-Control-Allow-Origin` echoes the request origin, credentials allowed, all Swarm headers listed, preflight 204), so a `bzz`-hosted page can call the local node without configuration. Endpoints used so far: `POST /bzz` (collection upload, 42 MB in 30 s), `GET /bzz/<ref>/<path>`, `GET /stamps`, `GET /health`, `GET /tags`. dappdata's D3/D12 add `POST /soc` for client-side stamped writes.

## S8 — Deploy pipeline and first load

Question: how long does the app take to become usable from a gateway on a normal connection, and does the deploy script (upload collection, advance feed, feed manifest) work end to end?

Method: `tools/deploy` prototype with bee-js; deploy the S1 page plus fonts; measure time-to-first-render cold and with a warm cache from three locations.

Exit: numbers; a list of what to defer or split to get under a target you set (suggest: usable within 10 s on 50 Mbit/s cold). Reference: typst.app ships about 9 MB compressed before fonts and fires `load` after 1.9 s with a warm cache (`competition.md` §2.2).

Result (partial, 2026-09-05): Bee serves stored bytes as they are, no compression, so the compiler WASM is 28.3 MB on the wire unless swarmtyp compresses it itself. Storing `typst_ts_web_compiler_bg.wasm.gz` (10.8 MB) and inflating with `DecompressionStream('gzip')` works from a `bzz` address (S1). zstd would give 7.6 MB but needs a decoder in JS; brotli about 7.5 MB, same. Remaining: the deploy script and timings over a gateway.

## S9 — PDF export in the browser

Question: does typst.ts produce a PDF in the worker for a 20-page document with images, and how long does it take?

Method: extend S2; call the PDF exporter; save the file; open it.

Exit: a valid PDF and a timing.

Result (partial, 2026-09-05, Node): `compile({ format: 1 })` on the S2 22-page document with an image produced a valid PDF-1.7 of 190 KB in 154 ms (`spikes/s2/out.pdf`). Remaining: the same call from the worker in the browser (S1 page).

## S10 — Preview renderer: canvas vs SVG (D-17)

Question: does typst.ts's canvas renderer give a preview good enough to be the default (text sharpness at 100–200 %, zoom behaviour, DPR 2, memory on a 20-page document), and how do its latency and memory compare with the SVG renderer?

Method: extend S2. Render the same 20-page document both ways; measure time from compiled artifact to painted page, memory, and behaviour on zoom and on a high-DPI display. Check whether the canvas path re-renders on zoom or scales pixels. Confirm that on the canvas path no SVG from the document reaches the DOM.

Exit: a table (renderer × metric); a recommendation for D-17.

Result: —
