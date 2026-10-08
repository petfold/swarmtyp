// S14: the move's user-visible behaviour in the built app (vite preview on :4173, Chromium).
//  A. an untouched earlier starter recorded with Typst 0.14.2 is replaced by the current starter: no notice, one page
//  B. an edited document with `plus.circle`, recorded with 0.14.2: notice and error; after the fix the notice goes
// Usage: node spikes/s14/upgrade.mjs   (needs `pnpm build` first; starts and stops vite preview itself)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as Y from 'yjs';
import { chromium } from '@playwright/test';

const repo = new URL('../../', import.meta.url).pathname;
function localDoc(text, typstVersion) {
  const doc = new Y.Doc();
  doc.transact(() => {
    const p = doc.getMap('project');
    p.set('name', 'My first document'); p.set('mainFile', '/main.typ'); p.set('typstVersion', typstVersion); p.set('created', Date.now());
    doc.getMap('files').set('/main.typ', { kind: 'text' });
    doc.getText('/main.typ').insert(0, text);
  });
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
}

const server = spawn(`${repo}node_modules/.bin/vite`, ['preview', '--port', '4173', '--strictPort', '--host', '127.0.0.1'], { cwd: repo, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const run = async (label, stored, check) => {
  const context = await browser.newContext();
  await context.addInitScript((b64) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('swarmtyp:project:local', b64); sessionStorage.setItem('seeded', '1'); } }, stored);
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  const status = page.locator('.topbar .status').first();
  await status.filter({ hasText: /compiled in \d+ ms/ }).waitFor({ timeout: 90_000 });
  console.log(label, await check(page, status));
  await context.close();
};
const banner = (page) => page.locator('.banner', { hasText: 'last compiled cleanly' });
try {
  const legacy = readFileSync(`${repo}src/app/legacy/starter-fad48ce.typ`, 'utf8');
  await run('A untouched old starter:', localDoc(legacy, '0.14.2'), async (page, status) => ({
    status: await status.textContent(), notice: await banner(page).count(), pages: await page.locator('.preview canvas').count(),
    replaced: (await page.locator('.editor-host').evaluate((el) => el.cmView.state.doc.toString())).includes('plus.o'),
  }));
  await run('B edited document with plus.circle:', localDoc('= Mine\n$ A plus.circle B $\n', '0.14.2'), async (page, status) => {
    const before = { status: await status.textContent(), notice: await banner(page).textContent() };
    await page.locator('.editor-host').evaluate((el) => { const v = el.cmView; const at = v.state.doc.toString().indexOf('plus.circle'); v.dispatch({ changes: { from: at, to: at + 'plus.circle'.length, insert: 'plus.o' } }); });
    await status.filter({ hasText: /compiled in \d+ ms$/ }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(500);
    return { before, after: { status: await status.textContent(), notice: await banner(page).count() } };
  });
} finally {
  await browser.close();
  server.kill();
}
