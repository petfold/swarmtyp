// Upload dist/ as a Swarm collection, then advance the release feed and print the stable feed-manifest address
// (design §4.11, D-14 recipe). ENS on top is Phase 4.
// Usage: node tools/deploy/deploy.mjs [--bee URL] [--stamp <batch id>] [--no-feed]
// Env / .env.local: VITE_BEE_URL, VITE_STAMP, SWARMTYP_FEED_KEY (secp256k1 hex; generated and appended to .env.local when missing).
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Bee, PrivateKey, Topic } from 'bee-js13';
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

if (!('no-feed' in args)) {
  let key = process.env.SWARMTYP_FEED_KEY || env.SWARMTYP_FEED_KEY;
  if (!key) {
    key = randomBytes(32).toString('hex');
    appendFileSync('.env.local', `\nSWARMTYP_FEED_KEY=${key}\n`);
    console.log('generated a release feed key and appended SWARMTYP_FEED_KEY to .env.local (keep it; losing it orphans the feed)');
  }
  const signer = new PrivateKey(key);
  const topic = Topic.fromString('swarmtyp/release');
  const beeJs = new Bee(bee);
  const writer = beeJs.feed.makeWriter(topic, signer);
  const update = await writer.uploadReference(stamp, reference);
  const manifest = await beeJs.feed.createManifest(stamp, topic, signer.publicKey().address());
  console.log(`feed owner: ${signer.publicKey().address().toHex()} topic swarmtyp/release, update index ${update.feedIndex?.toString?.() ?? '?'}`);
  console.log(`stable:    ${bee}/bzz/${manifest.toHex()}/   (feed manifest; follows every release)`);
  console.log(`freedom:   bzz://${manifest.toHex()}/`);
}
