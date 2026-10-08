// S13: can a page in Freedom write what the collaboration library writes, through window.swarm as it is, in a form a
// Bee-backed peer reads, and the reverse? Freedom (../freedom-browser) runs on the S13 profile, whose Ant node bought
// storage in freedom-setup.cjs; the other side is bee-js 13.1 on the Swarm Desktop node (127.0.0.1:1633).
//   node spikes/s13/s13.cjs            results to spikes/s13/results.json
//   --dry   any profile (S13_DEVHOME), no storage needed: writes fail, everything else runs; results to results-dry.json
//   --external  any profile (S13_DEVHOME) that takes Swarm Desktop (127.0.0.1:1633) as Freedom's node: Freedom stamps
//               with that node's batches, no purchase needed; results to results-external.json
// Never calls identity.injectAll: that wipes the node's key, and with it the wallet that owns the storage.
const { _electron: electron } = require('/home/test/projects/freedom-browser/node_modules/playwright');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');

const repo = '/home/test/projects/freedom-browser';
const devHome = process.env.S13_DEVHOME || '/home/test/freedom-s13/devhome';
const DRY = process.argv.includes('--dry');
const EXTERNAL = process.argv.includes('--external');
const vaultPasswordFile = DRY || EXTERNAL ? `${devHome}/../vault-password.txt` : '/home/test/freedom-s13/vault-password.txt';
const resultsFile = `${__dirname}/${DRY ? 'results-dry' : EXTERNAL ? 'results-external' : 'results'}.json`;
const NODE_WALLET = '0xc555a6efc44fae25e5a5755301f957a7f82d5c16';
const BEE = 'http://127.0.0.1:1633';
const SITE = 'bzz://fff4e38ecaeb5253c1c7eae0e24daf655cc9ae995df806e507af0094de072910/'; // the S11 sample site: a small page to be the origin
const env = Object.fromEntries(fs.readFileSync('/home/test/projects/swarmtyp/.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.split('=').map((s) => s.trim())));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s`, ...a);
const results = { started: new Date().toISOString() };

(async () => {
  const bj = await import(`${__dirname}/node_modules/@ethersphere/bee-js/dist/mjs/index.js`);
  const { makeFeedIdentifier } = await import(`${__dirname}/node_modules/@ethersphere/bee-js/dist/mjs/feed/identifier.js`);
  const { Bee, Bytes, PrivateKey, Topic, Identifier } = bj;
  const bee = new Bee(BEE);
  const hex = (b) => Buffer.from(b instanceof Uint8Array ? b : b.toUint8Array()).toString('hex');
  const feedId = (topic, i) => makeFeedIdentifier(topic, i).toHex();
  const run = crypto.randomBytes(4).toString('hex'); // fresh topics every run

  const app = await electron.launch({ args: ['.'], cwd: repo, timeout: 120000, env: { ...process.env, FREEDOM_DEV_HOME: devHome, FREEDOM_TEST_HIDE_WINDOW: '0' } });
  const win = await app.firstWindow({ timeout: 120000 });
  await win.waitForLoadState('domcontentloaded');
  for (let i = 0; i < 30; i++) {
    const open = await win.evaluate(() => { const d = document.getElementById('external-node-candidates-modal'); return !!(d && d.open); });
    if (open && EXTERNAL) { // "Use External" for the Swarm row, managed for anything else
      const chose = await win.evaluate(() => { const out = []; for (const row of document.querySelectorAll('#external-node-candidates-list .external-node-row')) { const ext = /bee|swarm/i.test(row.dataset.protocol); row.querySelector(`input[value="${ext ? 'external' : 'managed'}"]`)?.click(); out.push(`${row.dataset.protocol}:${ext ? 'external' : 'managed'}`); } document.getElementById('external-node-candidates-submit')?.click(); return out; });
      log('external-node dialog', JSON.stringify(chose)); break;
    }
    if (open) { await win.evaluate(() => (document.getElementById('external-node-candidates-managed') || document.getElementById('external-node-candidates-close'))?.click()); break; }
    await sleep(1000);
  }
  // Storage must be usable before anything else.
  let st;
  for (let i = 0; i < (DRY ? 6 : 120); i++) { st = await win.evaluate(() => window.publishSetup.getState()); if (st?.readiness?.ok) break; await sleep(5000); }
  results.node = { readiness: st.readiness, wallet: st.account?.walletAddress, stamps: st.stamps };
  log('node', JSON.stringify(results.node));
  if (!DRY && !st.readiness.ok) throw new Error('Freedom node cannot publish yet: ' + st.readiness.message);
  const wallet0 = st.account?.walletAddress;
  if (!DRY && !EXTERNAL && wallet0 !== NODE_WALLET) throw new Error('node wallet changed: ' + wallet0);

  // A vault for Freedom's signing identities (created once, never injected into the node).
  let password = fs.existsSync(vaultPasswordFile) ? fs.readFileSync(vaultPasswordFile, 'utf8').trim() : null;
  // identity.hasVault() and isUnlocked() answer { hasVault } and { isUnlocked }, not booleans.
  if (!(await win.evaluate(() => window.identity.hasVault())).hasVault) {
    password = crypto.randomBytes(18).toString('base64url');
    fs.writeFileSync(vaultPasswordFile, password + '\n', { mode: 0o600 });
    const r = await win.evaluate((p) => window.identity.createVault(p, 256, true), password);
    log('vault created', r.success ? 'ok' : r.error);
    if (!r.success) throw new Error('vault: ' + r.error);
  }
  if (!(await win.evaluate(() => window.identity.isUnlocked())).isUnlocked) log('vault unlock', JSON.stringify(await win.evaluate((p) => window.identity.unlock(p), password)));
  results.vault = await win.evaluate(() => window.identity.getStatus());
  log('vault', JSON.stringify(results.vault).slice(0, 300));
  st = await win.evaluate(() => window.publishSetup.getState());
  if (st.account?.walletAddress !== wallet0) throw new Error('node wallet changed after the vault: ' + st.account?.walletAddress);

  // Answer Freedom's permission prompts as they appear (connection, feeds, messaging, uploads, a publisher identity).
  let approving = true;
  const prompts = [];
  (async () => {
    while (approving) {
      const clicked = await win.evaluate(() => {
        const visible = (id) => { const e = document.getElementById(id); return e && e.offsetParent !== null ? e : null; };
        const tick = (id) => { const c = visible(id); if (c && !c.checked) c.click(); };
        for (const [box, button] of [[null, 'swarm-connect-approve'], ['swarm-feed-auto-approve', 'swarm-feed-approve'], ['swarm-messaging-auto-approve', 'swarm-messaging-confirm'], ['swarm-publish-auto-approve', 'swarm-publish-confirm'], [null, 'publisher-identity-create-save']]) {
          const b = visible(button); if (!b || b.disabled) continue;
          if (box) tick(box);
          b.click(); return button;
        }
        return null;
      }).catch(() => null);
      if (clicked) { prompts.push(clicked); log('approved', clicked); }
      await sleep(400);
    }
  })();

  const evalPage = (js) => win.evaluate(async (s) => { const wv = document.querySelector('webview:not(.hidden)'); if (!wv) return { error: 'no webview' }; try { return await wv.executeJavaScript(s); } catch (e) { return { error: e.message }; } }, js);
  // params as JSON, or as a JS expression evaluated in the page (for bytes: `new Uint8Array(...)`).
  const call = async (method, params, expr) => evalPage(`(async () => { try { return { ok: await window.swarm.${method}(${expr ?? (params === undefined ? '' : JSON.stringify(params))}) }; } catch (e) { return { error: e.message, code: e.code, data: e.data }; } })()`);
  const go = async (url) => { const input = win.locator('[data-test="address-input"]'); await input.click(); await input.fill(url); await input.press('Enter'); };
  await go(SITE);
  for (let i = 0; i < 60; i++) { await sleep(3000); const href = await evalPage('location.href'); if (typeof href === 'string' && href.startsWith('bzz://')) { log('page', href); break; } }
  results.access = await call('requestAccess');
  log('requestAccess', JSON.stringify(results.access));
  results.capabilities = await call('getCapabilities');
  const ident = await call('getSigningIdentity');
  results.identity = ident;
  log('signing identity', JSON.stringify(ident));
  const owner = (ident.ok?.owner || '').replace(/^0x/, '').toLowerCase();

  // 1. Feed entries written by Freedom, read by bee-js on the Bee node.
  const topicA = Topic.fromString(`swarmtyp/s13/${run}/a`);
  results.feedFromFreedom = [];
  for (let i = 0; i < 3; i++) {
    const data = `s13 ${run} entry ${i} from Freedom`;
    const w = await call('writeSingleOwnerChunk', { identifier: feedId(topicA, i), data });
    const wroteAt = Date.now();
    let read = null, ms = null;
    for (let n = 0; n < (w.ok ? 60 : 0) && !read; n++) {
      try { const r = await bee.feed.makeReader(topicA, owner).downloadPayload({ index: i }); read = r.payload.toUtf8(); ms = Date.now() - wroteAt; } catch { await sleep(2000); }
    }
    results.feedFromFreedom.push({ index: i, write: w.ok ? 'ok' : w, readBack: read === data, visibleAfterMs: ms });
    log('feed from Freedom', i, JSON.stringify(results.feedFromFreedom.at(-1)));
  }
  // ... and the reverse: bee-js writes on the Bee node, Freedom reads.
  const writerKey = new PrivateKey(crypto.randomBytes(32).toString('hex'));
  const topicB = Topic.fromString(`swarmtyp/s13/${run}/b`);
  results.feedToFreedom = [];
  for (let i = 0; i < 3; i++) {
    const data = `s13 ${run} entry ${i} from Bee`;
    await bee.feed.makeWriter(topicB, writerKey).uploadPayload(env.VITE_STAMP, data, { index: i });
    const wroteAt = Date.now();
    let r = null, ms = null;
    for (let n = 0; n < 60; n++) {
      r = await call('readFeedEntry', { topic: topicB.toHex(), owner: writerKey.publicKey().address().toHex(), index: i });
      if (r.ok) { ms = Date.now() - wroteAt; break; }
      await sleep(2000);
    }
    results.feedToFreedom.push({ index: i, read: r.ok ? JSON.stringify(r.ok).slice(0, 200) : r, visibleAfterMs: ms });
    log('feed to Freedom', i, JSON.stringify(results.feedToFreedom.at(-1)).slice(0, 300));
  }

  // 2. A 50 KB snapshot. publishData answers with a manifest (a 384-byte root), not the data's own chunk tree, so the
  // page builds the tree with publishChunk: 4 KB leaves, then a root holding their addresses with the whole length as
  // span, and wraps that root in the feed entry: the bytes bee-js writes for a payload above 4 KB.
  const big = Array.from({ length: 1700 }, (_, k) => `line ${k} of the s13 ${run} snapshot\n`).join('').slice(0, 51200);
  const topicC = Topic.fromString(`swarmtyp/s13/${run}/c`);
  results.big = { publishDataNote: 'publishData returns a manifest reference; not usable for a payload feed' };
  const tree = await evalPage(`(async () => { try {
    const data = new TextEncoder().encode(${JSON.stringify(big)});
    const refs = [];
    for (let i = 0; i < data.length; i += 4096) refs.push((await window.swarm.publishChunk({ data: data.slice(i, i + 4096) })).reference);
    const root = new Uint8Array(refs.length * 32);
    refs.forEach((h, k) => root.set(Uint8Array.from(h.replace(/^0x/, '').match(/../g).map((x) => parseInt(x, 16))), k * 32));
    const rootRef = (await window.swarm.publishChunk({ data: root, span: data.length })).reference;
    const w = await window.swarm.writeSingleOwnerChunk({ identifier: '${feedId(topicC, 0)}', data: root, span: data.length });
    return { leaves: refs.length, rootRef, write: w ? 'ok' : w };
  } catch (e) { return { error: e.message, code: e.code }; } })()`);
  results.big.tree = tree;
  log('chunk tree', JSON.stringify(tree));
  if (!tree.error) {
    let got = null;
    for (let n = 0; n < 60 && got === null; n++) { try { const r = await bee.feed.makeReader(topicC, owner).downloadPayload({ index: 0 }); got = r.payload.toUtf8(); } catch { await sleep(3000); } }
    results.big.readBack = got === big; results.big.bytes = got?.length ?? 0;
    log('big snapshot read back', results.big.readBack, results.big.bytes);
  }

  // 3. Member-list entries as GSOC: Freedom sends, bee-js computes the same key and reads; bee-js sends, Freedom reads.
  const gsocKey = (topic) => {
    const identifier = new Identifier(Bytes.keccak256(Bytes.fromUtf8(topic)));
    const target = Bytes.keccak256(Bytes.fromUtf8('freedom-gsoc-v1:' + topic));
    const signer = bee.messaging.gsocMine(target, identifier, 12);
    const address = Bytes.keccak256(new Bytes(Buffer.concat([Buffer.from(identifier.toUint8Array()), Buffer.from(signer.publicKey().address().toUint8Array())])));
    return { identifier, signer, address: address.toHex() };
  };
  const topicD = `swarmtyp-s13-${run}:dir:0`;
  const sent = await call('sendGsoc', { topic: topicD, data: `member list entry from Freedom ${run}` });
  const mine = gsocKey(topicD);
  results.gsocFromFreedom = { send: sent.ok ?? sent, sameAddress: (sent.ok?.address || '').replace(/^0x/, '') === mine.address };
  for (let n = 0; n < (sent.ok ? 60 : 0); n++) {
    try { const raw = await bee.chunk.download(mine.address); results.gsocFromFreedom.readBack = Buffer.from(raw).toString('utf8').includes(`member list entry from Freedom ${run}`); results.gsocFromFreedom.visibleAfterTries = n; break; } catch { await sleep(2000); }
  }
  log('gsoc from Freedom', JSON.stringify(results.gsocFromFreedom).slice(0, 400));
  const topicE = `swarmtyp-s13-${run}:dir:1`;
  const theirs = gsocKey(topicE);
  await bee.messaging.gsocSend(env.VITE_STAMP, theirs.signer, theirs.identifier, `member list entry from Bee ${run}`);
  results.gsocToFreedom = {};
  for (let n = 0; n < 60; n++) {
    const r = await call('readSingleOwnerChunk', { address: theirs.address });
    if (r.ok) { results.gsocToFreedom.read = JSON.stringify(r.ok).slice(0, 300); results.gsocToFreedom.visibleAfterTries = n; break; }
    results.gsocToFreedom.lastError = r; await sleep(2000);
  }
  log('gsoc to Freedom', JSON.stringify(results.gsocToFreedom).slice(0, 400));

  // 4. The library's read rhythm for one peer without a channel, for two minutes: signal every 2 s, member list every
  // 5 s (directory and one announce), snapshot every 15 s. Does Freedom's read budget hold?
  const ownerB = writerKey.publicKey().address().toHex();
  let reads = 0, limited = 0;
  const until = Date.now() + 120_000;
  for (let tick = 0; Date.now() < until; tick++) {
    const batch = [call('readFeedEntry', { topic: topicB.toHex(), owner: ownerB, index: 0 })];
    if (tick % 5 === 0) batch.push(call('readFeedEntry', { topic: topicB.toHex(), owner: ownerB, index: 1 }), call('readFeedEntry', { topic: topicB.toHex(), owner: ownerB, index: 2 }));
    if (tick % 15 === 0) batch.push(call('readFeedEntry', { topic: topicA.toHex(), owner, index: 0 }));
    for (const r of await Promise.all(batch)) { reads++; if (r.error && /rate|budget/i.test(JSON.stringify(r))) limited++; }
    await sleep(2000);
  }
  results.readRhythm = { reads, perMinute: Math.round(reads / 2), rateLimited: limited };
  log('read rhythm', JSON.stringify(results.readRhythm));

  results.prompts = prompts;
  approving = false;
  results.finished = new Date().toISOString();
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  await app.close();
  log('done');
})().catch(async (e) => { console.error(e); results.error = String(e.stack || e); fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2)); process.exit(1); });
