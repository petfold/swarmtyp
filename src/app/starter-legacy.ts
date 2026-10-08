// Earlier starting documents, verbatim. A local document that still equals one of them was never edited, so a new
// release may replace it with the current starter (docs/user-guide.md §2); anything edited is left alone.
// The starter.typ versions from git: all three use `plus.circle`, which Typst 0.15 removed (S14).
import STARTER_BE7BB5B from './legacy/starter-be7bb5b.typ?raw';
import STARTER_FAD48CE from './legacy/starter-fad48ce.typ?raw';
import STARTER_18529FB from './legacy/starter-18529fb.typ?raw';

export const LEGACY_STARTERS: string[] = [
  STARTER_BE7BB5B, STARTER_FAD48CE, STARTER_18529FB,
  `#set page(paper: "a4")
#set text(size: 11pt)

= Hello from swarmtyp

Typst, compiled in your browser, living on Swarm. Edit on the left; the preview follows.
The default fonts (Libertinus Serif, New Computer Modern Math, DejaVu Sans Mono) load from Swarm as the document needs them.

$ integral_0^1 x^2 dif x = 1/3 $

#import "@preview/oxifmt:1.0.0": strfmt
Packages come from the Swarm mirror when they are on it: #strfmt("{:04}", 42). \`raw text\` uses the mono face.
`,
];
