// Upload dist/ as a Swarm collection and print the reference (design §4.11). Feed and ENS come with M1 hardening.
// Usage: node tools/deploy/deploy.mjs [--bee http://127.0.0.1:1633] [--stamp <batch id>]; falls back to VITE_BEE_URL / VITE_STAMP from .env.local.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]] : []).filter((p) => p.length));
const env = existsSync('.env.local') ? Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.split('=').map((s) => s.trim()))) : {};
const bee = args.bee || process.env.VITE_BEE_URL || env.VITE_BEE_URL || 'http://127.0.0.1:1633';
const stamp = args.stamp || process.env.VITE_STAMP || env.VITE_STAMP;
if (!stamp) { console.error('no postage batch id: pass --stamp or set VITE_STAMP in .env.local'); process.exit(1); }
if (!existsSync('dist/index.html')) { console.error('dist/ missing: run pnpm build first'); process.exit(1); }
const tar = execSync('tar -C dist -cf - .', { maxBuffer: 1 << 30 });
const t0 = Date.now();
const res = await fetch(`${bee}/bzz?name=swarmtyp`, { method: 'POST', headers: { 'Content-Type': 'application/x-tar', 'Swarm-Collection': 'true', 'Swarm-Index-Document': 'index.html', 'Swarm-Error-Document': 'index.html', 'Swarm-Pin': 'true', 'Swarm-Postage-Batch-Id': stamp }, body: tar });
if (!res.ok) { console.error(`upload failed: ${res.status} ${await res.text()}`); process.exit(1); }
const { reference } = await res.json();
console.log(`uploaded ${(tar.length / 1048576).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`reference: ${reference}`);
console.log(`local:     ${bee}/bzz/${reference}/`);
console.log(`freedom:   bzz://${reference}/`);
