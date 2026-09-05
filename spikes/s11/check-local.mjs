import { chromium } from '@playwright/test';
const url = process.argv[2]; const browser = await chromium.launch(); const page = await browser.newPage();
const failed = []; page.on('requestfailed', (r) => failed.push(r.url())); page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
await page.goto(url, { waitUntil: 'load', timeout: 120000 }); await page.waitForTimeout(3000);
const info = await page.evaluate(() => { return { title: document.title, inlineSvg: !!document.querySelector('main>svg'), pages: document.querySelectorAll('main .typst-page').length, parseError: document.body.textContent.includes('This page contains the following errors'), pdfLink: !!document.querySelector('a[href="doc.pdf"]') }; });
await page.screenshot({ path: 'spikes/s11/site-local.png', fullPage: false });
console.log(JSON.stringify({ url, ...info, failed })); await browser.close();
