// Editor with no reachable Bee node: reads must fall back to the public gateway and the starter must compile.
import { chromium } from '@playwright/test'; import { spawn } from 'node:child_process';
const srv = spawn('node_modules/.bin/vite', ['preview', '--port', '4174', '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 2500));
try {
  const browser = await chromium.launch(); const ctx = await browser.newContext();
  await ctx.addInitScript(() => localStorage.setItem('swarmtyp:settings', JSON.stringify({ beeUrl: 'http://127.0.0.1:1', stamp: '' })));
  const page = await ctx.newPage(); const gw = []; page.on('request', (r) => { if (r.url().includes('download.gateway')) gw.push(r.url().slice(0, 90)); });
  const t0 = Date.now(); await page.goto('http://127.0.0.1:4174/');
  const status = page.locator('.topbar .status').first(); let last = '';
  for (let i = 0; i < 120; i++) { const t = (await status.textContent()) || ''; if (t !== last) { last = t; console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s ${t}`); } if (/compiled in|failed/.test(t)) break; await page.waitForTimeout(1000); }
  console.log(JSON.stringify({ banner: await page.locator('.banner').first().textContent().catch(() => null), pages: await page.locator('.preview canvas').count(), problems: await page.locator('.problems li').allTextContents(), gatewayRequests: gw.length, sample: gw.slice(0, 3) }, null, 1));
  await browser.close();
} finally { srv.kill(); }
