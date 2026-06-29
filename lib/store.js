// Tiny file-backed JSON store. Good enough for a first-dollar MVP on a single
// Node instance. Holds per-user credit balances and an append-only funnel log.
// (If we later move to serverless/multi-instance, swap this for a KV/DB — the
// interface is intentionally small.)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const STORE_PATH = join(DATA_DIR, 'store.json');

const FREE_GENERATIONS = 1; // free listings before paywall
const PACK_CREDITS = 10; // "$39 10-listing pack"

function load() {
  if (!existsSync(STORE_PATH)) {
    return { users: {}, events: [] };
  }
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { users: {}, events: [] };
  }
}

function save(db) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(db, null, 2));
}

function getUser(db, uid) {
  if (!db.users[uid]) {
    db.users[uid] = { uid, freeUsed: 0, paidCredits: 0, createdAt: Date.now() };
  }
  return db.users[uid];
}

// Record a funnel event. type ∈ visit | generate | paywall | checkout_start | paid
export function logEvent(type, uid, meta = {}) {
  const db = load();
  db.events.push({ type, uid, meta, at: Date.now() });
  // keep the log bounded
  if (db.events.length > 5000) db.events = db.events.slice(-5000);
  save(db);
}

export function getBalance(uid) {
  const db = load();
  const u = getUser(db, uid);
  save(db);
  return {
    freeRemaining: Math.max(0, FREE_GENERATIONS - u.freeUsed),
    paidCredits: u.paidCredits,
    canGenerate: u.freeUsed < FREE_GENERATIONS || u.paidCredits > 0,
  };
}

// Atomically consume one generation credit (free first, then paid).
// Returns { ok, usedFree, balance } — ok=false means paywalled.
export function consumeCredit(uid) {
  const db = load();
  const u = getUser(db, uid);
  let usedFree = false;
  if (u.freeUsed < FREE_GENERATIONS) {
    u.freeUsed += 1;
    usedFree = true;
  } else if (u.paidCredits > 0) {
    u.paidCredits -= 1;
  } else {
    save(db);
    return { ok: false, usedFree: false, balance: balanceOf(u) };
  }
  save(db);
  return { ok: true, usedFree, balance: balanceOf(u) };
}

// Refund one consumed generation credit after a failed generation, restoring
// whichever bucket was actually charged. Free uses must decrement freeUsed
// (the original bug: only paid credits were refunded, so a flaky API call
// permanently paywalled free visitors). Returns the refreshed balance.
export function refundCredit(uid, { usedFree } = {}) {
  const db = load();
  const u = getUser(db, uid);
  if (usedFree) {
    if (u.freeUsed > 0) u.freeUsed -= 1;
  } else {
    u.paidCredits += 1;
  }
  save(db);
  return balanceOf(u);
}

// Credit a pack purchase. Idempotent per Stripe session id.
export function creditPack(uid, sessionId, credits = PACK_CREDITS) {
  const db = load();
  const u = getUser(db, uid);
  u.fulfilled = u.fulfilled || {};
  if (sessionId && u.fulfilled[sessionId]) {
    return { ...balanceOf(u), alreadyFulfilled: true };
  }
  u.paidCredits += credits;
  if (sessionId) u.fulfilled[sessionId] = Date.now();
  save(db);
  return { ...balanceOf(u), alreadyFulfilled: false };
}

function balanceOf(u) {
  return {
    freeRemaining: Math.max(0, FREE_GENERATIONS - u.freeUsed),
    paidCredits: u.paidCredits,
  };
}

// Aggregate funnel counts for a simple admin view.
export function funnelSummary() {
  const db = load();
  const counts = {};
  for (const e of db.events) counts[e.type] = (counts[e.type] || 0) + 1;
  const paid = db.events.filter((e) => e.type === 'paid').length;
  const visits = counts.visit || 0;
  const generates = counts.generate || 0;
  return {
    counts,
    totals: {
      visitors: visits,
      generations: generates,
      checkoutsStarted: counts.checkout_start || 0,
      paid,
    },
    rates: {
      visitToGenerate: pct(generates, visits),
      generateToCheckout: pct(counts.checkout_start || 0, generates),
      checkoutToPaid: pct(paid, counts.checkout_start || 0),
      visitToPaid: pct(paid, visits),
    },
    users: Object.keys(db.users).length,
    recentEvents: db.events.slice(-25).reverse(),
  };
}

function pct(n, d) {
  if (!d) return '0%';
  return `${((n / d) * 100).toFixed(1)}%`;
}

export const CONFIG = { FREE_GENERATIONS, PACK_CREDITS };
