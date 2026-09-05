// Drive Freedom Browser (Electron) with its own Playwright: open the swarmtyp S1 page over bzz:// and read its log.
const { _electron: electron } = require('@playwright/test');
const fs = require('fs'); const os = require('os'); const path = require('path'); const { execSync } = require('child_process');
const repo = '/home/test/projects/freedom-browser';
const REF = process.env.REF || '7b737cf499e6b2322824f0c74b66985e30ceba9241a5c95a2210331c075ed9fb';
const URL_ = process.env.URL || `bzz://${REF}/?gz=1`;
const out = path.dirname(__filename);
const log = (...a) => { const line = `[${new Date().toISOString().slice(11, 19)}] ` + a.join(' '); console.log(line); fs.appendFileSync(path.join(out, 'run.log'), line + '\n'); };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'freedom-swarmtyp-'));
  const devHome = path.join(tmp, 'devhome'); fs.mkdirSync(devHome); log('FREEDOM_DEV_HOME', devHome);
  const t0 = Date.now();
  const app = await electron.launch({ args: ['.'], cwd: repo, timeout: 120000, env: { ...process.env, FREEDOM_DEV_HOME: devHome, FREEDOM_TEST_HIDE_WINDOW: '0' } });
  log('electron launched', `${Date.now() - t0} ms`);
  const win = await app.firstWindow({ timeout: 120000 });
  await win.waitForLoadState('domcontentloaded');
  log('first window', await win.title());
  // Find the Ant node's API port from the process list.
  let antPort = null;
  for (let i = 0; i < 120 && !antPort; i++) {
    try { const ss = execSync('ss -ltnp 2>/dev/null | grep antd || true').toString(); const m = ss.match(/127\.0\.0\.1:(\d+)/); if (m) antPort = m[1]; } catch {}
    if (!antPort) await new Promise(r => setTimeout(r, 1000));
  }
  log('ant api port', antPort, `after ${Date.now() - t0} ms`);
  if (antPort) {
    for (let i = 0; i < 30; i++) { try { const h = execSync(`curl -s -m 3 http://127.0.0.1:${antPort}/health`).toString(); if (h) { log('ant /health', h.slice(0, 120)); break; } } catch {} await new Promise(r => setTimeout(r, 2000)); }
    try { log('ant /stamps', execSync(`curl -s -m 5 http://127.0.0.1:${antPort}/stamps`).toString().slice(0, 200)); } catch (e) { log('ant /stamps failed', e.message.slice(0, 80)); }
    try { log('ant /addresses', execSync(`curl -s -m 5 http://127.0.0.1:${antPort}/addresses`).toString().slice(0, 200)); } catch {}
    try { log('ant /peers count', execSync(`curl -s -m 5 http://127.0.0.1:${antPort}/peers | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('peers',[])))"`).toString().trim()); } catch {}
  }
  await win.screenshot({ path: path.join(out, 'freedom-start.png') });
  // Dismiss the "External Nodes Detected" dialog (keep the bundled Ant) if Freedom found the Bee on 1633.
  for (let i = 0; i < 10; i++) {
    const open = await win.evaluate(() => { const d = document.getElementById('external-node-candidates-modal'); return !!(d && d.open); });
    if (open) { log('external-node dialog shown; closing it to keep the bundled Ant'); await win.evaluate(() => { const b = document.getElementById('external-node-candidates-managed') || document.getElementById('external-node-candidates-close'); if (b) b.click(); }); await new Promise(r => setTimeout(r, 1000)); break; }
    await new Promise(r => setTimeout(r, 1000));
  }
  const input = win.locator('[data-test="address-input"]');
  for (let i = 0; i < 90 && !antPort; i++) { try { const ss = execSync('ss -ltnp 2>/dev/null | grep antd || true').toString(); const m = ss.match(/127\.0\.0\.1:(\d+)/); if (m) antPort = m[1]; } catch {} if (!antPort) await new Promise(r => setTimeout(r, 1000)); }
  log('ant api port (after dialog)', antPort, `after ${Date.now() - t0} ms`);
  if (antPort) for (let i = 0; i < 40; i++) { try { const h = execSync(`curl -s -m 3 http://127.0.0.1:${antPort}/health`).toString(); if (h) { log('ant /health', h.slice(0, 120)); break; } } catch {} await new Promise(r => setTimeout(r, 2000)); }
  await input.click(); await input.fill(URL_); await input.press('Enter');
  const tNav = Date.now(); log('navigated to', URL_);
  const evalWv = (script) => win.evaluate(async (s) => { const wv = document.querySelector('webview:not(.hidden)'); if (!wv || typeof wv.executeJavaScript !== 'function') return undefined; try { return await wv.executeJavaScript(s); } catch (e) { return 'ERR ' + e.message; } }, script);
  let last = '';
  for (let i = 0; i < 150; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const st = await evalWv(`JSON.stringify({ href: location.href, origin: location.origin, status: document.getElementById('status') && document.getElementById('status').textContent, hasSwarm: typeof window.swarm, log: (document.getElementById('log') || {}).textContent })`);
    if (st && st !== last) { last = st; log('page', String(st).slice(0, 900)); }
    if (st && /done in|FAILED|error\.html/.test(String(st))) break;
    if (i % 5 === 4) { try { log('ant /peers', execSync(`curl -s -m 5 http://127.0.0.1:${antPort}/peers | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('peers',[])))"`).toString().trim(), 'wv url', await win.evaluate(() => { const wv = document.querySelector('webview:not(.hidden)'); return wv && wv.getURL ? wv.getURL() : null; })); } catch {} }
  }
  log('elapsed since navigate', `${Date.now() - tNav} ms`);
  try { const lf = execSync(`find ${devHome} -name main.log | head -1`).toString().trim(); if (lf) log('main.log Ant lines:\n' + execSync(`grep -iE '\\[Ant\\]|SwarmService|bzz-protocol|probe' '${lf}' | head -25`).toString()); } catch (e) { log('no main.log', e.message.slice(0,80)); }
  await win.screenshot({ path: path.join(out, 'freedom-page.png') });
  const caps = await evalWv(`(async () => { try { if (!window.swarm) return 'no window.swarm'; const c = await window.swarm.request({ method: 'swarm_getCapabilities' }); return JSON.stringify(c).slice(0, 600); } catch (e) { return 'caps error: ' + e.message; } })()`);
  log('window.swarm capabilities', String(caps));
  const res = await evalWv(`JSON.stringify(window.__s1 || null)`); log('RESULT', String(res).slice(0, 1200));
  await app.close(); log('closed');
})().catch(e => { log('FATAL', e.stack || e); process.exit(1); });
