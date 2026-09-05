// Render the starter's pages large for a visual check: zoom the preview to 160% and screenshot each page.
import { chromium } from '@playwright/test'; import { spawn } from 'node:child_process';
const srv = spawn('node_modules/.bin/vite', ['preview', '--port', '4174', '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 2500));
try {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 2600, height: 1500 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => localStorage.setItem('swarmtyp:settings', JSON.stringify({ zoom: 1.6 })));
  const page = await ctx.newPage(); await page.goto('http://127.0.0.1:4174/');
  await page.waitForFunction(() => /compiled in/.test(document.querySelector('.topbar .status')?.textContent || ''), null, { timeout: 120000 }); await page.waitForTimeout(3000);
  const canvases = page.locator('.preview canvas'); const n = await canvases.count();
  for (let i = 0; i < n; i++) { await canvases.nth(i).scrollIntoViewIfNeeded(); await page.waitForTimeout(1200); await canvases.nth(i).screenshot({ path: `spikes/s11/starter-page${i + 1}.png` }); }
  console.log(`${n} pages captured`); await browser.close();
} finally { srv.kill(); }
