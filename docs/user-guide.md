# swarmtyp user guide

Status: Phase 2 build (2026-09-05). Your own document on your device, and shared projects that several people edit at once. This guide grows with the app.

swarmtyp is a Typst editor that runs entirely in your browser and lives on Swarm. The compiler is WebAssembly, the app is a Swarm collection, fonts and packages are Swarm content, and nothing you write leaves your machine unless you upload it. There is no account and no server.

## 1. Opening the app

You need a way to read Swarm. Any of these works:

- **Any browser, no node.** Open

  ```
  https://swarmtyp.gwei.domains/
  ```

  The name `swarmtyp.gwei` points at the app's release feed, so this address always opens the current version. Fonts and packages come from Swarm's public read gateway; you can write and export PDFs. Uploading images and sharing a project need a Bee node with a postage batch, see Settings; a banner says so. The first load fetches about 19 MB and takes 15 to 30 seconds.

- **Freedom Browser** (recommended for a node-free client that also isolates your identity key). Paste this into the address bar:

  ```
  bzz://swarmtyp.gwei/
  ```

  (The raw address behind the name is `bzz://b656fac57eb02756af40279cf70275969c9f9219818af7cceee34101f169a100/`.)

  Freedom fetches the app through its built-in Swarm node. The first open is slow: about 12 MB of compiler and code arrive at the speed of a light node, which took about six minutes in our test, with a progress percentage in the status bar. The second open comes from Freedom's cache and takes seconds. If Freedom shows "External Nodes Detected" because a Bee node runs on your machine, either choice works; "Use External" makes Freedom read through your Bee, which is faster.

- **Your own Bee node** (Swarm Desktop or a light node on `http://127.0.0.1:1633`). Open:

  ```
  http://127.0.0.1:1633/bzz/b656fac57eb02756af40279cf70275969c9f9219818af7cceee34101f169a100/
  ```

  This address is a *feed manifest*: it always points at the latest release, so bookmark it.

The status bar at the top says what is happening: `loading compiler 48%`, then `compiler ready`, then `compiled in 465 ms` after each change.

## 2. The demo document

On first open you get "My first document", one file `main.typ`, two pages that describe swarmtyp itself, and the preview on the right shows what the demo exercises:

