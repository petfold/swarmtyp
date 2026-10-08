#set page(paper: "a4", margin: 2cm)
#set text(size: 11pt)
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
    let node(pos, size, fill, name, body) = {
      rect(pos, (rel: size), fill: fill, stroke: 0.6pt + fill.darken(40%), radius: 0.25, name: name)
      content((rel: (size.at(0) / 2, size.at(1) / 2), to: pos), align(center, text(size: 9pt, body)))
    }
    let arrow(from, to, label, above: true) = {
      line(from, to, stroke: 0.7pt + luma(80), mark: (end: "stealth", fill: luma(80), scale: 0.6), name: "a")
      content("a.mid", anchor: if above { "south" } else { "north" }, padding: 0.1, text(size: 7.5pt, fill: luma(60), label))
    }
    node((0, 0), (4.2, 1.8), sky, "you", [*Your browser* \ CodeMirror editor · Yjs document \ Typst compiler (WebAssembly)])
    node((9.8, 0), (4.2, 1.8), lilac, "peer", [*A collaborator's browser* \ the same app, the same document])
    node((4.9, 3.6), (4.2, 1.8), mint, "swarm", [*Swarm* \ feeds · snapshots · chunks \ fonts · packages · published pages])
    node((4.9, -3.2), (4.2, 1.6), butter, "app", [*The app itself* \ `bzz://swarmtyp.gwei` \ a Swarm collection behind a feed])
    arrow("you.north", "swarm.west", [snapshots to your feed])
    arrow("swarm.south", "you.north-east", [fonts, packages], above: false)
    arrow("peer.north", "swarm.east", [their feed])
    arrow("you.east", "peer.west", [WebRTC: live edits and carets])
    arrow("app.north", "you.south-east", [served to you], above: false)
    arrow("app.north-east", "peer.south-west", [and to them], above: false)
  }),
  caption: [Two people, one document. Each person writes only to their own feed; the document everyone sees is the merge.],
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
    let state(pos, fill, name, body) = {
      circle(pos, radius: 0.75, fill: fill, stroke: 0.6pt + fill.darken(40%), name: name)
      content(pos, align(center, text(size: 8pt, body)))
    }
    state((0, 0), butter, "s0", [shared \ state])
    state((3.5, 1.5), sky, "a", [you: \ insert "A"])
    state((3.5, -1.5), lilac, "b", [them: \ insert "B"])
    state((7, 0), mint, "m", [merged: \ "AB"])
    for (from, to) in (("s0", "a"), ("s0", "b"), ("a", "m"), ("b", "m")) {
      line(from, to, stroke: 0.7pt + luma(80), mark: (end: "stealth", fill: luma(80), scale: 0.6))
    }
  }),
  caption: [Concurrent edits are ordered deterministically, so both browsers converge without a server deciding.],
)

== Things to try

- Type anywhere; the preview recompiles about 200 ms after you stop.
- Change a colour above, for example `#let sky = rgb("#ffd6a5")`, and watch the diagram follow.
- Break something (`#let x = 1 + "a"`) to see the error in the gutter and in Problems.
- Add a file with `+`, write a heading in it, and `#include` it here.
- Press *Share…* to turn this into a project on Swarm and send the link to someone. Press *Export PDF* when you are done.

The diagrams are drawn with the `cetz` package, the mathematics is set in New Computer Modern Math, and both arrived from Swarm the moment this document asked for them.
