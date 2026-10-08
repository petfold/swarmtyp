// S14: the S10 page (spikes/s1/site/s10.html: 22-page document, canvas per page) under two typst.ts builds.
// <site dir> holds v070/ (a copy of spikes/s1/site) and rc3/ (the same page with rc3's dist and pkg files).
// Usage: node spikes/s14/canvas.mjs <site dir> [rounds]
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const [site, rounds = '2'] = process.argv.slice(2);
const port = 8000 + Math.floor(Math.random() * 1000);
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', site], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  for (let i = 0; i < Number(rounds); i++) {
    for (const v of ['v070', 'rc3']) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`http://127.0.0.1:${port}/${v}/s10.html`);
      const out = await page.waitForFunction(() => window.__s10 || document.getElementById('status').textContent.startsWith('FAILED') && document.getElementById('status').textContent, null, { timeout: 180_000 }).then((h) => h.jsonValue());
      if (typeof out === 'string') { console.log(v, out, await page.locator('#log').textContent(), errors); continue; }
      const log = await page.locator('#log').textContent();
      const compile = /compile: (\d+) ms/.exec(log)?.[1];
      const first = /first page rendered after (\d+) ms/.exec(log)?.[1];
      console.log(`${v} round ${i + 1}: compile ${compile} ms, svg ${out.svg.renderMs} ms, canvas@2 first page ${first} ms, 22 pages ${out.canvas2.ms} ms (${Math.round(out.canvas2.ms / out.canvas2.pages)} ms/page), canvas@3 ${out.canvas3.ms} ms, canvas@2 again ${out.canvas2again.ms} ms, pages ${out.canvas2.pages}`);
      if (i === 0) for (const n of [0, 10]) { // keep two pages as PNG to check both builds draw the same thing
        const url = await page.evaluate((k) => document.querySelectorAll('#canvaspane canvas')[k].toDataURL('image/png'), n);
        (await import('node:fs')).writeFileSync(`${site}/${v}-page${n + 1}.png`, Buffer.from(url.split(',')[1], 'base64'));
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}
