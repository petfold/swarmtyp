# Upstream issues for typst.ts (drafts)

Target: https://github.com/Myriad-Dreamin/typst.ts (single maintainer; be concise, include a runnable reproduction). Evidence from spikes S1, S2, S4, S10 on 2026-09-05 with `@myriaddreamin/typst.ts`, `typst-ts-web-compiler` and `typst-ts-renderer` 0.7.0 (Typst 0.14.2), Chromium and Node 22. Re-checked against `v0.8.0-rc3` on 2026-09-05 (compiler embeds Typst 0.15.0): item 1 reproduces with a precise panic (`canvas.rs:32`), items 3, 4, 6, 7 unchanged, item 2 (`loadFonts` in `beforeBuild`) is fixed in rc3 and was not filed. Filed the same day:

- Issue 1 → https://github.com/Myriad-Dreamin/typst.ts/issues/888
- Issue 4 → https://github.com/Myriad-Dreamin/typst.ts/issues/889
- Issues 6 and 7 plus the `loadFontSync` export → https://github.com/Myriad-Dreamin/typst.ts/issues/890 (one docs issue)
- Issue 3 → comment on #832: https://github.com/Myriad-Dreamin/typst.ts/issues/832#issuecomment-5551091516
- Issue 5 → comments on #634 and #763: https://github.com/Myriad-Dreamin/typst.ts/issues/634#issuecomment-5551091981, https://github.com/Myriad-Dreamin/typst.ts/issues/763#issuecomment-5551092071

---

## 1. `renderCanvas` panics (`RuntimeError: unreachable`) when `canvas` is an `HTMLCanvasElement`

**Version.** typst-ts-renderer 0.7.0, Chromium 15x.

**Steps.**
```js
const renderer = createTypstRenderer(); await renderer.init({ getModule: () => rendererWasmUrl });
await renderer.runWithSession(async (session) => {
  renderer.manipulateData({ renderSession: session, action: 'reset', data: vectorArtifact });
  const c = document.createElement('canvas'); c.width = 1191; c.height = 1684;
  await renderer.renderCanvas({ renderSession: session, canvas: c, pageOffset: 0, pixelPerPt: 2 });
});
```

**Observed.** `RuntimeError: unreachable` from `render_page_to_canvas` (stack through `typst_ts_renderer.mjs` `real` → wasm). With `canvas: c.getContext('2d')` and `session.pixelPerPt = 2; session.backgroundColor = '#ffffff'` set first, the same call renders.

**Expected.** `RenderCanvasOptions.canvas` is typed `HTMLCanvasElement | CanvasRenderingContext2D`; either accept the element (call `getContext('2d')` in JS, as `renderDisplayLayer` does) or narrow the type and throw a JS error instead of a WASM trap.

---

## 2. `loadFonts` in `beforeBuild` no longer affects the compiler in 0.7 (not filed: fixed in 0.8.0-rc3)

**Steps.** `createTypstCompiler().init({ getModule, beforeBuild: [loadFonts([bytesOfDejaVuSerif])] })`, then compile a document that sets `font: "DejaVu Serif"`.

**Observed.** `no font could be found` (also a deprecation warning "using deprecated parameters for the initialization function"). The same bytes via `createTypstFontBuilder()` → `addFontData` → `build(r => compiler.setFonts(r))` work.

**Expected.** Either `loadFonts` in `beforeBuild` should still feed the compiler's font resolver, or it should throw or warn that fonts must go through `TypstFontBuilder` now, and the README / `options.init.d.mts` examples (which still show `loadFonts` for `init`) should say so. Also worth documenting: an equation needs a face with a MATH table registered or the compile fails on that line with the same message.

---

## 3. `compiler.query()` throws "document is not compiled" (comment on #832)

`TypstCompiler.query(options)` runs `runWithWorld` and calls `world.query` on a world that was never compiled, so it always throws `document is not compiled`. What works:
```js
await compiler.runWithWorld({ mainFilePath }, async (w) => { await w.compile(); return w.query({ selector, field }); });
```
Suggest either compiling inside `query()` when the world has no document yet, or documenting the two-step form; #832 is the same confusion.

