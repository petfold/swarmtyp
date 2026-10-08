// Open a deployed release in Chromium, wait for the starter to compile, report status, page count and versions shown.
import { chromium } from '@playwright/test';
const url = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage();
const t0 = Date.now();
await page.goto(url);
const status = page.locator('.topbar .status').first();
await status.filter({ hasText: /compiled in \d+ ms|compiler failed/ }).waitFor({ timeout: 240_000 });
const out = { url, seconds: Math.round((Date.now() - t0) / 1000), status: await status.textContent(), pages: await page.locator('.preview canvas').count(), problems: await page.locator('.problems li').count(), notice: await page.locator('.banner', { hasText: 'last compiled cleanly' }).count() };
await page.locator('button[aria-label="Settings"]').click();
out.compiler = (await page.locator('.settings .hint', { hasText: 'Compiler:' }).textContent())?.slice(0, 90);
console.log(JSON.stringify(out));
await browser.close();
