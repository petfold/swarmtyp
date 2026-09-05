# References

Outside projects swarmtyp depends on or learns from. Check versions and status before relying on any of them; several move fast.

## We build on

- **typst** — https://github.com/typst/typst — the compiler, Apache-2.0. The web app at typst.app is Typst GmbH's closed product; only a paid on-premises version can be self-hosted.
- **typst.ts** — https://github.com/Myriad-Dreamin/typst.ts — typst as WASM for JavaScript. npm: `@myriaddreamin/typst.ts` (wrapper), `@myriaddreamin/typst-ts-web-compiler`, `@myriaddreamin/typst-ts-renderer`. v0.7.0 released June 2026, embeds Typst 0.14.2 (S2); v0.8.0-rc3 (pre-release, June 2026) embeds Typst 0.15.0. Issues filed 2026-09-05: #888, #889, #890 and comments on #832, #634, #763 (`docs/upstream/typst-ts.md`). Default font assets download from GitHub; swarmtyp replaces that.
- **swarm-collaborative-docs** — https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs — package name `@solarpunkltd/swarm-collaborative-docs`, **not published to npm** as of 2026-09-05 (install from git, branch `master`, 0.0.1; CommonJS only; depends on the bee-js fork `github:Apiary-Suite/bee-js` 12.2.1 and bundles Monaco, React 19 and Waku as hard dependencies; see S5). `SwarmDoc`, `DocSettings`, `DOC_EVENTS`, transports `createSwarmRtcTransport` (recommended), `createYWebrtcTransport`, `createSwarmPubSubTransport` (experimental, unreleased Bee), `createWakuTransport` (experimental). Feeds: `<topic>_doc<address>`, `<topic>_members`, `<topic>_signal`. Multi-file via `doc.getText(path)`.
- **bee-js** — https://github.com/ethersphere/bee-js — `@ethersphere/bee-js` 12.x for Bee 2.8.x (API v8). Feeds, uploads, Mantaray, ACT, GSOC.
- **Bee** — https://github.com/ethersphere/bee — the node. Bee Factory (https://github.com/ethersphere/bee-factory) for a local test network in CI; `bee dev` mode is gone since 2.8.1.
- **Yjs** — https://github.com/yjs/yjs — `y-codemirror.next` for the editor binding, `y-protocols` for Awareness, `y-indexeddb` (https://github.com/yjs/y-indexeddb) for local persistence (D-19).
- **CodeMirror 6** — https://codemirror.net/ — editor.
- **dappdata** — Solar Punk, IDEA-190 — per-user dapp state on Swarm keyed to a Sign-In with Ethereum identity; supplies swarmtyp's Phase 3 identity derivation and project list.

## Upstream sources for assets (D-18: never from typst.app)

- **Fonts** — Libertinus https://github.com/alerque/libertinus (OFL); New Computer Modern https://ctan.org/pkg/newcomputermodern (GUST Font License); DejaVu https://dejavu-fonts.github.io/ (Bitstream Vera licence). Record each licence in the font collection manifest.
- **Hunspell dictionaries** — https://github.com/wooorm/dictionaries (per-language licences listed) or https://github.com/LibreOffice/dictionaries. Only if spellcheck is built.
- **Typst reference documentation** — built from the typst repository's `docs/` directory and doc comments with `cargo docit compile` (static site or PDF). Candidate for hosting on Swarm; check the licence of `typst-dev-assets` first.

## Names and websites (D-24)

- **Typst HTML export** — https://typst.app/docs/reference/html/ (experimental, `--features html`, semantic markup without CSS, `target()` for dual-output sources; Typst 0.15.1). Tracking issue https://github.com/typst/typst/issues/5512 (NLnet-funded; CSS deferred; no stabilisation date). 0.15.0 changelog: MathML, bundle export.
- **Gwei Name Service** — https://gwei.domains/ , contracts and SDK https://github.com/lucadonnoh/gwei-names (`.gwei` names on Ethereum mainnet, ERC-721, no admin, Swarm contenthash supported, gateway `<name>.gwei.domains`, free `.id.gwei` subnames; hosting guide https://gwei.domains/guide/). Resolved by Freedom Browser alongside ENS `.eth`/`.box`, WNS `.wei`, Tezos `.tez`.
- **ENS** — https://ens.domains/ (`.eth`, contenthash with the Swarm codec).

## Clients

- **Freedom Browser** — https://github.com/solardev-xyz/freedom-browser (MPL-2.0; checkout at `../freedom-browser`). Electron browser with native `bzz://` (per-hash origin), a bundled Rust Swarm light node (Ant, Bee-shaped API) and a permissioned `window.swarm` provider. Tested with the S1 page on 2026-09-05; see S1 and D-22. Issues filed from that test: `freedom-hq/ant#79` (comment), `freedom-hq/ant#82`, `solardev-xyz/freedom-browser#218`. Ant repository: https://github.com/freedom-hq/ant.

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
