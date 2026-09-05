# swarmtyp

Collaborative Typst editing that runs in the browser and lives on Swarm. The Typst compiler runs as WebAssembly (typst.ts); co-editing uses Solar Punk's `swarm-collaborative-docs` (Yjs snapshots on Swarm feeds, live deltas over WebRTC signalled through feeds); the app, blobs, fonts, packages and published PDFs are Swarm content. No server.

Named in `docs/decisions.md` D-01 (renamed from the working name `galley`).

## Status

Phase 1 M1 reached 2026-09-05 (stable address `bzz/b656fac5…a100/` via the release feed; also verified in Freedom Browser); Phase 0 results in `docs/spikes.md`, throwaway code under `spikes/`. Stack pinned: typst.ts 0.7.0 (D-04), CodeMirror 6 (D-03), canvas preview of visible pages (D-17). D-22 decided: in-browser clients (Freedom Browser, later weeb-3) are the path for users without a node; test in Freedom, load large assets in ranges.

## Read in this order

1. `docs/design.md` — the architecture. Read all of it before writing anything.
2. `docs/plan.md` — phases and milestones; says where we are.
3. `docs/spikes.md` — what to verify first, with exit criteria and result slots.
4. `docs/decisions.md` — decided, proposed, open. Do not silently re-decide DECIDED items or close OPEN ones.
5. `docs/threats.md` — what can go wrong and what the design does about it.
6. `docs/references.md` — the outside projects, with versions.
7. `docs/competition.md` — what typst.app is made of, what it charges for, and what we may not copy from it.
8. `docs/user-guide.md` — how to open and use the current build; update it in the same change as any user-visible behaviour.

## Rules for working here

- Spikes before product code. Record each spike's result in `docs/spikes.md` before building on it.
- No backend. If a feature seems to need one, write an OPEN entry in `docs/decisions.md` instead of adding it.
- Reuse the ecosystem: `@solarpunkltd/swarm-collaborative-docs`, `@ethersphere/bee-js` 12.x, typst.ts. When a library falls short, extend it upstream (Solar Punk owns `swarm-collaborative-docs`); do not fork it into this repo.
- Keep the bundle small. Swarm serves every byte on first load; measure before adding a dependency.
- The docs are the spec. When code and docs disagree, fix one in the same change. Every decision gets a D-number.
- Swarm terms as in the Swarm docs: reference, chunk, postage stamp / batch, feed, manifest, Bee, ACT, GSOC. Feeds get immutable stamps, always.
- Treat collaborator content as untrusted: sanitise rendered SVG before it reaches the DOM (`docs/threats.md` T5).
- Nothing from typst.app's served bundle (JS, WASM, CSS, icons, font index, dictionaries) enters this repo (D-18). Same compiler, from source via typst.ts; fonts and dictionaries from their upstream projects.

## Stack (confirmed by Phase 0)

TypeScript · Vite (`base: './'`, hash routing) · React · CodeMirror 6 + `y-codemirror.next` · Yjs · typst.ts 0.7.x (`@myriaddreamin/typst.ts`, `typst-ts-web-compiler`, `typst-ts-renderer`) in a Web Worker · `@ethersphere/bee-js` 12.x against Bee 2.8.x · `@solarpunkltd/swarm-collaborative-docs` with `createSwarmRtcTransport` · Vitest for logic · Playwright for two-browser collaboration tests against a Bee Factory network.

## Layout

```
src/app      shell, routing, settings        src/compile  worker, shadow FS, packages, fonts, render
src/editor   CodeMirror, Typst mode, Yjs     src/swarm    Bee client, uploads, publish, cache
src/project  Y.Doc schema, files, genesis    src/ui
src/collab   SwarmDoc wiring, keys, members
tools/deploy build → upload → feed           tools/mirror typst/packages → Swarm
e2e/         Playwright                      spikes/      throwaway Phase 0 code (delete when done)
```

## Local development

- A Bee 2.8.x light node with CORS allowing the dev origin (Swarm Desktop's node on `http://127.0.0.1:1633` does by default), plus an immutable postage batch on it for uploads.
- `.env.local` with `VITE_BEE_URL` and `VITE_STAMP` (see `.env.example`); never commit stamps or keys.
- `pnpm install`, then `node tools/collab/build-lib.mjs` once (builds `swarm-collaborative-docs` from a pinned commit into `vendor/`, gitignored; `--force` to rebuild), then `pnpm dev` (http://127.0.0.1:5174), `pnpm test`, `pnpm build` (runs `tools/build-assets.mjs`, which gzips the compiler WASM into `public/wasm/compiler.wasm.bin`, then type-checks and bundles), `pnpm release` (uploads `dist/` as a collection and prints the reference).
- `pnpm test:e2e` runs the smoke test and the two-context collaboration test (`e2e/collab.spec.ts`, needs `VITE_STAMP` as well as the node; about a minute per browser). Tests reach the CodeMirror view through `.editor-host`'s `cmView` property.
- Large assets are fetched in 1 MB ranges (`src/compile/ranged.ts`); keep it that way, Freedom's Ant truncates whole bodies.
- Fonts come from `src/compile/fonts-index.json` (faces on Swarm by reference); rebuild it with the S4 script when the font set changes.

## Related Solar Punk work

- `swarm-collaborative-docs` — the collaboration layer (D-02).
- `dappdata` (IDEA-190) — identity derivation and per-user project list (Phase 3).
