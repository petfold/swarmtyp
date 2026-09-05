// S2: shadow filesystem, multi-file, binary via mapShadow, cold/warm/edited compile, incremental server,
// diagnostics formats, semantic tokens, PDF export (S9) — all in Node with the web-compiler WASM.
import { readFileSync, writeFileSync } from 'node:fs';
import { makeCompiler, MemoryAccessModel, queryCompiled } from './fonts.mjs';

const am = new MemoryAccessModel();
const { compiler, timings } = await makeCompiler({ am });
const out = { env: { node: process.version, typstTs: '0.7.0' }, init: timings };

// --- a ~20-page project: main + two chapters + one PNG ---
const png = readFileSync('/usr/share/pixmaps/language-selector.png');
const chapter = (title, n, seed) => `= ${title}\n` + Array.from({ length: n }, (_, i) =>
  `== Section ${i + 1}\n#lorem(${180 + ((i * 37 + seed) % 90)})\n\n$ sum_(k=1)^n k^${(i % 3) + 1} = O(n^${(i % 3) + 2}) $\n\n#lorem(${120 + ((i * 53 + seed) % 80)})\n`).join('\n');
const main = `#set text(font: "DejaVu Serif", size: 10pt)
#set page(paper: "a4", numbering: "1")
#set heading(numbering: "1.1")
#show math.equation: set text(font: "DejaVu Math TeX Gyre")
#align(center)[#image("/img/logo.png", width: 3cm)]
#outline()
#include "/chapters/one.typ"
#include "/chapters/two.typ"
#figure(table(columns: 3, [a], [b], [c], [1], [2], [3]), caption: [A table])
#context [#metadata(counter(page).final().first()) <pages>]
`;
const one = chapter('Chapter one', 14, 3);
let two = chapter('Chapter two', 14, 11);
compiler.addSource('/main.typ', main);
compiler.addSource('/chapters/one.typ', one);
compiler.addSource('/chapters/two.typ', two);
compiler.mapShadow('/img/logo.png', new Uint8Array(png));

const time = async (label, fn) => { const t = performance.now(); const r = await fn(); out[label] = { ms: Math.round(performance.now() - t), ...(r || {}) }; return r; };
const summarize = (r) => ({ artifactBytes: r.result?.length ?? 0, errors: (r.diagnostics || []).filter(d => d.severity === 'error').length, warnings: (r.diagnostics || []).filter(d => d.severity === 'warning').length });

await time('coldCompile', async () => summarize(await compiler.compile({ mainFilePath: '/main.typ', diagnostics: 'full' })));
await time('queryPages', async () => ({ pages: await queryCompiled(compiler, '/main.typ', '<pages>', 'value') }));
await time('warmCompileUnchanged', async () => summarize(await compiler.compile({ mainFilePath: '/main.typ', diagnostics: 'full' })));
two += '\n== Added section\n#lorem(60)\n';
compiler.addSource('/chapters/two.typ', two);
await time('warmCompileOneFileEdited', async () => summarize(await compiler.compile({ mainFilePath: '/main.typ', diagnostics: 'full' })));
// small edit: one word
compiler.addSource('/chapters/two.typ', two.replace('Added section', 'Added section, edited'));
await time('warmCompileOneWordEdited', async () => summarize(await compiler.compile({ mainFilePath: '/main.typ', diagnostics: 'full' })));

// --- incremental server ---
await compiler.withIncrementalServer(async (s) => {
  await time('incrFirst', async () => summarize(await compiler.compile({ mainFilePath: '/main.typ', incrementalServer: s, diagnostics: 'full' })));
  compiler.addSource('/chapters/two.typ', two.replace('Added section', 'Added section, incremental'));
  const r = await time('incrAfterOneWordEdit', async () => summarize(await compiler.compile({ mainFilePath: '/main.typ', incrementalServer: s, diagnostics: 'full' })));
  out.incrDeltaBytes = r.artifactBytes;
});

// --- diagnostics: introduce an error ---
compiler.addSource('/chapters/two.typ', two + '\n#let x = 1 + "a"\n');
const bad = await compiler.compile({ mainFilePath: '/main.typ', diagnostics: 'full' });
out.diagnosticsFull = bad.diagnostics;
const badUnix = await compiler.compile({ mainFilePath: '/main.typ', diagnostics: 'unix' });
out.diagnosticsUnix = badUnix.diagnostics;
compiler.addSource('/chapters/two.typ', two);

// --- semantic tokens (highlighting from the compiler) ---
await time('semanticTokens', async () => {
  const legend = await compiler.getSemanticTokenLegend();
  const toks = await compiler.getSemanticTokens({ mainFilePath: '/chapters/two.typ' });
  return { legendTypes: legend.tokenTypes?.length, legendModifiers: legend.tokenModifiers?.length, dataLength: toks.data?.length, tokens: toks.data ? toks.data.length / 5 : undefined, sampleTypes: legend.tokenTypes?.slice(0, 12) };
});

// --- PDF export (S9) ---
await time('pdfExport', async () => {
  const r = await compiler.compile({ mainFilePath: '/main.typ', format: 1, diagnostics: 'full' });
  writeFileSync('out.pdf', r.result);
  return { pdfBytes: r.result?.length, header: Buffer.from(r.result.slice(0, 8)).toString('latin1') };
});

// --- binary via mapShadow: does removing it fail the compile? ---
compiler.unmapShadow('/img/logo.png');
const noImg = await compiler.compile({ mainFilePath: '/main.typ', diagnostics: 'full' });
out.afterUnmapShadow = { errors: (noImg.diagnostics || []).map(d => d.message).slice(0, 2) };

writeFileSync('RESULTS.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
