// M2 check in Freedom Browser (D-22): Alice shares a project from Chromium through the Bee node; Freedom opens the same
// link over bzz:// (app through its bundled Ant, writes through the Bee node on 1633 set in Settings); edits converge
// both ways. Usage: REF=<release ref> node spikes/freedom/run-collab.cjs   (needs .env.local with VITE_STAMP)
// One Playwright only (two copies in one process is refused): Freedom's, which finds its Electron; Chromium comes from swarmtyp's install.
const { _electron: electron, chromium } = require('/home/test/projects/freedom-browser/node_modules/playwright');
const CHROMIUM = process.env.CHROMIUM || '/home/test/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const fs = require('fs'); const os = require('os'); const path = require('path'); const { execSync } = require('child_process');
const repo = '/home/test/projects/freedom-browser';
const REF = process.env.REF || 'b656fac57eb02756af40279cf70275969c9f9219818af7cceee34101f169a100';
const BEE = 'http://127.0.0.1:1633';
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.split('=').map((x) => x.trim())));
const STAMP = process.env.VITE_STAMP || env.VITE_STAMP; if (!STAMP) throw new Error('no VITE_STAMP');
const out = __dirname; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => { const line = `[${new Date().toISOString().slice(11, 19)}] ` + a.join(' '); console.log(line); fs.appendFileSync(path.join(out, 'collab-run.log'), line + '\n'); };
const settings = (name) => JSON.stringify({ beeUrl: BEE, stamp: STAMP, nickname: name });
(async () => {
  // 1. Alice in Chromium, app served by the Bee node.
  const browser = await chromium.launch({ executablePath: CHROMIUM }); const ctx = await browser.newContext();
  await ctx.addInitScript((s) => localStorage.setItem('swarmtyp:settings', s), settings('Alice'));
  const alice = await ctx.newPage(); alice.on('dialog', (d) => void d.accept());
  await alice.goto(`${BEE}/bzz/${REF}/`); await alice.locator('.topbar .status').filter({ hasText: /compiled in/ }).waitFor({ timeout: 180000 });
  await alice.getByRole('button', { name: 'Share…' }).click(); await alice.waitForURL(/#\/p\/[0-9a-f]{64}$/, { timeout: 60000 });
  const id = /#\/p\/([0-9a-f]{64})/.exec(alice.url())[1]; log('project', id);
  const aliceText = () => alice.evaluate(() => document.querySelector('.editor-host').cmView.state.doc.toString());

  // 2. Freedom on a fresh profile, bundled Ant.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'freedom-swarmtyp-')); const devHome = path.join(tmp, 'devhome'); fs.mkdirSync(devHome);
  const t0 = Date.now();
  const app = await electron.launch({ args: ['.'], cwd: repo, timeout: 120000, env: { ...process.env, FREEDOM_DEV_HOME: devHome, FREEDOM_TEST_HIDE_WINDOW: '0' } });
  const win = await app.firstWindow({ timeout: 120000 }); await win.waitForLoadState('domcontentloaded'); log('freedom window', await win.title());
  for (let i = 0; i < 40; i++) { const open = await win.evaluate(() => { const d = document.getElementById('external-node-candidates-modal'); return !!(d && d.open); }); if (open) { log('external-node dialog: keeping the bundled Ant'); await win.evaluate(() => { const b = document.getElementById('external-node-candidates-managed') || document.getElementById('external-node-candidates-close'); if (b) b.click(); }); break; } await sleep(1000); }
  const evalWv = (script) => win.evaluate(async (s) => { const wv = document.querySelector('webview:not(.hidden)'); if (!wv || typeof wv.executeJavaScript !== 'function') return undefined; try { return await wv.executeJavaScript(s); } catch (e) { return 'ERR ' + e.message; } }, script);
  const go = async (url) => { const input = win.locator('[data-test="address-input"]'); await input.click(); await input.fill(url); await input.press('Enter'); log('navigated to', url); };
  // Wait for the bundled Ant to come up (API port from the process list, then /health) before the first navigation;
  // navigating earlier lands on Freedom's ERR_CONNECTION_REFUSED page.
  let antPort = null;
  for (let i = 0; i < 120 && !antPort; i++) { try { const m = execSync('ss -ltnp 2>/dev/null | grep antd || true').toString().match(/127\.0\.0\.1:(\d+)/); if (m) antPort = m[1]; } catch {} if (!antPort) await sleep(1000); }
  log('ant api port', antPort, `after ${Date.now() - t0} ms`);
  for (let i = 0; i < 60 && antPort; i++) { try { const h = execSync(`curl -s -m 3 http://127.0.0.1:${antPort}/health`).toString(); if (h) { log('ant /health', h.slice(0, 100)); break; } } catch {} await sleep(2000); }
  await sleep(3000);
  // Load the app once (cold through Ant), seed settings, then open the project link. Retry if the error page shows.
  await go(`bzz://${REF}/`);
  for (let i = 0; i < 20; i++) { await sleep(5000); const href = await evalWv('location.href'); if (!String(href).includes('error.html')) break; log('error page, retrying navigation'); await go(`bzz://${REF}/`); }
  let st = ''; for (let i = 0; i < 180; i++) { await sleep(4000); const s = await evalWv(`JSON.stringify({ href: location.href, status: (document.querySelector('.topbar .status')||{}).textContent })`); if (s && s !== st) { st = s; log('page', String(s).slice(0, 300)); } if (s && /compiled in|compiler failed/.test(String(s))) break; }
  log('app loaded after', `${Date.now() - t0} ms`);
  await evalWv(`localStorage.setItem('swarmtyp:settings', ${JSON.stringify(settings('Freedom'))}); 'ok'`);
  await go(`bzz://${REF}/#/p/${id}`);
  st = ''; for (let i = 0; i < 60; i++) { await sleep(3000); const s = await evalWv(`JSON.stringify({ href: location.href, status: (document.querySelector('.topbar .status')||{}).textContent, members: [...document.querySelectorAll('.member')].map(m => m.textContent), len: (document.querySelector('.editor-host')||{}).cmView ? document.querySelector('.editor-host').cmView.state.doc.length : -1 })`); if (s && s !== st) { st = s; log('page', String(s).slice(0, 400)); } if (s && /"len":[1-9]/.test(String(s)) && /Alice/.test(String(s))) break; }
  await win.screenshot({ path: path.join(out, 'freedom-collab-joined.png') });

  // 3. Wait for the direct channel, then edit both ways.
  for (let i = 0; i < 100; i++) { const a = await alice.locator('.member.connected').count(); const f = await evalWv(`document.querySelectorAll('.member.connected').length`); if (a > 0 && f > 0) { log('channel open both sides after', `${Date.now() - t0} ms`); break; } await sleep(3000); }
  await evalWv(`(() => { const v = document.querySelector('.editor-host').cmView; const end = v.state.doc.length; v.dispatch({ changes: { from: end, insert: '\\n== Typed in Freedom Browser\\n' }, selection: { anchor: end + 5 } }); return 'ok'; })()`);
  for (let i = 0; i < 40; i++) { if ((await aliceText()).includes('Typed in Freedom Browser')) { log('Freedom -> Alice converged; Alice carets:', JSON.stringify(await alice.locator('.remote-caret-label').allTextContents())); break; } await sleep(2000); if (i === 39) log('Freedom -> Alice NOT converged'); }
  await alice.evaluate(() => { const v = document.querySelector('.editor-host').cmView; const end = v.state.doc.length; v.dispatch({ changes: { from: end, insert: '\n== Typed in Chromium\n' }, selection: { anchor: end + 5 } }); });
  for (let i = 0; i < 40; i++) { const t = await evalWv(`document.querySelector('.editor-host').cmView.state.doc.toString()`); if (String(t).includes('Typed in Chromium')) { log('Alice -> Freedom converged; Freedom carets:', await evalWv(`JSON.stringify([...document.querySelectorAll('.remote-caret-label')].map(e => e.textContent))`)); break; } await sleep(2000); if (i === 39) log('Alice -> Freedom NOT converged'); }
  await sleep(6000); // let snapshots land
  log('freedom status', await evalWv(`JSON.stringify({ status: document.querySelector('.topbar .status').textContent, pages: document.querySelectorAll('.preview canvas').length, banner: (document.querySelector('.banner')||{}).textContent })`));
  await win.screenshot({ path: path.join(out, 'freedom-collab-done.png') }); await alice.screenshot({ path: path.join(out, 'chromium-collab-done.png') });
  await app.close(); await browser.close(); log('closed');
})().catch((e) => { log('FATAL', e.stack || e); process.exit(1); });
