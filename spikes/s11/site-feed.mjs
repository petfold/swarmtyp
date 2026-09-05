// S11: give the paged site a stable address (feed manifest) so a name's contenthash never needs a second transaction.
// Usage: node spikes/s11/site-feed.mjs <site reference>   (key S11_SITE_FEED_KEY generated into .env.local, never committed)
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Bee, PrivateKey, Topic } from 'bee-js13';
const env = existsSync('.env.local') ? Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.split('=').map((s) => s.trim()))) : {};
const bee = process.env.VITE_BEE_URL || env.VITE_BEE_URL || 'http://127.0.0.1:1633'; const stamp = process.env.VITE_STAMP || env.VITE_STAMP;
const reference = process.argv[2]; if (!/^[0-9a-f]{64}$/.test(reference || '')) throw new Error('pass the site reference');
let key = env.S11_SITE_FEED_KEY; if (!key) { key = randomBytes(32).toString('hex'); appendFileSync('.env.local', `\nS11_SITE_FEED_KEY=${key}\n`); console.log('generated S11_SITE_FEED_KEY into .env.local'); }
const signer = new PrivateKey(key); const topic = Topic.fromString('swarmtyp/s11-site'); const b = new Bee(bee);
const update = await b.feed.makeWriter(topic, signer).uploadReference(stamp, reference);
const manifest = await b.feed.createManifest(stamp, topic, signer.publicKey().address());
console.log(`feed owner ${signer.publicKey().address().toHex()}, index ${update.feedIndex?.toString?.() ?? '?'}`);
console.log(`site manifest: ${manifest.toHex()}\nlocal: ${bee}/bzz/${manifest.toHex()}/\nfreedom: bzz://${manifest.toHex()}/\ncontenthash value to paste: bzz://${manifest.toHex()}`);
