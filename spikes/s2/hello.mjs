import { makeCompiler, queryCompiled } from './fonts.mjs';
const { compiler, timings } = await makeCompiler();
compiler.addSource('/main.typ', `#set text(font: "DejaVu Serif")\n#show math.equation: set text(font: "DejaVu Math TeX Gyre")\n= Hello from swarmtyp\nCompiled by Typst #sys.version on typst.ts.\n$ integral_0^1 x^2 dif x = 1/3 $\n#context [#metadata(str(sys.version)) <v>]`);
const t = performance.now();
const r = await compiler.compile({ mainFilePath: '/main.typ', diagnostics: 'full' });
const compileMs = Math.round(performance.now() - t);
const v = r.diagnostics?.length ? null : await queryCompiled(compiler, '/main.typ', '<v>', 'value');
console.log(JSON.stringify({ ...timings, compileMs, artifactBytes: r.result?.length, diagnostics: r.diagnostics, typstVersion: v }));
