// End-to-end funnel smoke test (mock mode, no live keys needed).
// Boots the REAL server as a child process and walks the whole funnel:
// visitor → free generate → paywall → checkout → fulfill → paid generate → CSV.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = process.env.SMOKE_PORT || 3199;
const BASE = `http://localhost:${PORT}`;
const uid = `smoke_${randomUUID()}`;
let pass = 0, fail = 0;

function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-listlift-uid': uid },
    body: JSON.stringify({ ...body, uid }),
  });
  let json = null;
  try { json = await res.clone().json(); } catch {}
  return { status: res.status, json, res };
}

async function waitForReady(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/config`);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

async function run() {
  console.log(`\nListLift funnel smoke test (uid=${uid})\n`);

  const cfg = await (await fetch(`${BASE}/api/config`)).json();
  check('config loads', !!cfg.price, JSON.stringify(cfg));
  console.log(`  · mode: claude=${cfg.claude} stripe=${cfg.stripe} (mockMode=${cfg.mockMode})`);

  const visit = await post('/api/visit', {});
  check('visit registers', visit.status === 200 && visit.json.balance.freeRemaining === 1);

  // 1st generation — free
  const g1 = await post('/api/generate', { productName: 'Lavender Soy Candle', category: 'candles', details: '8oz, hand-poured' });
  check('free generation succeeds', g1.status === 200 && !!g1.json.listing, `status=${g1.status}`);
  if (g1.json?.listing) {
    const l = g1.json.listing;
    check('title within 140 chars', l.title.length > 0 && l.title.length <= 140, `len=${l.title.length}`);
    check('exactly 13 tags', l.tags.length === 13, `got=${l.tags.length}`);
    check('all tags <=20 chars', l.tags.every((t) => t.length <= 20));
    check('description non-empty', l.description.length > 30);
  }

  // 2nd generation — should hit paywall (free used)
  const g2 = await post('/api/generate', { productName: 'Second Item' });
  check('2nd generation paywalled (402)', g2.status === 402 && g2.json.error === 'paywall', `status=${g2.status}`);

  // checkout
  const co = await post('/api/checkout', {});
  check('checkout returns url', co.status === 200 && !!co.json.url, JSON.stringify(co.json));
  const sessionId = co.json?.url ? new URL(co.json.url).searchParams.get('session_id') : null;
  check('checkout session id present', !!sessionId);

  // fulfill (verify + credit)
  const fulfill = await post('/api/fulfill', { sessionId });
  check('fulfill credits the pack', fulfill.status === 200 && fulfill.json.balance.paidCredits === 10, JSON.stringify(fulfill.json));

  // fulfill again — idempotent (no double credit)
  const fulfill2 = await post('/api/fulfill', { sessionId });
  check('fulfill is idempotent', fulfill2.json?.balance?.paidCredits === 10, JSON.stringify(fulfill2.json));

  // 3rd generation — now paid credit consumed
  const g3 = await post('/api/generate', { productName: 'Third Item', details: 'paid path' });
  check('paid generation succeeds', g3.status === 200 && g3.json.balance.paidCredits === 9, JSON.stringify(g3.json?.balance));

  // CSV export
  const csv = await post('/api/export.csv', { listings: [g1.json.listing] });
  const text = await csv.res.text();
  check('CSV export works', csv.status === 200 && text.split('\r\n').length >= 2 && text.includes('title'), text.slice(0, 60));

  // funnel summary reflects events
  const funnel = await (await fetch(`${BASE}/api/funnel`)).json();
  check('funnel logs paid event', funnel.totals.paid >= 1, JSON.stringify(funnel.totals));

  console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed\n`);
}

const child = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'inherit', 'inherit'],
});

let exitCode = 1;
try {
  const ready = await waitForReady();
  if (!ready) { console.error('Server did not become ready in time.'); }
  else { await run(); exitCode = fail === 0 ? 0 : 1; }
} catch (e) {
  console.error(e);
} finally {
  child.kill();
  process.exitCode = exitCode;
}
