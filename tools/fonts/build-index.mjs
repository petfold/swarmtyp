// Build the lazy font index (design §4.7, S4): read each face, ask typst.ts for its font info, upload the face to Swarm
// as bytes, and write src/compile/fonts-index.json with the reference and the licence. Faces are content-addressed,
// so re-running only re-uploads what changed. Usage: node tools/fonts/build-index.mjs <manifest.json> [--bee URL] [--stamp ID]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { createTypstFontBuilder } from '@myriaddreamin/typst.ts';
const require = createRequire(import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a, _, arr) => [a.slice(2), arr[arr.indexOf(a) + 1]]));
const manifestPath = process.argv[2];
if (!manifestPath || manifestPath.startsWith('--')) { console.error('usage: node tools/fonts/build-index.mjs <manifest.json> [--bee URL] [--stamp ID]'); process.exit(1); }
const env = existsSync('.env.local') ? Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.split('=').map((s) => s.trim()))) : {};
const bee = args.bee || process.env.VITE_BEE_URL || env.VITE_BEE_URL || 'http://127.0.0.1:1633';
const stamp = args.stamp || process.env.VITE_STAMP || env.VITE_STAMP;
if (!stamp) { console.error('no postage batch id'); process.exit(1); }
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); // [{ file, family, licence, source }]
const base = dirname(resolve(manifestPath));
const outPath = new URL('../../src/compile/fonts-index.json', import.meta.url);
const previous = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : [];
const fb = createTypstFontBuilder();
await fb.init({ getModule: () => readFileSync(require.resolve('@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm')) });
const index = [];
for (const entry of manifest) {
  const path = resolve(base, entry.file); const bytes = readFileSync(path); const file = basename(entry.file);
  const info = await fb.getFontInfo(new Uint8Array(bytes));
  const old = previous.find((p) => p.file === file && p.bytes === bytes.length);
  let ref = old?.ref;
  if (!ref) {
    const res = await fetch(`${bee}/bytes`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'Swarm-Postage-Batch-Id': stamp, 'Swarm-Pin': 'true' }, body: bytes });
    if (!res.ok) throw new Error(`upload ${file}: ${res.status} ${await res.text()}`);
    ref = (await res.json()).reference;
  }
  index.push({ file, family: entry.family, licence: entry.licence, source: entry.source, bytes: bytes.length, ref, info });
  console.log(`${old ? 'kept    ' : 'uploaded'} ${file} ${bytes.length} B ${ref.slice(0, 12)}…`);
}
writeFileSync(outPath, JSON.stringify(index));
const total = index.reduce((a, e) => a + e.bytes, 0);
console.log(`index: ${index.length} faces, ${total} bytes of fonts, ${JSON.stringify(index).length} bytes of index -> src/compile/fonts-index.json`);
