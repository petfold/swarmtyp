// S14: run the same checks against whichever typst.ts a directory holds, so 0.7.0 (spikes/s2) and 0.8.0-rc3
// (spikes/s14) are measured on the same machine in the same session.
//   A. the S2 workload (22-page document, DejaVu from the system): cold, warm, edited, incremental, PDF
//   B. swarmtyp's font index registered lazily (faces from the local Bee node): which faces a document pulls
//   C. the starter (src/app/starter.typ) with its packages: diagnostics, time, PDF for a side-by-side
//   D. two packages whose newest version needs Typst 0.15.0 and 0.15.1
// Usage: node spikes/s14/bench.mjs <dir with node_modules> <out dir> [bee url]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [deps, outDir, bee = 'http://127.0.0.1:1633'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const mod = (p) => `${deps}/node_modules/@myriaddreamin/${p}`;
const { createTypstCompiler, createTypstFontBuilder, initOptions, MemoryAccessModel } = await import(pathToFileURL(mod('typst.ts/dist/esm/index.mjs')).href);
const version = JSON.parse(readFileSync(mod('typst.ts/package.json'), 'utf8')).version;
const wasmBytes = readFileSync(mod('typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm'));
const wasm = await WebAssembly.compile(wasmBytes);
const repo = new URL('../../', import.meta.url).pathname;
const out = { typstTs: version, node: process.version, wasmBytes: wasmBytes.length };
const time = async (fn) => { const t = performance.now(); const r = await fn(); return { ms: Math.round(performance.now() - t), r }; };
const errs = (r) => (r.diagnostics || []).filter((d) => d.severity === 'error').map((d) => d.message);

// Packages from packages.typst.org, fetched synchronously (the registry contract is synchronous, S3).
class Registry {
  constructor(am) { this.am = am; this.cache = new Map(); this.served = []; }
  resolve(spec, ctx) {
    const key = `${spec.namespace}/${spec.name}/${spec.version}`;
    if (this.cache.has(key)) return this.cache.get(key);
    let data;
    try { data = execFileSync('curl', ['-sSfL', `https://packages.typst.org/${spec.namespace}/${spec.name}-${spec.version}.tar.gz`], { maxBuffer: 64 << 20 }); } catch { return undefined; }
    const dir = `/@memory/pkg/${key}`;
    ctx.untar(new Uint8Array(data), (path, bytes, mtime) => this.am.insertFile(`${dir}/${path}`, bytes, new Date(mtime)));
    this.cache.set(key, dir); this.served.push(key);
    return dir;
  }
}

async function makeCompiler(fontSetup) {
  const am = new MemoryAccessModel();
  const registry = new Registry(am);
  const c = createTypstCompiler();
  const t = await time(() => c.init({ getModule: () => wasm, beforeBuild: [initOptions.withAccessModel(am), initOptions.withPackageRegistry(registry)] }));
  const fb = createTypstFontBuilder();
  await fb.init({ getModule: () => wasm });
  await fontSetup(fb);
  await fb.build(async (r) => c.setFonts(r));
  return { c, registry, initMs: t.ms, fb };
}

// Typst version embedded in this compiler.
async function typstVersion(c) {
  c.addSource('/v.typ', '#metadata(str(sys.version)) <v>');
  return c.runWithWorld({ mainFilePath: '/v.typ' }, async (w) => { await w.compile({ diagnostics: 'full' }); return w.query({ selector: '<v>', field: 'value' }); });
}

