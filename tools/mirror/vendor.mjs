// Vendor a handful of Typst Universe packages onto Swarm (Phase 1 stand-in for the Phase 3 mirror, design §4.6, D-08).
// Downloads each tarball from packages.typst.org, records its licence from typst.toml, uploads it as bytes, and writes
// src/compile/packages-index.json: "preview/<name>/<version>" -> reference. Usage: node tools/mirror/vendor.mjs name:version ...
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const specs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!specs.length) { console.error('usage: node tools/mirror/vendor.mjs name:version ...'); process.exit(1); }
const env = existsSync('.env.local') ? Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.split('=').map((s) => s.trim()))) : {};
const bee = process.env.VITE_BEE_URL || env.VITE_BEE_URL || 'http://127.0.0.1:1633';
const stamp = process.env.VITE_STAMP || env.VITE_STAMP;
if (!stamp) { console.error('no postage batch id'); process.exit(1); }
const outPath = new URL('../../src/compile/packages-index.json', import.meta.url);
const index = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : {};
const meta = existsSync(new URL('../../src/compile/packages-meta.json', import.meta.url)) ? JSON.parse(readFileSync(new URL('../../src/compile/packages-meta.json', import.meta.url), 'utf8')) : {};
// Minimal tar reader to find typst.toml inside the (gunzipped) tarball.
function tarEntries(buf) { const out = []; let o = 0; while (o + 512 <= buf.length) { const name = buf.subarray(o, o + 100).toString().replace(/\0.*$/, ''); if (!name) break; const size = parseInt(buf.subarray(o + 124, o + 136).toString().replace(/\0.*$/, '').trim(), 8) || 0; out.push({ name, data: buf.subarray(o + 512, o + 512 + size) }); o += 512 + Math.ceil(size / 512) * 512; } return out; }
for (const spec of specs) {
  const [name, version] = spec.split(':'); const key = `preview/${name}/${version}`;
  const url = `https://packages.typst.org/preview/${name}-${version}.tar.gz`;
  const res = await fetch(url); if (!res.ok) { console.error(`${spec}: ${res.status} from packages.typst.org`); process.exit(1); }
  const bytes = Buffer.from(await res.arrayBuffer());
  const toml = tarEntries(gunzipSync(bytes)).find((e) => /(^|\/)typst\.toml$/.test(e.name))?.data.toString() ?? '';
  const licence = /^\s*license\s*=\s*"([^"]+)"/m.exec(toml)?.[1] ?? 'unknown';
  const up = await fetch(`${bee}/bytes`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'Swarm-Postage-Batch-Id': stamp, 'Swarm-Pin': 'true' }, body: bytes });
  if (!up.ok) { console.error(`${spec}: upload ${up.status} ${await up.text()}`); process.exit(1); }
  const ref = (await up.json()).reference;
  index[key] = ref; meta[key] = { licence, bytes: bytes.length, source: url, fetched: new Date().toISOString().slice(0, 10) };
  console.log(`${key}: ${bytes.length} B, licence ${licence}, ${ref.slice(0, 12)}…`);
}
writeFileSync(outPath, JSON.stringify(index, null, 1));
writeFileSync(new URL('../../src/compile/packages-meta.json', import.meta.url), JSON.stringify(meta, null, 1));
console.log(`packages-index.json: ${Object.keys(index).length} packages`);