- **Text and headings** set in Libertinus Serif, the Typst default, fetched from Swarm the moment the document needs it.
- **Two diagrams drawn with the `cetz` package** (Typst's TikZ-like drawing library) in a pastel palette defined at the top of the file: how your browser, a collaborator's browser, Swarm and the app itself fit together, and how two concurrent edits merge into one result. `cetz` and its dependency `oxifmt` come from swarmtyp's mirror on Swarm; the Problems panel lists which packages the document used and where each came from.
- **Equations** set in New Computer Modern Math, another lazy font: Swarm's content addressing, the capacity of a postage batch, the CRDT merge laws, and a few classics. The maths face is 1.4 MB and loads only because the document has equations.
- **Raw text** in DejaVu Sans Mono.

The source is `src/app/starter.typ` in the repository; changing a colour at the top of the file recolours both diagrams.

Things to try, in order:

1. Type anywhere. The preview recompiles about 200 ms after you stop typing; the status bar shows the compile time.
2. Change a colour at the top, for example `#let sky = rgb("#ffd6a5")`, and watch the diagrams follow. Break something: write `#let x = 1 + "a"`. The error is underlined in the editor, listed in Problems at the bottom left with its line, and the status bar counts it. Fix it and it disappears.
3. Add a file with the `+` button in the Files panel, for example `chapters/two.typ`, write a heading in it, go back to `main.typ` and add `#include "chapters/two.typ"`.
4. Upload an image with the `↑` button (needs a postage batch, see Settings). It appears in Files marked `◆`; use it with `#image("logo.png", width: 3cm)`.
5. Export PDF. The file is produced in your browser and saved by it.

## 3. The screen

- **Files** (left): every file of the project. `●` marks the main file, the one that is compiled and exported. Hover a file for *main*, rename `✎` and delete `×`. Text files (`.typ`, `.bib`, `.csv`, `.json`, `.yaml`, `.toml`, `.txt`, `.svg`) open in the editor; other files are blobs on Swarm and show their reference.
- **Editor** (middle): CodeMirror with Typst highlighting. Errors and warnings from the last compile are underlined; hover for the message.
- **Preview** (right): the pages, drawn only while they are in view. The zoom slider at the top rescales them.
- **Problems** (bottom left): errors and warnings with file and position; click one to open its file. Below it, the packages the document used and their source.
- **Status bar**: loading progress, `compiling… fetching font X` while fonts or packages are being fetched for the first time, then the compile time and the error count.
- **People** (top right, shared projects only): one chip per person in the project, you first. A green dot means a direct connection is open with that person, so edits arrive as they type. Without the dot you have what they had written when you joined; their later edits arrive when you reload (a limit of the current library, see §10). The same person in two tabs shows twice.
- **Guide** (top right): this guide, published on Swarm next to the app at `…/guide/`.
- **⚙ Settings**: see below.

### Keyboard

| Action | Keys |
|---|---|
| Undo, redo | Ctrl-Z, Ctrl-Shift-Z (Cmd on macOS) |
| Search and replace | Ctrl-F |
| Go to line | Alt-G |
| Toggle line comment | Ctrl-/ |
| Next diagnostic | F8 |
| Fold, unfold | Ctrl-Shift-[ and Ctrl-Shift-] |
| Indent with Tab | Tab and Shift-Tab |

## 4. Files, images and uploads

Text files live in the project on your device. Images, fonts and other binary files are uploaded to Swarm when you add them and the project keeps only their reference. Two things follow:

- **Uploads need a postage batch** on the Bee node you are connected to. Enter its id in Settings. Without one the upload button explains why it cannot proceed.
- **Everything uploaded is public and permanent** for as long as the batch pays for it. Anyone with the reference can fetch it. Do not upload what you would not publish.

Freedom Browser users without a Bee node cannot upload yet: the app's writes go to a Bee node's HTTP API, and Freedom's node accepts writes only through its own provider, which the app does not use yet. Reading, editing and exporting work fully.

## 5. Packages and fonts

`#import "@preview/name:version"` works as in Typst. The app looks in swarmtyp's mirror on Swarm first, then, if **Fetch missing packages from packages.typst.org** is on in Settings, at Typst's package server. The Problems panel shows which source served each package. Turn the fallback off for privacy (the package server would learn which packages you use) or to be sure a document builds from Swarm alone. Mirrored today: `oxifmt`, `tiaoma`, `cetz`, `fletcher`, `codly`, `showybox`, each at one version; the full Universe mirror is planned.

Fonts available without any setup: Libertinus Serif, New Computer Modern and New Computer Modern Math, DejaVu Sans Mono, each in its regular, bold and italic faces. Only the faces a document uses are downloaded. Project-specific fonts are not supported yet.

## 6. Settings

- **Bee node URL**: where the app reads fonts, packages and blobs and where it uploads. Default `http://127.0.0.1:1633`. The line under it says whether the node answers.
- **Postage batch id**: an immutable batch on that node, for uploads only. Never shared, stored on this device.
- **Fetch missing packages from packages.typst.org**: the fallback described above.
- **Zoom**: preview scale.

## 7. Sharing a project

1. Set **Your name** in ⚙ Settings; that is what collaborators see on your chip and caret.
2. Press **Share…**. The app writes a small "genesis" record to Swarm with your batch, and the address changes to `…#/p/<project id>`. Your document is carried over as it is.
3. Press **Copy link** and send the link. Anyone who has it can read and write; there is no other access control yet, so treat the link like the document itself.
4. The other person opens the link. They see your name appear, then your text; you see theirs. Each person's caret is drawn in the other's editor in their colour with their name.

While you type, the app writes your changes to your own feed on Swarm and sends them directly to the people connected. Everyone's copy is the merge of everyone's feed, so nobody owns the project and nobody can lock anyone out. Two notes:

- A change reaches Swarm a few seconds after you stop typing. If you close the tab in that window the browser asks whether to leave; say no, wait a moment, then close.
- Someone who opens the link before its creator's first snapshot is written sees `waiting for the document…` until it arrives.
- **Leave** removes the project's copy from this browser and returns you to your own document. The project stays on Swarm; open the link again to come back. Your feed keeps what you wrote.

**Your identity.** The first time the app runs it makes a key for you and keeps it in this browser. Your chip shows the name you chose plus the last characters of your address, which is what proves your edits are yours. To be the same person on another device, use **Copy identity key** in Settings there and **Import…** here. Keep the key private: whoever has it can write as you. Each tab you open signs with its own sub-key, so two tabs of yours count as two people in the list; that is intended.

## 8. Where your work is

- **Your own document** (the address without `#/p/…`) is stored in this browser's local storage, saved after every change. It is not on Swarm and not shared. If you never edited the demo document, a new release replaces it with the current demo; if you did, it stays as you left it, and Settings has **Start over with the demo document**.
- **The compiler, fonts and packages** are kept in the browser's cache once fetched (by version and by Swarm reference), so a reload or a new release re-downloads none of them; only the app's own code changes, about 1.5 MB. Fonts and packages the demo needs are fetched in parallel with the compiler on the first load.
- **A shared project** is on Swarm as feeds, one per member, written with each member's own postage batch, plus a copy in this browser's IndexedDB so reopening the link is instant and works while Swarm is slow. Anyone with the link can read it.

Two cautions:

- Everything served from the same Bee node address (`http://127.0.0.1:1633/…`) shares one browser origin, so other Swarm apps opened through the same node can read this storage, including your identity key. Freedom gives each app its own origin and does not have this problem. Phase 4 encrypts projects.
- Clearing site data clears your own document and your identity. Shared projects come back from Swarm; your identity does not unless you copied the key. Export a PDF or copy the source if it matters.

## 9. Limits of this build

- Sharing and joining need a postage batch (the genesis record and your feed are writes). Freedom Browser's built-in node cannot write yet, so in Freedom set **Bee node URL** in ⚙ to a Bee node you can use, such as Swarm Desktop's `http://127.0.0.1:1633`, with its batch id; the app itself still loads through Freedom. Tested: a project shared from Chromium, joined in Freedom, edits both ways.
- Tested with two and three people on one machine; two networks with a NAT between them are the next test.
- Projects are public to anyone with the link; private projects are Phase 4.
- Compiler: Typst 0.14.2 (typst.ts 0.7.0). typst.app runs 0.15.1, so a few newest features are missing. The version is shown in Settings.
- First load is about 12 MB; on a Swarm light node that is minutes, afterwards cached. A reload with a warm cache compiles in a few seconds.
- Preview is raster: crisp at the chosen zoom, redrawn when you zoom. No text selection in the preview.
- No project-specific fonts, no source-to-preview jumping, no comments.

## 10. If something goes wrong

- **`compiler failed: Failed to fetch`**: the app could not read its own files. In Freedom, wait for the node to connect and reload; on a Bee node, check the node is running.
- **`no font could be found`** on an equation: the maths face did not load; reload once the node is connected.
- **Upload fails**: the batch id is missing, not usable, or belongs to a different node. Check `⚙` and the node's stamps.
- **Packages missing** with the fallback off: the package is not on the mirror yet; turn the fallback on or ask for it to be mirrored.
- **`waiting for the document…`** on a shared link: the creator's snapshot is not readable yet. Wait; if it never comes, the creator closed the tab before the first write or shared without a working batch.
- **No green dot** on a collaborator: no direct connection yet. Setting one up takes half a minute to two minutes because the offer and answer travel through Swarm feeds, and it can fail behind a strict NAT (no TURN server yet, D-15). Until it is up, their new edits do not reach you; reload to fetch their latest snapshot from Swarm.
- **Stale project after an update**: the app keeps your project across releases; if a release changes the project format you will be told.

Questions and problems: https://github.com/petfold/swarmtyp/issues