---

## 4. `renderToCanvas` waits for `requestAnimationFrame` per page, so it stalls in hidden tabs

`renderDisplayLayer` wraps every page in `inAnimationFrame`. In a background tab `requestAnimationFrame` does not fire, so `renderToCanvas` on a one-page document took 18 s and 81 s (until the tab was shown) while the second call took 31 ms; `renderCanvas` with an explicit 2D context has no such dependency. Suggest an option to skip the frame wait (or use `setTimeout` when `document.hidden`), and a note in the docs.

---

## 5. Fonts on demand from your own host (comment on #763 and #634)

Working recipe with 0.7.0, for the threads asking for it: build an index offline with `createTypstFontBuilder().getFontInfo(bytes)` per face (7 DejaVu faces → 8.6 KB of JSON for 3.5 MB of fonts), upload the faces anywhere, then in the page `fb.addLazyFont(entry.info, loadFontSync({ info: entry.info, url }))` for every entry and `fb.build(r => compiler.setFonts(r))`. Registration of 7 faces took 9 ms and fetched nothing; a text-only document then pulled 2 faces, one with maths 2 more, the rest never. `loadFontSync` is exported from `init.mjs`; it does a synchronous XHR on first use, which is fine inside a worker. Two doc requests: export `loadFontSync` from the package root, and state that `preloadFontAssets({ assetUrlPrefix })` is the way to move the default set off GitHub.

---

## 6. Package registry: `resolve` is synchronous, document the contract and export `untar`

`PackageRegistry.resolve(spec, ctx)` must return the package directory synchronously and unpack with `ctx.untar` into the `MemoryAccessModel` passed to `withAccessModel`. That works (a 30-line registry served packages from another host, including a package with a WASM plugin), but nothing in the README says the call is synchronous or that `resolve` must write into the same access model the compiler reads. A short section, plus the note that `FetchPackageRegistry` uses a synchronous XHR and therefore belongs in a worker, would save the next integrator a source read.

---

## 7. Docs: bare specifiers in the ESM build

`dist/esm/*.mjs` imports `@myriaddreamin/typst-ts-web-compiler` and `@myriaddreamin/typst-ts-renderer` by bare specifier via dynamic `import()`, so the ESM build cannot be served as plain files without an import map or a bundler. Not a bug, but a one-line note in the README (with the import map) would help people deploying to static hosts.

---

## Standalone SVG output is not well-formed XML (unescaped `&` in the inline script)

Filed: https://github.com/Myriad-Dreamin/typst.ts/issues/891 (2026-09-05, typst.ts 0.7.0, S11). `renderSvg({ format: 'vector' })` returns an SVG whose inline `<script type="text/javascript">` contains `&&` and other bare ampersands; `<` and `>` are escaped, `&` is not. Inserted with `innerHTML` (the HTML parser) it works, which is how the examples use it. Saved as a `.svg` file and opened directly or through `<object>`/`<img>`, Chromium and Firefox/Electron stop at the first bare `&` (`xmlParseEntityRef: no name`) and render only up to it. Suggested: wrap the script body in `<![CDATA[ … ]]>` or escape `&`, and offer an option to omit the script for static export.

## Expose HTML export in the web compiler

Filed: https://github.com/Myriad-Dreamin/typst.ts/issues/892 (2026-09-05, S11). `reflexo-typst` has an `html` feature (`typst-html` + `typst-svg`) that the CLI enables by default, but `typst-ts-web-compiler` builds without it and its `compile`/`get_artifact` accept only `vector` and `pdf`. A browser editor that wants Typst's HTML export (experimental in Typst 0.13–0.15) has no path. Suggested: an `html` cargo feature on the web compiler with an `"html"` `fmt` arm returning the document string, off by default if the wasm size matters, or a separate `typst-ts-web-compiler-html` package.

