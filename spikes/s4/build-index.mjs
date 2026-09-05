// S4: build a lazy font index (typst.ts getFontInfo) for the DejaVu faces and upload each face to Swarm as bytes.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createTypstFontBuilder } from '@myriaddreamin/typst.ts';
const require = createRequire(import.meta.url);
const wasmPath = require.resolve('@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm');
const beeUrl = 'http://127.0.0.1:1633';
const batch = readFileSync(process.env.BATCH_FILE, 'utf8').trim();
const fontDir = '/usr/share/fonts/truetype/dejavu/';
const faces = ['DejaVuSerif.ttf', 'DejaVuSerif-Bold.ttf', 'DejaVuSerif-Italic.ttf', 'DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSansMono.ttf', 'DejaVuMathTeXGyre.ttf'];
const fb = createTypstFontBuilder();
await fb.init({ getModule: () => readFileSync(wasmPath) });
const index = [];
for (const f of faces) {
  const bytes = readFileSync(fontDir + f);
  const info = await fb.getFontInfo(new Uint8Array(bytes));
  const res = await fetch(`${beeUrl}/bytes`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'Swarm-Postage-Batch-Id': batch, 'Swarm-Pin': 'true' }, body: bytes });
  const { reference } = await res.json();
  index.push({ file: f, bytes: bytes.length, ref: reference, info });
  console.log(f, bytes.length, 'bytes →', reference.slice(0, 12) + '…');
}
writeFileSync('../s1/site/fonts-index.json', JSON.stringify(index));
console.log('index entries:', index.length, 'index bytes:', JSON.stringify(index).length);
console.log('sample info:', JSON.stringify(index[0].info).slice(0, 600));
