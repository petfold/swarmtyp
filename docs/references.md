# References

Outside projects swarmtyp depends on or learns from. Check versions and status before relying on any of them; several move fast.

## We build on

- **typst** — https://github.com/typst/typst — the compiler, Apache-2.0. The web app at typst.app is Typst GmbH's closed product; only a paid on-premises version can be self-hosted.
- **typst.ts** — https://github.com/Myriad-Dreamin/typst.ts — typst as WASM for JavaScript. npm: `@myriaddreamin/typst.ts` (wrapper), `@myriaddreamin/typst-ts-web-compiler`, `@myriaddreamin/typst-ts-renderer`. v0.7.0 released June 2026. Default font assets download from GitHub; swarmtyp replaces that.
- **swarm-collaborative-docs** — https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs — npm `@solarpunkltd/swarm-collaborative-docs`. `SwarmDoc`, `DocSettings`, `DOC_EVENTS`, transports `createSwarmRtcTransport` (recommended), `createYWebrtcTransport`, `createSwarmPubSubTransport` (experimental, unreleased Bee), `createWakuTransport` (experimental). Feeds: `<topic>_doc<address>`, `<topic>_members`, `<topic>_signal`. Multi-file via `doc.getText(path)`.
- **bee-js** — https://github.com/ethersphere/bee-js — `@ethersphere/bee-js` 12.x for Bee 2.8.x (API v8). Feeds, uploads, Mantaray, ACT, GSOC.
- **Bee** — https://github.com/ethersphere/bee — the node. Bee Factory (https://github.com/ethersphere/bee-factory) for a local test network in CI; `bee dev` mode is gone since 2.8.1.
- **Yjs** — https://github.com/yjs/yjs — `y-codemirror.next` for the editor binding, `y-protocols` for Awareness, `y-indexeddb` (https://github.com/yjs/y-indexeddb) for local persistence (D-19).
- **CodeMirror 6** — https://codemirror.net/ — editor.
- **dappdata** — Solar Punk, IDEA-190 — per-user dapp state on Swarm keyed to a Sign-In with Ethereum identity; supplies swarmtyp's Phase 3 identity derivation and project list.

## Upstream sources for assets (D-18: never from typst.app)

- **Fonts** — Libertinus https://github.com/alerque/libertinus (OFL); New Computer Modern https://ctan.org/pkg/newcomputermodern (GUST Font License); DejaVu https://dejavu-fonts.github.io/ (Bitstream Vera licence). Record each licence in the font collection manifest.
- **Hunspell dictionaries** — https://github.com/wooorm/dictionaries (per-language licences listed) or https://github.com/LibreOffice/dictionaries. Only if spellcheck is built.
- **Typst reference documentation** — built from the typst repository's `docs/` directory and doc comments with `cargo docit compile` (static site or PDF). Candidate for hosting on Swarm; check the licence of `typst-dev-assets` first.

## Competitor

- **typst.app** — https://typst.app — Typst GmbH's hosted editor, closed. Observed architecture, measurements, feature inventory, pricing and licence boundaries in `competition.md` (2026-09-05). Web-app docs https://typst.app/docs/web-app/, roadmap https://typst.app/docs/roadmap/, terms https://typst.app/terms, pricing https://typst.app/pricing/.

## Prior art (open-source collaborative Typst editors, all server-backed)

- **TypstDrive** — https://github.com/SirBlobby/TypstDrive — Yjs + CodeMirror 6, SVG preview, many export formats. Closest to swarmtyp's editor stack.
- **Collabst** — https://github.com/collabst/collabst — FOSS, self-hostable collaborative Typst workspace (announced May 2026).
- **typst-flow** — https://github.com/LeqitDev/typst-flow — early self-hostable collaborative editor.
- **tinymist** — https://github.com/Myriad-Dreamin/tinymist — Typst language server and preview; source of a maintained TextMate grammar and the preview architecture typst.ts serves.

## Swarm documentation

- Docs — https://docs.ethswarm.org/ (feeds, postage stamps, ACT, GSOC, hosting).
- Developer resources index — https://docs.ethswarm.org/docs/develop/resources
- Package registry swarmtyp mirrors — https://github.com/typst/packages (source of Typst Universe).
