# References

Outside projects swarmtyp depends on or learns from. Check versions and status before relying on any of them; several move fast.

## We build on

- **typst** — https://github.com/typst/typst — the compiler, Apache-2.0. The web app at typst.app is Typst GmbH's closed product; only a paid on-premises version can be self-hosted.
- **typst.ts** — https://github.com/Myriad-Dreamin/typst.ts — typst as WASM for JavaScript. npm: `@myriaddreamin/typst.ts` (wrapper), `@myriaddreamin/typst-ts-web-compiler`, `@myriaddreamin/typst-ts-renderer`. v0.7.0 released June 2026, embeds Typst 0.14.2 (S2); v0.8.0-rc3 (pre-release, June 2026) embeds Typst 0.15.0. Issues filed 2026-09-05: #888, #889, #890 and comments on #832, #634, #763 (`docs/upstream/typst-ts.md`). Default font assets download from GitHub; swarmtyp replaces that. Checked 2026-10-08: still no release after 0.8.0-rc3; `main` embeds Typst 0.15.1 (bumped 2026-08-30); no replies on #888–#892. swarmtyp runs 0.8.0-rc3 since 2026-10-08 (D-28, S14).
- **typst** — 0.15.1 (2026-07-17) is still the latest release on 2026-10-08. `main` has about a hundred commits since, among them column balancing (#8207), column separators (#8353), set rules for output-format options (`#set pdf(standard: …)`, #8496, which also changes the library API embedders such as typst.ts call) and HTML export work; open: HTML styles (#8865, see D-24). Removed deprecated forms (#8659) are T12 material for 0.16.
- **swarm-collaborative-docs** — https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs — `@solarpunkltd/swarm-collaborative-docs`. swarmtyp still runs adcb7d5 (0.0.1, built from git into `vendor/`, CommonJS, the bee-js fork `github:Apiary-Suite/bee-js` 12.2.1, Monaco, React 19 and Waku bundled; S5). **0.1.0 is on npm since 2026-10-01** (S12, D-26): ESM and CJS, no runtime dependencies, peers `@ethersphere/bee-js` ^13.1.0 and `yjs` (`y-webrtc` optional), 54 KB. A room is a random key in the link fragment (`createRoomKey`, `encodeRoomInvite`, `Room`); `DocSettings.user` takes `privateKey`, `nickname`, `sessionId`, `infra` takes `beeUrl`, `stamp` (required, checked at `start()`), `roomKey`, `roomCreator`, `transport`. Transports `createSwarmRtcTransport({ iceServers })` and `createSignalingServerTransport` (y-webrtc against a server you run, ruled out by D-05); GSOC and Waku moved to `src/experimental/`, not shipped. Feeds: a directory per room, an announce feed per identity, a snapshot and a signal feed per session. Multi-file via `doc.getText(path)`, carets via `CursorPosition.scope`. Issues filed 2026-10-08: #20–#23 (`docs/upstream/swarm-collaborative-docs.md` drafts 13–16).
- **bee-js** — https://github.com/ethersphere/bee-js — `@ethersphere/bee-js` for Bee 2.8.x (API v8). Feeds, uploads, Mantaray, ACT, GSOC. 13.1.0 (2026-09-11, declares Bee 2.8.1 and API 8.1.0) is what swarm-collaborative-docs 0.1.0 wants; `tools/deploy` already uses 13.0.0.
- **Bee** — https://github.com/ethersphere/bee — the node. Bee Factory (https://github.com/ethersphere/bee-factory) for a local test network in CI; `bee dev` mode is gone since 2.8.1.
- **Yjs** — https://github.com/yjs/yjs — `y-codemirror.next` for the editor binding, `y-protocols` for Awareness, `y-indexeddb` (https://github.com/yjs/y-indexeddb) for local persistence (D-19).
- **CodeMirror 6** — https://codemirror.net/ — editor.
- **dappdata** — Solar Punk, IDEA-190 — per-user dapp state on Swarm keyed to a Sign-In with Ethereum identity; supplies swarmtyp's Phase 3 identity derivation and project list.

## Upstream sources for assets (D-18: never from typst.app)

- **Fonts** — Libertinus https://github.com/alerque/libertinus (OFL); New Computer Modern https://ctan.org/pkg/newcomputermodern (GUST Font License); DejaVu https://dejavu-fonts.github.io/ (Bitstream Vera licence). Record each licence in the font collection manifest.
- **Hunspell dictionaries** — https://github.com/wooorm/dictionaries (per-language licences listed) or https://github.com/LibreOffice/dictionaries. Only if spellcheck is built.
- **Typst reference documentation** — built from the typst repository's `docs/` directory and doc comments with `cargo docit compile` (static site or PDF). Candidate for hosting on Swarm; check the licence of `typst-dev-assets` first.

## Names and websites (D-24)

- **Typst HTML export** — https://typst.app/docs/reference/html/ (experimental, `--features html`, semantic markup without CSS, `target()` for dual-output sources; Typst 0.15.1). Tracking issue https://github.com/typst/typst/issues/5512 (NLnet-funded; CSS deferred; no stabilisation date). 0.15.0 changelog: MathML, bundle export. Open since 2026-09-18: https://github.com/typst/typst/pull/8865 (HTML style profiles, embedded stylesheet).
- **Gwei Name Service** — https://gwei.domains/ , contracts and SDK https://github.com/lucadonnoh/gwei-names (`.gwei` names on Ethereum mainnet, ERC-721, no admin, Swarm contenthash supported, gateway `<name>.gwei.domains`, free `.id.gwei` subnames; hosting guide https://gwei.domains/guide/). Resolved by Freedom Browser alongside ENS `.eth`/`.box`, WNS `.wei`, Tezos `.tez`. swarmtyp owns `swarmtyp.gwei` (registered 2026-09-05, NameNFT `0x9D51D507BC7264d4fE8Ad1cf7Fe191933A0a81d6`); it points at the S11 site's feed manifest for now and can later be the app's address.
- **ENS** — https://ens.domains/ (`.eth`, contenthash with the Swarm codec). Bee resolves ENS through `resolver-options` (`[tld:][contract-addr@]url`, `pkg/resolver/client/ens/ens.go`, go-ens); `.gwei` needs ethersphere/bee#5600.

## Clients

- **Freedom Browser** — https://github.com/solardev-xyz/freedom-browser (MPL-2.0; checkout at `../freedom-browser`). Electron browser with native `bzz://` (per-hash origin), a bundled Rust Swarm light node (Ant, Bee-shaped API) and a permissioned `window.swarm` provider. Tested with the S1 page on 2026-09-05; see S1 and D-22. Issues filed from that test: `freedom-hq/ant#79` (comment), `freedom-hq/ant#82`, `solardev-xyz/freedom-browser#218`. Ant repository: https://github.com/freedom-hq/ant. 0.8.7 (rc 2026-10-08) blocks pages from every node API, including port 1633 (#428), leaving `window.swarm` as the only way to write; its methods are listed in `docs/upstream/swarm-collaborative-docs.md` draft 13. Freedom's node can now buy immutable batches ("publishing setup").

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
