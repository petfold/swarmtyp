// Upload dist/ as a Swarm collection, wait until the network can serve it, then advance the release feed and print the
// stable feed-manifest address (design §4.11, D-14 recipe). ENS on top is Phase 4.
// Usage: node tools/deploy/deploy.mjs [--bee URL] [--stamp <batch id>] [--no-feed] [--reference <ref>] [--no-wait] [--timeout <minutes>]
//   --reference  skip the upload: check and publish a collection uploaded earlier (e.g. after a timed-out wait)
//   --no-wait    advance the feed at once, without waiting for push-sync and the public check
// Env / .env.local: VITE_BEE_URL, VITE_STAMP, SWARMTYP_FEED_KEY (secp256k1 hex; generated and appended to .env.local when missing).
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync, readdirSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Bee, PrivateKey, Topic } from 'bee-js13';
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]] : []).filter((p) => p.length));
const env = existsSync('.env.local') ? Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.split('=').map((s) => s.trim()))) : {};
const bee = args.bee || process.env.VITE_BEE_URL || env.VITE_BEE_URL || 'http://127.0.0.1:1633';
const stamp = args.stamp || process.env.VITE_STAMP || env.VITE_STAMP;
/** Where visitors without a node read from (D-25): the release is only published once this serves it whole. */
const PUBLIC_GATEWAY = 'https://download.gateway.ethswarm.org';
const timeoutMs = Number(args.timeout ?? 30) * 60_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!stamp) { console.error('no postage batch id: pass --stamp or set VITE_STAMP in .env.local'); process.exit(1); }
if (!existsSync('dist/index.html')) { console.error('dist/ missing: run pnpm build first'); process.exit(1); }

let reference = args.reference;
let tagUid = null;
if (!reference) {
  const tar = execSync('tar -C dist -cf - .', { maxBuffer: 1 << 30 });
  const t0 = Date.now();
  const res = await fetch(`${bee}/bzz?name=swarmtyp`, { method: 'POST', headers: { 'Content-Type': 'application/x-tar', 'Swarm-Collection': 'true', 'Swarm-Index-Document': 'index.html', 'Swarm-Error-Document': 'index.html', 'Swarm-Pin': 'true', 'Swarm-Postage-Batch-Id': stamp }, body: tar });
  if (!res.ok) { console.error(`upload failed: ${res.status} ${await res.text()}`); process.exit(1); }
  ({ reference } = await res.json());
  tagUid = res.headers.get('swarm-tag');
  console.log(`uploaded ${(tar.length / 1048576).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
console.log(`reference: ${reference}`);
console.log(`local:     ${bee}/bzz/${reference}/`);
console.log(`freedom:   bzz://${reference}/`);

// Bee answers the upload once the chunks are in its own store; a light node then pushes them out in the background.
// Advancing the feed before that finishes points swarmtyp.gwei at files the gateways cannot assemble yet: on
// 2026-10-08 visitors got "compiler failed: Failed to fetch" for about seven minutes (D-25, release lesson).
const deadline = Date.now() + timeoutMs;
const resume = () => { console.error(`not published. Once it has synced: node tools/deploy/deploy.mjs --reference ${reference}`); process.exit(1); };
if (!('no-wait' in args) && tagUid) {
  let last = '';
  for (;;) {
    const t = await fetch(`${bee}/tags/${tagUid}`).then((r) => r.ok ? r.json() : null).catch(() => null);
    if (t) {
      const done = t.synced + t.seen;
      const line = `push-sync: ${done}/${t.split} chunks (synced ${t.synced}, already known ${t.seen})`;
      if (line !== last) { console.log(line); last = line; }
      if (t.split > 0 && done >= t.split) break;
    }
    if (Date.now() > deadline) { console.error('push-sync did not finish in time'); resume(); }
    await sleep(5000);
  }
}
// The files a first visit cannot do without, fetched whole through the public gateway (each attempt under its own
// URL: that gateway's cache keeps truncated and wrong-offset answers, S11).
if (!('no-wait' in args)) {
  const files = ['index.html', 'wasm/compiler.wasm.bin', ...readdirSync('dist/assets').map((f) => `assets/${f}`).sort((a, b) => statSync(`dist/${b}`).size - statSync(`dist/${a}`).size).slice(0, 3)];
  for (const f of files) {
    const want = statSync(`dist/${f}`).size;
    for (let n = 1; ; n++) {
      const got = await fetch(`${PUBLIC_GATEWAY}/bzz/${reference}/${f}?check=${Date.now()}`).then((r) => r.ok ? r.arrayBuffer() : null).then((b) => b?.byteLength ?? 0).catch(() => 0);
      if (got === want) { console.log(`public:    ${f} whole (${want} bytes)`); break; }
      if (Date.now() > deadline) { console.error(`public gateway still serves ${got} of ${want} bytes of ${f}`); resume(); }
      console.log(`public:    ${f} ${got} of ${want} bytes, retrying (attempt ${n})`);
      await sleep(20_000);
    }
  }
}

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
