#set page(paper: "a4", margin: (x: 2cm, y: 1.8cm), numbering: "1")
#set text(size: 10.5pt)
#set par(justify: true)
#show figure.caption: set text(size: 9pt, fill: luma(60))
#show heading.where(level: 2): set block(above: 1.3em, below: 0.6em)
#show figure: set block(above: 0.9em, below: 0.9em)
#import "@preview/cetz:0.5.2"

// Pastel palette used by the diagrams below.
#let rose = rgb("#f9d5d3")
#let mint = rgb("#d3ecd8")
#let sky = rgb("#d5e5f4")
#let butter = rgb("#fbefc6")
#let lilac = rgb("#e5dcf3")

= swarmtyp: Typst in the browser, documents on Swarm

This page is the starting document. Everything you see is compiled from the text on the left, by a Typst compiler running inside your browser tab. The app, this document's fonts and packages, and the projects you share all live on Swarm, a peer-to-peer storage network: there is no server behind swarmtyp, nothing to sign up for, and nothing that can be switched off.

== How it fits together

#figure(
  cetz.canvas(length: 1cm, {
    import cetz.draw: *
    set-style(stroke: 0.6pt + luma(90), mark: (fill: luma(90), scale: 0.7))
    // A box with a title and wrapped body text; anchors are the usual north/south/east/west.
    let node(at, w, h, fill, name, title, body) = {
      rect((at.at(0) - w / 2, at.at(1) - h / 2), (at.at(0) + w / 2, at.at(1) + h / 2), fill: fill, stroke: 0.6pt + fill.darken(45%), radius: 0.2, name: name)
      content(at, box(width: (w - 0.5) * 1cm, align(center)[#set text(hyphenate: false); #text(size: 9pt, weight: "bold", title) \ #text(size: 8pt, fill: luma(50), body)]))
    }
    // A labelled arrow between two anchors; the label sits clear of the line.
    let flow(from, to, label, side: "north", marks: (end: "stealth")) = {
      line(from, to, mark: marks, name: "f")
      content("f.mid", anchor: if side == "north" { "south" } else { "north" }, padding: 0.1, box(width: 2.1cm, align(center, text(size: 7pt, fill: luma(60), label))))
    }
    // Three boxes, 16.4 cm across (the text block is 17 cm), 2.2 cm apart.
    node((0, 0), 4.0, 2.1, sky, "you", [Your browser], [CodeMirror editor · Yjs document · Typst compiler in WebAssembly])
    node((6.2, 0), 4.0, 2.1, mint, "swarm", [Swarm], [your feed and theirs · fonts and packages · the app itself])
    node((12.4, 0), 4.0, 2.1, lilac, "peer", [A collaborator], [the same app and the same document, on their machine])
    // Each direction gets its own line, a little above or below the boxes' midline, so labels never collide.
    let both(a, b, up-label, down-label) = {
      flow((rel: (0, 0.4), to: a + ".east"), (rel: (0, 0.4), to: b + ".west"), up-label)
      flow((rel: (0, -0.4), to: b + ".west"), (rel: (0, -0.4), to: a + ".east"), down-label, side: "south")
    }
    both("you", "swarm", [your snapshots], [fonts · packages · app])
    flow((rel: (0, 0.4), to: "peer.west"), (rel: (0, 0.4), to: "swarm.east"), [their snapshots])
    flow((rel: (0, -0.4), to: "swarm.east"), (rel: (0, -0.4), to: "peer.west"), [fonts · packages · app], side: "south")
    // Live edits travel directly, browser to browser, below the boxes.
    line("you.south", (0, -1.85), (12.4, -1.85), "peer.south", mark: (start: "stealth", end: "stealth"), name: "rtc")
    content((6.2, -1.85), anchor: "north", padding: 0.12, text(size: 7.5pt, fill: luma(60))[WebRTC: live edits and carets, both ways])
  }),
  caption: [Two people, one document. Each person writes only to their own feed; what everyone sees is the merge of all feeds, and live edits go browser to browser.],
)

Every member of a project writes to a feed only they can sign. Nobody owns the project, so nobody can lock anyone out, and nobody can be locked out by a company going away. Anyone with the project link can read and write; private projects with encryption are on the roadmap.

== A little mathematics

Swarm addresses content by its hash. A chunk of at most $4096$ bytes has the reference

$ "ref" = "keccak"_256("chunk") , $

and a postage batch of depth $d$ can pay for up to $2^d$ chunks, so a batch of depth $20$ covers

$ 2^20 times 4 "KiB" = 4 "GiB" . $

The shared document is a CRDT (Yjs). Merging is commutative, associative and idempotent,

$ A plus.circle B = B plus.circle A, quad (A plus.circle B) plus.circle C = A plus.circle (B plus.circle C), quad A plus.circle A = A , $

which is why two people can type at once, go offline, come back, and end up with the same text. And because this is Typst, ordinary mathematics just works:

$ integral_0^1 x^2 dif x = 1/3, quad sum_(k=1)^n k = (n(n+1)) / 2, quad e^(i pi) + 1 = 0 . $

== Two edits, one result

#figure(
  cetz.canvas(length: 1cm, {
    import cetz.draw: *
    set-style(stroke: 0.6pt + luma(90), mark: (fill: luma(90), scale: 0.7))
    let state(pos, fill, name, body) = {
      circle(pos, radius: 0.72, fill: fill, stroke: 0.6pt + fill.darken(45%), name: name)
      content(pos, box(width: 1.3cm, align(center, text(size: 8pt, body))))
    }
    state((0, 0), butter, "s0", [shared \ state])
    state((3.5, 1.15), sky, "a", [you \ insert A])
    state((3.5, -1.15), lilac, "b", [they \ insert B])
    state((7, 0), mint, "m", [merged \ "AB"])
    for (from, to) in (("s0.north-east", "a.west"), ("s0.south-east", "b.west"), ("a.east", "m.north-west"), ("b.east", "m.south-west")) {
      line(from, to, mark: (end: "stealth"))
    }
  }),
  caption: [Concurrent edits are ordered deterministically, so both browsers converge without a server deciding. Drawn with the `cetz` package, which arrived from Swarm when this document asked for it.],
)

== Things to try

- Type anywhere; the preview recompiles about 200 ms after you stop.
- Change a colour above, for example `#let sky = rgb("#ffd6a5")`, and watch the diagram follow.
- Break something (`#let x = 1 + "a"`) to see the error in the gutter and in Problems.
- Add a file with `+`, write a heading in it, and `#include` it here.
- Press *Share…* to make this a project on Swarm and send someone the link; *Export PDF* when you are done.
