// S12: four behaviours of @solarpunkltd/swarm-collaborative-docs 0.1.0 against an in-memory mock of Bee's HTTP API
// (/stamps, SOC writes that need a known batch, chunk reads). No network, no stamps spent. The transport never opens a
// channel, so everything travels through the feeds. Run against the published package, outside the repo:
//   npm i --prefix <dir> @solarpunkltd/swarm-collaborative-docs@0.1.0 @ethersphere/bee-js@13.1.0 yjs@13.6.30
//   node spikes/s12/check-collab-0.1.mjs <dir> [writeDone flushFailure noStamp feedsOnly]
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const DEPS = process.argv[2];
const only = process.argv.slice(3);
const imp = (p) => import(pathToFileURL(`${DEPS}/node_modules/${p}`).href);
const lib = await imp('@solarpunkltd/swarm-collaborative-docs/dist/SwarmCollaborativeDocs.mjs');
const { Bytes } = await imp('@ethersphere/bee-js/dist/mjs/index.js');
const { SwarmDoc, DOC_EVENTS, createRoomKey } = lib;

const STAMP = 'ab'.repeat(32);
const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
const ts = () => ((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's';

// Mock Bee: /stamps, SOC uploads stored by address, chunk reads served back, feed "latest" lookups answer 404.
async function mockBee(opts = {}) {
  const store = new Map();
  const state = { socDelayMs: 0, failSoc: false, socPosts: 0, reads: 0, stamps: opts.stamps ?? [STAMP] };
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const parts = url.pathname.split('/').filter(Boolean);
      const json = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.method === 'GET' && parts[0] === 'stamps') {
        return json(200, { stamps: state.stamps.map((batchID) => ({ batchID, utilization: 0, usable: true, label: '', depth: 20, amount: '1000', bucketDepth: 16, blockNumber: 1, immutableFlag: true, batchTTL: 8640000 })) });
      }
      if (req.method === 'POST' && parts[0] === 'soc') {
        // As Bee does: a write needs a batch this node owns.
        if (!state.stamps.includes(String(req.headers['swarm-postage-batch-id'] ?? '').replace(/^0x/, ''))) { state.rejected = (state.rejected ?? 0) + 1; return json(400, { code: 400, message: 'invalid postage batch id' }); }
        state.socPosts++;
        const [owner, id] = [parts[1], parts[2]];
        const sig = url.searchParams.get('sig');
        const body = Buffer.concat(chunks);
        setTimeout(() => {
          if (state.failSoc) return json(500, { code: 500, message: 'Internal Server Error' });
          const address = Bytes.keccak256(new Bytes(Buffer.from(id + owner, 'hex'))).toHex();
          if (!store.has(address)) store.set(address, Buffer.concat([Buffer.from(id, 'hex'), Buffer.from(sig, 'hex'), body]));
          json(201, { reference: address });
        }, state.socDelayMs);
        return;
      }
      if (req.method === 'GET' && parts[0] === 'chunks') {
        state.reads++;
        const data = store.get(parts[1]);
        if (data) { res.writeHead(200, { 'content-type': 'application/octet-stream' }); return res.end(data); }
        return json(404, { code: 404, message: 'Not Found' });
      }
      state.reads++;
      json(404, { code: 404, message: 'Not Found' });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, state, close: () => server.close() };
}

// A transport that never opens a channel: everything has to travel through the feeds.
function noChannel(published) {
  return () => ({ start() {}, stop() {}, subscribe() {}, connectToPeer() {}, isRemoteOrigin: () => false,
    publish(p) { if (p.type === 'doc') published.push({ at: Date.now(), feedIndex: p.feedIndex }); } });
}

function session(bee, { roomKey, creator, stamp = STAMP, name = 'a', key = hex(32) } = {}) {
  const published = []; const events = [];
  const doc = new SwarmDoc({
    user: { privateKey: key, nickname: name, sessionId: hex(8) },
    infra: { beeUrl: bee.url, stamp, roomKey, roomCreator: creator, transport: noChannel(published) },
  });
  const em = doc.getEmitter();
  for (const ev of ['DOC_READY', 'DOC_ERROR', 'WRITE_PENDING', 'WRITE_DONE', 'DOC_SYNC_STATE', 'MEMBERS_UPDATED']) {
    em.on(DOC_EVENTS[ev], (p) => events.push({ at: Date.now(), ev, p: ev === 'DOC_ERROR' ? String(p?.message ?? p).slice(0, 90) : ev === 'DOC_SYNC_STATE' ? JSON.stringify(p) : ev === 'MEMBERS_UPDATED' ? p.size : undefined }));
  }
  const ready = new Promise((r) => em.on(DOC_EVENTS.DOC_READY, r));
  return { doc, published, events, ready, key };
}
const addrOf = async (key) => { const { PrivateKey } = await imp('@ethersphere/bee-js/dist/mjs/index.js'); return new PrivateKey(key).publicKey().address().toHex(); };

