// Does the editor work at a gateway URL? Load, wait for a compile, count failed requests, note timings.
import { chromium } from '@playwright/test';
const url = process.argv[2]; const browser = await chromium.launch(); const page = await browser.newPage();
const failed = []; const t0 = Date.now(); let bytes = 0;
page.on('requestfailed', (r) => failed.push(r.url())); page.on('response', async (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); try { bytes += Number(r.headers()['content-length'] || 0); } catch {} });
page.on('dialog', (d) => void d.accept());
await page.goto(url, { waitUntil: 'load', timeout: 180000 });
const status = page.locator('.topbar .status').first();
let last = ''; const marks = [];
for (let i = 0; i < 180; i++) { const t = (await status.textContent().catch(() => '')) || ''; if (t !== last) { last = t; marks.push(`${((Date.now() - t0) / 1000).toFixed(0)}s ${t}`); } if (/compiled in|failed/.test(t)) break; await page.waitForTimeout(1000); }
const info = await page.evaluate(() => ({ origin: location.origin, pages: document.querySelectorAll('.preview canvas').length, packages: document.querySelector('.packages')?.textContent?.slice(0, 120), problems: [...document.querySelectorAll('.problems li')].map((e) => e.textContent?.slice(0, 200)) }));
await page.screenshot({ path: 'spikes/s11/app-gateway.png' });
console.log(JSON.stringify({ url, seconds: ((Date.now() - t0) / 1000).toFixed(1), mb: (bytes / 1048576).toFixed(1), ...info, marks: marks.slice(-6), failed: failed.slice(0, 10) }, null, 1)); await browser.close();
