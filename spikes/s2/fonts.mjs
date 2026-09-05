// Shared: init a typst.ts 0.7 compiler in Node with local DejaVu fonts via the font builder API.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createTypstCompiler, createTypstFontBuilder, initOptions, MemoryAccessModel } from '@myriaddreamin/typst.ts';
const require = createRequire(import.meta.url);
export const wasmPath = require.resolve('@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm');
const fontDir = '/usr/share/fonts/truetype/dejavu/';
export const fontFiles = ['DejaVuSerif.ttf', 'DejaVuSerif-Bold.ttf', 'DejaVuSerif-Italic.ttf', 'DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSansMono.ttf', 'DejaVuMathTeXGyre.ttf'];

export async function makeCompiler({ am, registry } = {}) {
  const t0 = performance.now();
  const wasmBytes = readFileSync(wasmPath);
  const tw = performance.now();
  const wasm = await WebAssembly.compile(wasmBytes);   // compile once, share between compiler and font builder
  const wasmCompileMs = Math.round(performance.now() - tw);
  const beforeBuild = [];
  if (am) beforeBuild.push(initOptions.withAccessModel(am));
  if (registry) beforeBuild.push(initOptions.withPackageRegistry(registry));
  const compiler = createTypstCompiler();
  await compiler.init({ getModule: () => wasm, beforeBuild });
  const t1 = performance.now();
  const fb = createTypstFontBuilder();
  await fb.init({ getModule: () => wasm });
  let fontBytes = 0;
  for (const f of fontFiles) { const b = readFileSync(fontDir + f); fontBytes += b.length; await fb.addFontData(b); }
  await fb.build(async (resolver) => { compiler.setFonts(resolver); });
  const t2 = performance.now();
  return { compiler, timings: { wasmBytes: wasmBytes.length, wasmCompileMs, compilerInitMs: Math.round(t1 - t0), fontsMs: Math.round(t2 - t1), fontBytes } };
}
export { MemoryAccessModel };

// typst.ts 0.7: `compiler.query` runs on a fresh world snapshot that is not compiled yet; compile inside runWithWorld first.
export async function queryCompiled(compiler, mainFilePath, selector, field) {
  return compiler.runWithWorld({ mainFilePath }, async (world) => {
    const c = await world.compile({ diagnostics: 'full' });
    if (c.hasError) return { error: c.diagnostics };
    return world.query({ selector, field });
  });
}
