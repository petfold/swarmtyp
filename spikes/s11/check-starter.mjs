import { chromium } from '@playwright/test'; import { spawn } from 'node:child_process';
const srv = spawn('node_modules/.bin/vite', ['preview', '--port', '4174', '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 2500));
try {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } }); const page = await ctx.newPage(); page.on('dialog', (d) => void d.accept());
  await page.goto('http://127.0.0.1:4174/'); const status = page.locator('.topbar .status').first();
  await page.waitForFunction(() => /compiled in|failed/.test(document.querySelector('.topbar .status')?.textContent || ''), null, { timeout: 120000 });
  await page.waitForTimeout(2500);
  console.log(JSON.stringify({ status: await status.textContent(), problems: await page.locator('.problems li').allTextContents(), pages: await page.locator('.preview canvas').count(), packages: await page.locator('.packages').textContent() }, null, 1));
  await page.screenshot({ path: 'spikes/s11/starter.png' }); await browser.close();
} finally { srv.kill(); }
