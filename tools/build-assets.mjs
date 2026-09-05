// Prepare static assets before `vite build`: the compiler WASM is shipped gzipped (Bee serves bytes as stored,
// design §4.11) and the app inflates it with DecompressionStream after fetching it in ranges.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const require = createRequire(import.meta.url);
const src = require.resolve('@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm');
const outDir = new URL('../public/wasm/', import.meta.url);
const out = new URL('compiler.wasm.bin', outDir); // gzip bytes; the extension is neutral so no server adds Content-Encoding and breaks Range pieces
mkdirSync(outDir, { recursive: true });
if (existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) { console.log('compiler.wasm.bin up to date'); }
else { const gz = gzipSync(readFileSync(src), { level: 9 }); writeFileSync(out, gz); console.log(`compiler.wasm.bin: ${gz.length} bytes`); }
