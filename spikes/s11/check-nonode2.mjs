import { chromium } from '@playwright/test'; import { spawn } from 'node:child_process';
const srv = spawn('node_modules/.bin/vite', ['preview', '--port', '4174', '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 2500));
try {
  const browser = await chromium.launch(); const ctx = await browser.newContext();
  await ctx.addInitScript(() => localStorage.setItem('swarmtyp:settings', JSON.stringify({ beeUrl: 'http://127.0.0.1:1', stamp: '' })));
  const page = await ctx.newPage(); const reqs = new Map();
  page.on('request', (r) => { if (r.url().includes('download.gateway')) { const k = r.url().slice(-12) + ' ' + (r.headers()['range'] || '-'); reqs.set(k, (reqs.get(k) || 0) + 1); } });
  page.on('response', (r) => { if (r.url().includes('download.gateway') && reqs.size < 12) console.log('resp', r.status(), r.url().slice(-12), r.headers()['content-range'] || '', r.headers()['content-length'] || ''); });
  const t0 = Date.now(); await page.goto('http://127.0.0.1:4174/');
  const status = page.locator('.topbar .status').first(); let last = '';
  for (let i = 0; i < 150; i++) { const t = (await status.textContent()) || ''; if (t !== last) { last = t; console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s ${t}`); } if (/compiled in|failed/.test(t)) break; await page.waitForTimeout(1000); }
  const top = [...reqs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(JSON.stringify({ pages: await page.locator('.preview canvas').count(), distinct: reqs.size, total: [...reqs.values()].reduce((a, b) => a + b, 0), top }, null, 1));
  await browser.close();
} finally { srv.kill(); }
