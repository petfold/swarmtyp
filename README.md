# swarmtyp

[![license](https://img.shields.io/badge/license-BSD--3--Clause-blue)](LICENSE)

Collaborative [Typst](https://typst.app/docs) editing on [Swarm](https://www.ethswarm.org/). No server.

swarmtyp is typesetting for the decentralised web: a browser editor where co-authors write Typst together, and everything that makes it work — the compiler, the document sync, the images and fonts, the packages, the app itself — is Swarm content.

## How

- **Compiler in the browser.** Typst is open-source Rust; [typst.ts](https://github.com/Myriad-Dreamin/typst.ts) ships it as WebAssembly. Edit, compile and preview happen on your machine, in a Web Worker.
- **Co-editing over Swarm.** Typst source is plain text, so each file is a Yjs `Y.Text`. [swarm-collaborative-docs](https://github.com/Solar-Punk-Ltd/swarm-collaborative-docs) stores snapshots on Swarm feeds and sends live edits over WebRTC, with the WebRTC handshake itself carried by Swarm feeds. No signalling server.
- **Everything else is content-addressed.** Images and fonts are uploads referenced by hash; Typst Universe packages come from a mirror on Swarm; published PDFs get a stable `bzz` link. The app is a static bundle served from a Swarm address.

This is not a port of typst.app, which is Typst GmbH's closed product. swarmtyp is an independent editor built on the open compiler.

## Status

Phase 1 (M1) is live: a single-user editor at a stable Swarm address. Open it in Freedom Browser at `bzz://b656fac57eb02756af40279cf70275969c9f9219818af7cceee34101f169a100/` or through your own Bee node at `http://127.0.0.1:1633/bzz/<that hash>/`. Read `docs/user-guide.md` to use it, `docs/design.md` and `docs/plan.md` to work on it; `docs/competition.md` compares swarmtyp with typst.app.

## Licence

BSD-3-Clause. See `LICENSE` (`docs/decisions.md` D-09).
