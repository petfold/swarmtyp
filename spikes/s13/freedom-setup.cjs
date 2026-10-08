// S13 setup: start Freedom (the ../freedom-browser checkout) on a dedicated profile with its bundled Ant, read the
// storage plans with their quotes, and with --arm=<plan> arm a purchase and keep Freedom running until it is done.
// The profile lives outside the repo and must be kept: its node wallet owns the storage it buys.
//   node spikes/s13/freedom-setup.cjs [--arm=starter] [--minutes=N]
// Writes what to pay to spikes/s13/payment.md (a public address and an amount; no secrets).
const { _electron: electron } = require('/home/test/projects/freedom-browser/node_modules/playwright');
const fs = require('node:fs');
const { execSync } = require('node:child_process');

const repo = '/home/test/projects/freedom-browser';
const devHome = process.env.S13_DEVHOME || '/home/test/freedom-s13/devhome';
const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1];
const armPlan = arg('arm');
const minutes = Number(arg('minutes') || (armPlan ? 180 : 3));
const paymentFile = `${__dirname}/payment.md`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

(async () => {
  fs.mkdirSync(devHome, { recursive: true });
  const app = await electron.launch({ args: ['.'], cwd: repo, timeout: 120000, env: { ...process.env, FREEDOM_DEV_HOME: devHome, FREEDOM_TEST_HIDE_WINDOW: '0' } });
  const win = await app.firstWindow({ timeout: 120000 });
  await win.waitForLoadState('domcontentloaded');
  log('freedom window', await win.title(), 'profile', devHome);
  // A Bee answers on 1633 (Swarm Desktop): Freedom offers it as an external node. Keep the bundled Ant.
  for (let i = 0; i < 30; i++) {
    const open = await win.evaluate(() => { const d = document.getElementById('external-node-candidates-modal'); return !!(d && d.open); });
    if (open) { await win.evaluate(() => { const b = document.getElementById('external-node-candidates-managed') || document.getElementById('external-node-candidates-close'); if (b) b.click(); }); log('external-node offer declined: bundled Ant'); break; }
    await sleep(1000);
  }
  let antPort = null;
  for (let i = 0; i < 180 && !antPort; i++) { const m = execSync('ss -ltnp 2>/dev/null | grep antd || true').toString().match(/127\.0\.0\.1:(\d+)/); if (m) antPort = m[1]; else await sleep(1000); }
  log('ant api port', antPort);
  const state = () => win.evaluate(() => window.publishSetup.getState());
  await win.evaluate(() => window.publishSetup.watch('s13', true));
  let last = '';
  const watchState = async (label) => { const s = await state(); const j = JSON.stringify(s); if (j !== last) { last = j; log(label, j.slice(0, 1500)); } return s; };
  for (let i = 0; i < 60; i++) { await watchState('state'); const plans = await win.evaluate(() => window.publishSetup.getPlans()).catch((e) => ({ error: String(e) })); if (plans && !plans.error && JSON.stringify(plans).includes('send')) { log('plans', JSON.stringify(plans).slice(0, 3000)); break; } if (i % 6 === 0) log('plans not ready', JSON.stringify(plans).slice(0, 400)); await sleep(5000); }
  if (armPlan) {
    const r = await win.evaluate((planId) => window.publishSetup.arm({ kind: 'buy', planId }), armPlan);
    log('armed', JSON.stringify(r).slice(0, 800));
  }
  const end = Date.now() + minutes * 60_000;
  let wrote = false;
  while (Date.now() < end) {
    const s = await watchState('state');
    const text = JSON.stringify(s);
    const op = s && (s.operation || s.op || (s.operations && s.operations[0]));
    const q = op && (op.quote || op);
    if (!wrote && q && q.walletAddress && q.send) {
      fs.writeFileSync(paymentFile, `# S13: fund Freedom's node for the storage purchase\n\nWritten ${new Date().toISOString()}. Plan: ${armPlan}.\n\n- Network: Gnosis Chain (chain id 100), token: xDAI (native)\n- Send to (Freedom's node wallet): ${q.walletAddress}\n- Amount: ${q.send.display} xDAI\n\nFreedom re-quotes every few seconds and starts the purchase by itself once the node holds enough.\n\nState when written:\n\n\`\`\`json\n${JSON.stringify(s, null, 2)}\n\`\`\`\n`);
      wrote = true; log('payment details written to', paymentFile);
    }
    if (armPlan && op && /done|failed/.test(String(op.phase))) { log('operation finished', op.phase); break; }
    await sleep(armPlan ? 15000 : 5000);
  }
  await app.close();
  log('closed');
})().catch((e) => { console.error(e); process.exit(1); });
