import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

const env = existsSync('.env.local') ? Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.split('=').map((s) => s.trim()))) : {};
const beeUrl = process.env.VITE_BEE_URL || env.VITE_BEE_URL || 'http://127.0.0.1:1633';

test.beforeAll(async () => {
  const ok = await fetch(`${beeUrl}/health`).then((r) => r.ok).catch(() => false);
  test.skip(!ok, `Bee node at ${beeUrl} is not reachable; fonts and packages come from Swarm`);
});

test('compiles the starter document, shows an error in the gutter, adds a second file', async ({ page }) => {
  await page.goto('./');
  const status = page.locator('.topbar .status').first();
  await expect(status).toHaveText(/compiled in \d+ ms/, { timeout: 90_000 });
  await expect(page.locator('.preview canvas')).toHaveCount(2); // the starter is two pages
  await expect(page.locator('.packages')).toContainText('cetz');
  await expect(page.locator('.problems li')).toHaveCount(0);

  // A second text file included from main.
  page.once('dialog', (d) => d.accept('chapters/two.typ'));
  await page.locator('.files-head button', { hasText: '+' }).click();
  await expect(page.locator('.files li', { hasText: 'chapters/two.typ' })).toBeVisible();
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.type('== Chapter two\n#lorem(40)');
  await page.locator('.files li .file', { hasText: 'main.typ' }).click();
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n#include "chapters/two.typ"\n#let broken = 1 + "a"\n');
  await expect(status).toHaveText(/1 error/, { timeout: 60_000 });
  await expect(page.locator('.problems li.error')).toContainText('cannot add integer and string');
  await expect(page.locator('.cm-lintRange-error')).toHaveCount(1);
  await expect(page.locator('.preview canvas').first()).toBeVisible();
});
