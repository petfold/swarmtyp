// Publish docs/user-guide.md next to the app as public/guide/index.html (served at <app>/guide/, D-25). A small
// Markdown-to-HTML step, flowing text with a stylesheet that reads well on a phone; the paged Typst form (D-24)
// would not reflow on small screens. Runs before `vite dev` and `vite build`.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const src = readFileSync(new URL('../../docs/user-guide.md', import.meta.url), 'utf8');
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (t) => esc(t)
  .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2">$2</a>');
const lines = src.split('\n'); const out = []; let i = 0; let title = 'swarmtyp user guide';
const flushPara = (buf) => { if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`); buf.length = 0; };
const para = [];
while (i < lines.length) {
  const l = lines[i];
  if (/^```/.test(l)) { flushPara(para); const code = []; i++; while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]); i++; out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); continue; }
  const h = /^(#{1,4})\s+(.*)$/.exec(l);
  if (h) { flushPara(para); const level = h[1].length; if (level === 1) title = h[2]; const id = h[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); out.push(`<h${level} id="${id}">${inline(h[2])}</h${level}>`); i++; continue; }
  if (/^\|/.test(l)) { flushPara(para); const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]); const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()); const body = rows.filter((r) => !/^\|\s*-{2,}/.test(r)); out.push(`<table><thead><tr>${cells(body[0]).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.slice(1).map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue; }
  const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(l);
  if (li) {
    flushPara(para); const ordered = /\d/.test(li[2]); const items = [];
    while (i < lines.length) {
      const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
      if (m && m[1].length === li[1].length) { items.push(m[3]); i++; }
      else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && !/^\s*```/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); i++; }
      else if (/^\s*```/.test(lines[i]) && items.length) { const code = []; i++; while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++].replace(/^\s{2}/, '')); i++; items[items.length - 1] += `<pre><code>${esc(code.join('\n'))}</code></pre>`; }
      else break;
    }
    out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((t) => `<li>${inline(t.replace(/<pre>[\s\S]*<\/pre>/, ''))}${(t.match(/<pre>[\s\S]*<\/pre>/) || [''])[0]}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
    continue;
  }
  if (!l.trim()) { flushPara(para); i++; continue; }
  para.push(l.trim()); i++;
}
flushPara(para);
const css = `:root{color-scheme:light dark}body{margin:0;font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fbfbf9;color:#1d1d1b}@media(prefers-color-scheme:dark){body{background:#17181a;color:#e6e6e2}a{color:#8ab4f8}pre,code{background:#24262a}th,td{border-color:#3a3d42}}main{max-width:44rem;margin:0 auto;padding:1.2rem 1rem 4rem}nav{font-size:14px;display:flex;gap:1rem;padding:.8rem 1rem;border-bottom:1px solid #ddd}nav a{color:inherit}h1{font-size:1.7rem;margin:.6rem 0}h2{margin-top:2rem;font-size:1.3rem}h3{font-size:1.05rem}code{font:13.5px ui-monospace,SFMono-Regular,Menlo,monospace;background:#eeeee9;padding:.1em .3em;border-radius:3px}pre{background:#eeeee9;padding:.7rem .9rem;border-radius:6px;overflow-x:auto}pre code{background:none;padding:0;word-break:break-all;white-space:pre-wrap}table{border-collapse:collapse;width:100%;font-size:15px}th,td{border:1px solid #ddd;padding:.35rem .5rem;text-align:left}li{margin:.25rem 0}`;
const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head>\n<body><nav><a href="../">← back to the editor</a><span>swarmtyp user guide</span></nav><main>\n${out.join('\n')}\n</main></body></html>\n`;
mkdirSync(new URL('../../public/guide/', import.meta.url), { recursive: true });
writeFileSync(new URL('../../public/guide/index.html', import.meta.url), html);
console.log(`public/guide/index.html: ${(html.length / 1024).toFixed(0)} KB from docs/user-guide.md`);
