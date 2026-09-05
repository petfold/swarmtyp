// S11: open the paged site in Freedom Browser by reference (bundled Ant) and check the SVG pages render.
// Usage: REF=<site ref> node spikes/s11/run-freedom.cjs
const { _electron: electron } = require('/home/test/projects/freedom-browser/node_modules/playwright');
const fs = require('fs'); const os = require('os'); const path = require('path'); const { execSync } = require('child_process');
const repo = '/home/test/projects/freedom-browser'; const REF = process.env.REF; if (!REF) throw new Error('REF');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = __dirname;
const log = (...a) => { const line = `[${new Date().toISOString().slice(11, 19)}] ` + a.join(' '); console.log(line); fs.appendFileSync(path.join(out, 'freedom-run.log'), line + '\n'); };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'freedom-s11-')); const devHome = path.join(tmp, 'devhome'); fs.mkdirSync(devHome); const t0 = Date.now();
  const app = await electron.launch({ args: ['.'], cwd: repo, timeout: 120000, env: { ...process.env, FREEDOM_DEV_HOME: devHome, FREEDOM_TEST_HIDE_WINDOW: '0' } });
  const win = await app.firstWindow({ timeout: 120000 }); await win.waitForLoadState('domcontentloaded');
  for (let i = 0; i < 40; i++) { const open = await win.evaluate(() => { const d = document.getElementById('external-node-candidates-modal'); return !!(d && d.open); }); if (open) { await win.evaluate(() => { const b = document.getElementById('external-node-candidates-managed') || document.getElementById('external-node-candidates-close'); if (b) b.click(); }); log('kept the bundled Ant'); break; } await sleep(1000); }
  let antPort = null; for (let i = 0; i < 120 && !antPort; i++) { try { const m = execSync('ss -ltnp 2>/dev/null | grep antd || true').toString().match(/127\.0\.0\.1:(\d+)/); if (m) antPort = m[1]; } catch {} if (!antPort) await sleep(1000); }
  for (let i = 0; i < 60 && antPort; i++) { try { if (execSync(`curl -s -m 3 http://127.0.0.1:${antPort}/health`).toString()) break; } catch {} await sleep(2000); }
  await sleep(3000); log('ant ready after', `${Date.now() - t0} ms`);
  const evalWv = (script) => win.evaluate(async (s) => { const wv = document.querySelector('webview:not(.hidden)'); if (!wv || typeof wv.executeJavaScript !== 'function') return undefined; try { return await wv.executeJavaScript(s); } catch (e) { return 'ERR ' + e.message; } }, script);
  const go = async (url) => { const input = win.locator('[data-test="address-input"]'); await input.click(); await input.fill(url); await input.press('Enter'); log('navigated to', url); };
  const url = REF.includes(".") ? `bzz://${REF}/` : `bzz://${REF}/`; await go(url); const tNav = Date.now();
  let last = '';
  for (let i = 0; i < 90; i++) {
    await sleep(3000);
    const s = await evalWv(`JSON.stringify({ href: location.href, origin: location.origin, title: document.title, pages: document.querySelectorAll('main .typst-page').length, parseError: document.body.textContent.includes('This page contains the following errors') })`);
    if (s && s !== last) { last = s; log('page', String(s).slice(0, 400)); }
    if (String(s).includes('error.html')) { log('error page, retrying'); await go(url); }
    if (/"pages":[1-9]/.test(String(s))) break;
  }
  log('elapsed since navigate', `${Date.now() - tNav} ms`);
  await win.screenshot({ path: path.join(out, 'freedom-site.png') });
  log('RESULT', last); await app.close();
})().catch((e) => { log('FATAL', e.stack || e); process.exit(1); });
