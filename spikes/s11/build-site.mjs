// S11 part 1: build a paged site (index.html + pages.svg + doc.pdf) from the browser compiler and upload it as a Swarm
// collection. Usage: node spikes/s11/build-site.mjs   (needs .env.local VITE_STAMP; uses spikes/s1/site assets)
import { chromium } from '@playwright/test';
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
const env = existsSync('.env.local') ? Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.split('=').map((s) => s.trim()))) : {};
const bee = process.env.VITE_BEE_URL || env.VITE_BEE_URL || 'http://127.0.0.1:1633'; const stamp = process.env.VITE_STAMP || env.VITE_STAMP;
const srv = spawn('python3', ['-m', 'http.server', '8711', '--bind', '127.0.0.1', '-d', 'spikes/s1/site'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1000));
try {
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8711/s11.html');
  await page.waitForFunction(() => window.__s11, null, { timeout: 120000 });
  const out = await page.evaluate(() => window.__s11); await browser.close();
  if (out.error) throw new Error(out.error);
  console.log(`compiled: ${out.pages} pages, ${out.diagnostics} diagnostics, svg ${(out.svg.length / 1024).toFixed(0)} KB, pdf ${(out.pdf.length * 0.75 / 1024).toFixed(0)} KB`);
  const dir = 'spikes/s11/site'; mkdirSync(dir, { recursive: true });
  // typst.ts's SVG carries an inline <script> whose `&&` is not escaped, so as a standalone image/svg+xml file it is not
  // well-formed XML and browsers stop at the first bare `&` (found in Freedom and Chromium). A published site needs none of
  // the script (it drives text selection in the live preview), so strip it; the result parses as XML.
  const svg = out.svg.replace(/<script[\s\S]*?<\/script>/g, '');
  console.log(`script blocks removed: ${(out.svg.match(/<script/g) || []).length}, bare & left: ${(svg.match(/&(?![a-zA-Z#][a-zA-Z0-9]*;)/g) || []).length}`);
  writeFileSync(`${dir}/pages.svg`, svg); writeFileSync(`${dir}/doc.pdf`, Buffer.from(out.pdf, 'base64'));
  writeFileSync(`${dir}/index.html`, `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>A document that is also a website</title>\n<style>body{margin:0;background:#e9e9e9;font:14px system-ui,sans-serif}header{display:flex;gap:1rem;align-items:center;padding:.6rem 1rem;background:#fff;border-bottom:1px solid #ccc;position:sticky;top:0}header a{color:#0a58ca}main{max-width:900px;margin:1rem auto;padding:0 .5rem}main>svg{width:100%;height:auto;display:block;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);margin-bottom:1rem}</style></head>\n<body><header><strong>A document that is also a website</strong><a href="doc.pdf">PDF</a><span style="margin-left:auto;color:#666">published from swarmtyp</span></header>\n<main>${svg}</main></body></html>\n`);
  const tar = execSync(`tar -C ${dir} -cf - .`, { maxBuffer: 1 << 28 });
  const res = await fetch(`${bee}/bzz?name=s11-site`, { method: 'POST', headers: { 'Content-Type': 'application/x-tar', 'Swarm-Collection': 'true', 'Swarm-Index-Document': 'index.html', 'Swarm-Postage-Batch-Id': stamp }, body: tar });
  if (!res.ok) throw new Error(`upload ${res.status} ${await res.text()}`);
  const { reference } = await res.json();
  console.log(`reference: ${reference}\nlocal: ${bee}/bzz/${reference}/\nfreedom: bzz://${reference}/`);
} finally { srv.kill(); }
