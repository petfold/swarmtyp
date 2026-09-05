import { test, expect, type Browser, type Page } from '@playwright/test';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

// Phase 2 (plan M2): two browser contexts, two identities, one project. Alice shares her local document, Bob opens the
// link; edits converge both ways over the SwarmRtc transport, remote carets show, and both survive a reload (D-19).
// Needs a reachable Bee node and a postage batch (the genesis upload and snapshot feeds are writes).
const env = existsSync('.env.local') ? Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.split('=').map((s) => s.trim()))) : {};
const beeUrl = process.env.VITE_BEE_URL || env.VITE_BEE_URL || 'http://127.0.0.1:1633';
const stamp = process.env.VITE_STAMP || env.VITE_STAMP || '';

test.beforeAll(async () => {
  const ok = await fetch(`${beeUrl}/health`).then((r) => r.ok).catch(() => false);
  test.skip(!ok, `Bee node at ${beeUrl} is not reachable`);
  test.skip(!stamp, 'no VITE_STAMP: sharing a project writes to Swarm');
});

const log = process.env.COLLAB_LOG ? appendFileSync : null;
async function open(browser: Browser, nickname: string, url = './') {
  const context = await browser.newContext();
  await context.addInitScript(([s, b, n]) => localStorage.setItem('swarmtyp:settings', JSON.stringify({ beeUrl: b, stamp: s, nickname: n })), [stamp, beeUrl, nickname]);
  const page = await context.newPage();
  page.on('dialog', (d) => void d.accept());
  if (log) page.on('console', (m) => log(process.env.COLLAB_LOG!, `${new Date().toISOString()} ${nickname} ${m.type()} ${m.text().slice(0, 300)}\n`));
  await page.goto(url);
  await expect(page.locator('.topbar .status')).toHaveText(/compiled in \d+ ms/, { timeout: 90_000 });
  return { context, page };
}
const editor = (page: Page) => page.locator('.editor-host');
const text = (page: Page) => editor(page).evaluate((el) => (el as HTMLElement & { cmView: { state: { doc: { toString(): string } } } }).cmView.state.doc.toString());
// CodeMirror renders decorations for the visible viewport only, so scroll to the end before looking for a remote caret.
const scrollToEnd = (page: Page) => editor(page).evaluate((el) => { const v = (el as HTMLElement & { cmView: { scrollDOM: HTMLElement } }).cmView; v.scrollDOM.scrollTop = v.scrollDOM.scrollHeight; });
async function typeAtEnd(page: Page, s: string) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(s);
}

test('two people edit one project, see each other, and lose nothing on reload', async ({ browser }) => {
  test.setTimeout(600_000);
  const alice = await open(browser, 'Alice');
  await alice.page.getByRole('button', { name: 'Share…' }).click();
  await expect(alice.page).toHaveURL(/#\/p\/[0-9a-f]{64}$/, { timeout: 60_000 });
  await expect(alice.page.locator('.member.me')).toHaveText('Alice (you)');
  const link = alice.page.url();

  const bob = await open(browser, 'Bob', link);
  await expect(bob.page.locator('.member', { hasText: 'Alice' })).toBeVisible({ timeout: 120_000 });
  await expect(alice.page.locator('.member', { hasText: 'Bob' })).toBeVisible({ timeout: 120_000 });
  expect(await text(bob.page)).toContain('Typst in the browser, documents on Swarm'); // Alice's document arrived, not a fresh starter
  expect((await text(bob.page)).split('Typst in the browser, documents on Swarm').length).toBe(2); // and exactly once (no double init)
  // Edits made before the direct channel opens travel only as feed snapshots, which peers fetch once at join
  // (docs/upstream/swarm-collaborative-docs.md §11); type once the chips show a live connection.
  // Offer and answer travel through signal feeds (5 s poll, seconds of feed latency each way); Firefox drops an ICE
  // attempt after ~30 s of checking and the library re-offers, so a connection can take a few minutes.
  await expect(alice.page.locator('.member.connected')).toBeVisible({ timeout: 300_000 });
  await expect(bob.page.locator('.member.connected')).toBeVisible({ timeout: 300_000 });

  await typeAtEnd(bob.page, '\n== Bob was here\n');
  await expect.poll(() => text(alice.page), { timeout: 120_000 }).toContain('Bob was here');
  await scrollToEnd(alice.page);
  await expect(alice.page.locator('.remote-caret-label', { hasText: 'Bob' })).toBeVisible();

  await typeAtEnd(alice.page, '\n== Alice too\n');
  await expect.poll(() => text(bob.page), { timeout: 120_000 }).toContain('Alice too');
  await scrollToEnd(bob.page);
  await expect(bob.page.locator('.remote-caret-label', { hasText: 'Alice' })).toBeVisible();
  await expect(alice.page.locator('.topbar .status')).toHaveText(/compiled in \d+ ms/);

  // A snapshot reaches Swarm a few seconds after the last keystroke; leaving earlier would keep the edit in the browser
  // only (the app warns on unload in that window). Give the feed writes time, then test both restore paths.
  await bob.page.waitForTimeout(6_000);

  // Reload: the local copy (y-indexeddb, D-19) comes back at once with everything.
  await bob.page.reload();
  await expect(bob.page.locator('.topbar .status')).toHaveText(/compiled in \d+ ms/, { timeout: 90_000 });
  await expect.poll(() => text(bob.page), { timeout: 60_000 }).toContain('Alice too');
  expect(await text(bob.page)).toContain('Bob was here');

  // A third person with nothing stored gets the whole document from the members' snapshot feeds alone.
  const carol = await open(browser, 'Carol', link);
  await expect.poll(() => text(carol.page), { timeout: 120_000 }).toContain('Bob was here');
  expect(await text(carol.page)).toContain('Alice too');
  expect((await text(carol.page)).split('Typst in the browser, documents on Swarm').length).toBe(2);

  // Leave: Bob's copy on this device goes, the project stays on Swarm (D-19). The confirm() is accepted by the dialog handler.
  const dbName = `swarmtyp:${/#\/p\/([0-9a-f]{64})/.exec(link)![1]}`;
  expect((await bob.page.evaluate(() => indexedDB.databases())).map((d) => d.name)).toContain(dbName);
  await bob.page.getByRole('button', { name: 'Leave' }).click();
  await expect(bob.page).not.toHaveURL(/#\/p\//);
  await expect.poll(async () => (await bob.page.evaluate(() => indexedDB.databases())).map((d) => d.name)).not.toContain(dbName);
  expect(await text(carol.page)).toContain('Bob was here'); // still there for everyone else

  await alice.context.close();
  await bob.context.close();
  await carol.context.close();
});