const tests = {
  // 1. Does WRITE_DONE fire while a second write is still queued?
  async writeDone() {
    const bee = await mockBee();
    const s = session(bee, { roomKey: createRoomKey() });
    s.doc.start(); await s.ready; bee.state.socDelayMs = 1500;
    const t = s.doc.doc.getText('main');
    const start = Date.now();
    t.insert(0, 'first edit');
    await sleep(1000);
    t.insert(0, 'second edit ');
    await sleep(6000);
    const rel = (x) => ((x - start) / 1000).toFixed(2) + 's';
    const timeline = [...s.events.filter((e) => e.at >= start && /WRITE/.test(e.ev)).map((e) => ({ at: e.at, what: e.ev })),
      ...s.published.filter((p) => p.at >= start).map((p) => ({ at: p.at, what: `snapshot index ${p.feedIndex} written` }))].sort((a, b) => a.at - b.at);
    for (const e of timeline) console.log(`  ${rel(e.at).padStart(7)}  ${e.what}`);
    const firstDone = timeline.find((e) => e.what === 'WRITE_DONE');
    const lastWrite = timeline.filter((e) => e.what.startsWith('snapshot')).at(-1);
    console.log(`  => first WRITE_DONE at ${rel(firstDone.at)}, last snapshot written at ${rel(lastWrite.at)}: ${firstDone.at < lastWrite.at ? 'PREMATURE (a write was still queued)' : 'ok'}`);
    s.doc.stop(); bee.close();
  },
  // 2. Does flush() reject, or resolve, when the write fails?
  async flushFailure() {
    const bee = await mockBee();
    const s = session(bee, { roomKey: createRoomKey() });
    s.doc.start(); await s.ready; bee.state.failSoc = true;
    s.doc.doc.getText('main').insert(0, 'will not reach Swarm');
    const since = Date.now();
    let outcome;
    try { await s.doc.flush(); outcome = 'resolved'; } catch (e) { outcome = 'rejected: ' + e.message; }
    await sleep(200);
    const after = s.events.filter((e) => e.at >= since).map((e) => e.ev + (e.p ? ` (${e.p})` : ''));
    console.log(`  flush() ${outcome}; events after: ${after.join(', ')}`);
    s.doc.stop(); bee.close();
  },
  // 3. Can a participant without a usable batch read the room?
  async noStamp() {
    for (const [label, stamp, stamps] of [['no batch id', '', [STAMP]], ['batch not on this node', 'cd'.repeat(32), [STAMP]]]) {
      const bee = await mockBee({ stamps });
      // a member with content first, through the same node
      const roomKey = createRoomKey();
      const aKey = hex(32);
      const a = session(bee, { roomKey, key: aKey, name: 'alice' });
      a.doc.start(); await a.ready; a.doc.doc.getText('main').insert(0, 'hello from alice'); await a.doc.flush();
      const readsBefore = bee.state.reads;
      const v = session(bee, { roomKey, creator: await addrOf(aKey), stamp, name: 'viewer' });
      const rejectedBefore = bee.state.rejected ?? 0;
      v.doc.start(); await sleep(8000);
      const textAt8 = v.doc.doc.getText('main').toString();
      a.doc.doc.getText('main').insert(0, 'later edit, '); await a.doc.flush(); await sleep(20000);
      console.log(`  ${label}: DOC_READY=${v.events.some((e) => e.ev === 'DOC_READY')}, DOC_SYNC_STATE=${v.events.some((e) => e.ev === 'DOC_SYNC_STATE')}, viewer text after 8 s="${textAt8}", after alice's later edit="${v.doc.doc.getText('main')}", reads by viewer=${bee.state.reads - readsBefore}, writes refused by the node in 28 s=${(bee.state.rejected ?? 0) - rejectedBefore}, DOC_ERROR: ${v.events.filter((e) => e.ev === 'DOC_ERROR').map((e) => e.p).join(' | ')}`);
      v.doc.stop(); a.doc.stop(); bee.close();
    }
  },
  // 4. Two sessions with no WebRTC channel: do they converge through the feeds, how fast, and what does idling cost?
  async feedsOnly() {
    const bee = await mockBee();
    const roomKey = createRoomKey();
    const aKey = hex(32);
    const a = session(bee, { roomKey, key: aKey, name: 'alice' });
    a.doc.start(); await a.ready;
    a.doc.doc.getText('main').insert(0, 'A0 '); await a.doc.flush();
    const b = session(bee, { roomKey, creator: await addrOf(aKey), name: 'bob' });
    const bStart = Date.now();
    b.doc.start(); await b.ready;
    console.log(`  bob DOC_READY after ${((Date.now() - bStart) / 1000).toFixed(1)}s, text="${b.doc.doc.getText('main')}", sync=${b.events.filter((e) => e.ev === 'DOC_SYNC_STATE').map((e) => e.p).join(' ')}`);
    const waitFor = async (doc, needle, max = 90000) => { const s = Date.now(); while (Date.now() - s < max) { if (doc.getText('main').toString().includes(needle)) return (Date.now() - s) / 1000; await sleep(250); } return null; };
    for (let i = 1; i <= 3; i++) {
      a.doc.doc.getText('main').insert(0, `A${i} `); await a.doc.flush();
      const toB = await waitFor(b.doc.doc, `A${i} `);
      b.doc.doc.getText('main').insert(0, `B${i} `); await b.doc.flush();
      const toA = await waitFor(a.doc.doc, `B${i} `);
      console.log(`  round ${i}: alice→bob ${toB ?? '>90'}s, bob→alice ${toA ?? '>90'}s`);
    }
    console.log(`  converged: ${a.doc.doc.getText('main').toString() === b.doc.doc.getText('main').toString()} ("${a.doc.doc.getText('main')}")`);
    const posts0 = bee.state.socPosts; const reads0 = bee.state.reads;
    await sleep(60000);
    console.log(`  idle 60 s, two sessions: ${bee.state.socPosts - posts0} stamped writes, ${bee.state.reads - reads0} chunk reads`);
    a.doc.stop(); b.doc.stop(); bee.close();
  },
};

for (const [name, fn] of Object.entries(tests)) {
  if (only.length && !only.includes(name)) continue;
  console.log(`[${ts()}] ${name}`);
  await fn();
}
process.exit(0);
