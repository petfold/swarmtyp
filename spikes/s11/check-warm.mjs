// Second load in the same browser profile: the compiler, renderer, fonts and packages should come from the Cache API.
import { chromium } from '@playwright/test'; import { spawn } from 'node:child_process';
const srv = spawn('node_modules/.bin/vite', ['preview', '--port', '4174', '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 2500));
try {
  const browser = await chromium.launch(); const ctx = await browser.newContext(); const page = await ctx.newPage();
  const run = async (label) => { let n = 0, bytes = 0; const h = (r) => { if (/wasm|\/bytes\//.test(r.url())) { n++; bytes += Number(r.headers()['content-length'] || 0); } }; page.on('response', h); const t0 = Date.now(); await page.goto('http://127.0.0.1:4174/'); await page.waitForFunction(() => /compiled in|failed/.test(document.querySelector('.topbar .status')?.textContent || ''), null, { timeout: 120000 }); page.off('response', h); console.log(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)} s, ${n} asset requests, ${(bytes / 1048576).toFixed(1)} MB, status "${await page.locator('.topbar .status').textContent()}"`); };
  await run('cold'); await page.waitForTimeout(1500); await run('warm (reload)');
  await page.goto('http://127.0.0.1:4174/guide/'); console.log('guide:', await page.title(), (await page.locator('h2').count()) + ' sections'); await page.setViewportSize({ width: 390, height: 800 }); await page.screenshot({ path: 'spikes/s11/guide-mobile.png' });
  await page.goto('http://127.0.0.1:4174/'); await page.waitForSelector('.topbar a.help'); console.log('help link:', await page.locator('.topbar a.help').getAttribute('href'));
  await browser.close();
} finally { srv.kill(); }
