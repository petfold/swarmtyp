# Phase 0 spikes

Each spike answers one question. Write the result under **Result** in this file, dated, with numbers where you measured any. A spike that changes the design also edits `design.md` and adds a line to `decisions.md`.

Environment for all spikes: Node 22+, a Bee 2.8.x light node (local, or Bee Factory for a whole test network), `@ethersphere/bee-js` 12.x, typst.ts 0.7.x. Note exact versions in each result.

---

## S1 — typst.ts from a Swarm address

Question: do the compiler and renderer WASM modules load and run when the page and the `.wasm` files are served from `/bzz/<ref>/…` through a Bee node?

Method: build the smallest page that compiles "Hello" with `$typst.svg`, upload it as a collection, open it via the local Bee and via a public gateway. Check the `Content-Type` the manifest serves for `.wasm`. Try `instantiateStreaming`; if it fails, fall back to `instantiate` on an ArrayBuffer. typst.ts's WASM uses no threads, so no COOP/COEP headers are needed; note it if that changes (a service worker can inject them, as typst.app does).

Exit: renders in Firefox and Chromium from both origins; note load time and total bytes.

Result: —

## S2 — Shadow filesystem, multi-file, incremental compile

Question: what API does typst.ts 0.7 give for adding and replacing sources and binaries by path, selecting the main file, and reading diagnostics? Does anything persist between compiles (memoisation, incremental compile)?

Method: a Node or browser script that loads three `.typ` files and one PNG into the shadow filesystem, compiles, edits one file, compiles again. Time both compiles on a ~20-page document. Read the typst.ts source where the docs are thin.

Exit: a written note of the exact calls to use, and two timings (cold, warm). Target for the warm path: typst.app paints a one-page document about 110 ms after the last keystroke (`competition.md` §2.2).

Result: —

## S3 — Package resolution hook

Question: can swarmtyp intercept `@preview/...` resolution and supply package bytes from Swarm?

Method: find where typst.ts fetches packages (its registry / access-model abstraction). Known: `packages.typst.org` allows cross-origin requests and typst.app's browser fetches `preview/<name>-<version>.tar.gz` from it directly, so the fallback needs no proxy. Prototype a resolver that maps `preview/<name>/<version>` to a Swarm collection reference and serves files from it. Test with one small package (e.g. a table or chart helper).

Exit: a document importing a package compiles with network access to `packages.typst.org` blocked.

Result: —

## S4 — Fonts from Swarm

Question: which fonts does typst.ts load by default, from where, and how does swarmtyp replace that source with a Swarm collection and lazy-load only what a document uses?

Method: inspect the default font loading; upload the Typst default font set as a collection; wire it in; confirm no request goes to GitHub. Shape to match (typst.app): an index up front (86 KB compressed), faces on demand, the 1.4 MB maths font only when maths appears. Measure bytes fetched for a plain-text document versus one that uses a maths font.

Exit: correct rendering with GitHub blocked; a size table per font family.

Result: —

## S5 — swarm-collaborative-docs with CodeMirror 6

Question: does `SwarmDoc` with `createSwarmRtcTransport` work with `y-codemirror.next`, across two networks, and what does an hour of editing cost in stamp?

Method: two laptops on different networks, one gateway Bee, a shared topic. Bind `swarmDoc.doc.getText('main.typ')` to CodeMirror. Bridge `AWARENESS_UPDATED` into cursors (either a local y-protocols `Awareness` or manual decorations). Type for ten minutes; log delta latency, snapshot frequency, and chunk count / stamp use from the Bee node. Check multi-file (`getText` per path) and the `files` Y.Map.

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

Result: —

## S8 — Deploy pipeline and first load

Question: how long does the app take to become usable from a gateway on a normal connection, and does the deploy script (upload collection, advance feed, feed manifest) work end to end?

Method: `tools/deploy` prototype with bee-js; deploy the S1 page plus fonts; measure time-to-first-render cold and with a warm cache from three locations.

Exit: numbers; a list of what to defer or split to get under a target you set (suggest: usable within 10 s on 50 Mbit/s cold). Reference: typst.app ships about 9 MB compressed before fonts and fires `load` after 1.9 s with a warm cache (`competition.md` §2.2).

Result: —

## S9 — PDF export in the browser

Question: does typst.ts produce a PDF in the worker for a 20-page document with images, and how long does it take?

Method: extend S2; call the PDF exporter; save the file; open it.

Exit: a valid PDF and a timing.

Result: —

## S10 — Preview renderer: canvas vs SVG (D-17)

Question: does typst.ts's canvas renderer give a preview good enough to be the default (text sharpness at 100–200 %, zoom behaviour, DPR 2, memory on a 20-page document), and how do its latency and memory compare with the SVG renderer?

Method: extend S2. Render the same 20-page document both ways; measure time from compiled artifact to painted page, memory, and behaviour on zoom and on a high-DPI display. Check whether the canvas path re-renders on zoom or scales pixels. Confirm that on the canvas path no SVG from the document reaches the DOM.

Exit: a table (renderer × metric); a recommendation for D-17.

Result: —