// ---- A. the S2 workload ----
{
  const dejavu = '/usr/share/fonts/truetype/dejavu/';
  const { c, initMs } = await makeCompiler(async (fb) => { for (const f of ['DejaVuSerif.ttf', 'DejaVuSerif-Bold.ttf', 'DejaVuSerif-Italic.ttf', 'DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSansMono.ttf', 'DejaVuMathTeXGyre.ttf']) await fb.addFontData(readFileSync(dejavu + f)); });
  out.typst = await typstVersion(c);
  const chapter = (title, n, seed) => `= ${title}\n` + Array.from({ length: n }, (_, i) =>
    `== Section ${i + 1}\n#lorem(${180 + ((i * 37 + seed) % 90)})\n\n$ sum_(k=1)^n k^${(i % 3) + 1} = O(n^${(i % 3) + 2}) $\n\n#lorem(${120 + ((i * 53 + seed) % 80)})\n`).join('\n');
  c.addSource('/main.typ', `#set text(font: "DejaVu Serif", size: 10pt)\n#set page(paper: "a4", numbering: "1")\n#set heading(numbering: "1.1")\n#show math.equation: set text(font: "DejaVu Math TeX Gyre")\n#align(center)[#image("/img/logo.png", width: 3cm)]\n#outline()\n#include "/chapters/one.typ"\n#include "/chapters/two.typ"\n#figure(table(columns: 3, [a], [b], [c], [1], [2], [3]), caption: [A table])\n`);
  c.addSource('/chapters/one.typ', chapter('Chapter one', 14, 3));
  let two = chapter('Chapter two', 14, 11);
  c.addSource('/chapters/two.typ', two);
  c.mapShadow('/img/logo.png', new Uint8Array(readFileSync('/usr/share/pixmaps/language-selector.png')));
  const compile = () => c.compile({ mainFilePath: '/main.typ', diagnostics: 'full' });
  const a = { initMs };
  let t = await time(compile); a.cold = { ms: t.ms, bytes: t.r.result?.length, errors: errs(t.r) };
  t = await time(compile); a.warm = t.ms;
  two += '\n== Added section\n#lorem(60)\n'; c.addSource('/chapters/two.typ', two);
  t = await time(compile); a.fileEdited = t.ms;
  c.addSource('/chapters/two.typ', two.replace('Added section', 'Added section, edited'));
  t = await time(compile); a.wordEdited = t.ms;
  await c.withIncrementalServer(async (s) => {
    let r = await time(() => c.compile({ mainFilePath: '/main.typ', incrementalServer: s, diagnostics: 'full' }));
    a.incrFirst = r.ms;
    c.addSource('/chapters/two.typ', two.replace('Added section', 'Added section, incremental'));
    r = await time(() => c.compile({ mainFilePath: '/main.typ', incrementalServer: s, diagnostics: 'full' }));
    a.incrWordEdited = { ms: r.ms, deltaBytes: r.r.result?.length };
  });
  t = await time(() => c.compile({ mainFilePath: '/main.typ', format: 1, diagnostics: 'full' }));
  a.pdf = { ms: t.ms, bytes: t.r.result?.length };
  out.s2 = a;
}

// ---- B, C, D: swarmtyp's lazy font index, the starter, packages ----
{
  const index = JSON.parse(readFileSync(`${repo}src/compile/fonts-index.json`, 'utf8'));
  const loaded = [];
  const { c, registry } = await makeCompiler(async (fb) => {
    for (const e of index) await fb.addLazyFont(e.info, () => { loaded.push(e.file); return new Uint8Array(execFileSync('curl', ['-sSf', `${bee}/bytes/${e.ref}`], { maxBuffer: 16 << 20 })); });
  });
  const pulled = async (name, src) => {
    const from = loaded.length; c.addSource(`/${name}.typ`, src);
    const t = await time(() => c.compile({ mainFilePath: `/${name}.typ`, diagnostics: 'full' }));
    return { ms: t.ms, errors: errs(t.r), facesFetched: loaded.slice(from) };
  };
  out.lazyFonts = {
    text: await pulled('text', '= A heading\nPlain text in the default font.'),
    textAgain: await pulled('text2', '= Another heading\nMore text.'),
    maths: await pulled('maths', '= Maths\nInline $a^2 + b^2 = c^2$ and _italic_.'),
  };
  // C. the starter, as the app compiles it
  c.addSource('/main.typ', readFileSync(`${repo}src/app/starter.typ`, 'utf8'));
  let t = await time(() => c.compile({ mainFilePath: '/main.typ', diagnostics: 'full' }));
  const starter = { coldMs: t.ms, errors: errs(t.r), warnings: (t.r.diagnostics || []).filter((d) => d.severity === 'warning').map((d) => d.message), packages: [...registry.served] };
  t = await time(() => c.compile({ mainFilePath: '/main.typ', diagnostics: 'full' })); starter.warmMs = t.ms;
  t = await time(() => c.compile({ mainFilePath: '/main.typ', format: 1, diagnostics: 'full' }));
  if (t.r.result) writeFileSync(`${outDir}/starter.pdf`, t.r.result);
  starter.pdf = { ms: t.ms, bytes: t.r.result?.length };
  out.starter = starter;
  // D. packages that need Typst 0.15.0 and 0.15.1
  out.packages015 = {};
  for (const spec of ['@preview/bar-point:0.1.0', '@preview/algol-code:0.1.0']) {
    const name = spec.replace(/\W+/g, '_');
    c.addSource(`/${name}.typ`, `#import "${spec}": *\nImported.`);
    const r = await c.compile({ mainFilePath: `/${name}.typ`, diagnostics: 'full' });
    out.packages015[spec] = errs(r).length ? errs(r).slice(0, 2) : 'ok';
  }
}

writeFileSync(`${outDir}/results.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
