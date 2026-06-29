// ListLift server — static frontend + JSON API for generation, checkout, unlock.
import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateListing, usingRealClaude } from './lib/claude.js';
import { createCheckout, verifySession, usingRealStripe, assertTestMode, PACK_PRICE_CENTS, listPaidSessionsForUid } from './lib/payments.js';
import { listingsToCsv } from './lib/listings.js';
import { getBalance, consumeCredit, creditPack, refundCredit, logEvent, funnelSummary, CONFIG } from './lib/store.js';

assertTestMode(); // refuse to boot against live Stripe keys

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, 'public')));

// --- lightweight per-browser identity via cookie-less uid in header/body ---
// The frontend generates a uid (localStorage) and sends it; server trusts it as
// an anonymous handle. Good enough for an MVP credit wallet; not a security boundary.
function uidFrom(req) {
  return (req.body && req.body.uid) || req.query.uid || req.get('x-listlift-uid') || null;
}

// Stripe-as-source-of-truth recovery. When the local wallet shows no usable
// credits (e.g. after Render wiped the disk on redeploy/cold-start), re-credit
// any paid Checkout Sessions for this uid. Idempotent within a store lifetime
// via creditPack's per-session fulfilled map; after a wipe it re-grants the
// pack, erring toward the customer (per DIM-5). No-op in mock mode.
async function reconcilePaidCredits(uid) {
  if (!usingRealStripe() || !uid) return false;
  let credited = false;
  try {
    const sessionIds = await listPaidSessionsForUid(uid);
    for (const sessionId of sessionIds) {
      const r = creditPack(uid, sessionId);
      if (!r.alreadyFulfilled) {
        logEvent('paid', uid, { sessionId, via: 'reconcile' });
        credited = true;
      }
    }
  } catch (err) {
    console.error('reconcile failed:', err?.message || err);
  }
  return credited;
}

app.get('/api/config', (req, res) => {
  res.json({
    mockMode: !usingRealClaude() || !usingRealStripe(),
    claude: usingRealClaude() ? 'live' : 'mock',
    stripe: usingRealStripe() ? 'live-test' : 'mock',
    price: { cents: PACK_PRICE_CENTS, display: '$39', credits: CONFIG.PACK_CREDITS },
    freeGenerations: CONFIG.FREE_GENERATIONS,
  });
});

app.post('/api/visit', (req, res) => {
  let uid = uidFrom(req);
  if (!uid) uid = randomUUID();
  logEvent('visit', uid);
  res.json({ uid, balance: getBalance(uid) });
});

app.get('/api/balance', (req, res) => {
  const uid = uidFrom(req);
  if (!uid) return res.status(400).json({ error: 'missing uid' });
  res.json({ balance: getBalance(uid) });
});

app.post('/api/generate', async (req, res) => {
  const uid = uidFrom(req);
  if (!uid) return res.status(400).json({ error: 'missing uid' });
  const input = req.body || {};
  if (!input.productName && !input.details) {
    return res.status(400).json({ error: 'Tell us at least a product name or some details.' });
  }

  let before = getBalance(uid);
  if (!before.canGenerate) {
    // Local wallet may have been wiped (Render free-tier ephemeral disk).
    // Recompute paid entitlement from Stripe before paywalling a real buyer.
    const recovered = await reconcilePaidCredits(uid);
    if (recovered) before = getBalance(uid);
  }
  if (!before.canGenerate) {
    logEvent('paywall', uid);
    return res.status(402).json({ error: 'paywall', balance: before, message: 'Free listing used — unlock the 10-pack to keep going.' });
  }

  const spend = consumeCredit(uid);
  if (!spend.ok) {
    logEvent('paywall', uid);
    return res.status(402).json({ error: 'paywall', balance: before });
  }

  try {
    const { listing, mode, model } = await generateListing(input);
    logEvent('generate', uid, { mode, usedFree: spend.usedFree });
    res.json({ listing, mode, model, balance: spend.balance });
  } catch (err) {
    // refund the credit on failure so a flaky API call doesn't cost the user
    // (restores freeUsed for free generations, paidCredits for paid ones)
    refundCredit(uid, { usedFree: spend.usedFree });
    console.error('generate failed:', err?.status, err?.name, err?.message || err);
    const body = { error: 'generation_failed', message: 'The AI call failed — your credit was not used. Please retry.' };
    // Optional diagnostics (no secrets): set LISTLIFT_DEBUG=1 to surface the upstream error cause.
    if (process.env.LISTLIFT_DEBUG === '1') {
      body.detail = { status: err?.status, name: err?.name, type: err?.type, message: String(err?.message || err).slice(0, 300) };
    }
    res.status(502).json(body);
  }
});

// Build a CSV from listings posted back by the client (already-generated).
app.post('/api/export.csv', (req, res) => {
  const listings = Array.isArray(req.body?.listings) ? req.body.listings : [];
  if (!listings.length) return res.status(400).json({ error: 'no listings' });
  const csv = listingsToCsv(listings);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="listlift-listings.csv"');
  res.send(csv);
});

app.post('/api/checkout', async (req, res) => {
  const uid = uidFrom(req);
  if (!uid) return res.status(400).json({ error: 'missing uid' });
  try {
    const session = await createCheckout(uid);
    logEvent('checkout_start', uid, { mode: session.mode, sessionId: session.sessionId });
    res.json({ url: session.url, mode: session.mode });
  } catch (err) {
    console.error('checkout failed:', err?.message || err);
    res.status(502).json({ error: 'checkout_failed', message: err?.message });
  }
});

// Called by success.html after redirect. Verifies payment, then credits the pack.
app.post('/api/fulfill', async (req, res) => {
  const uid = uidFrom(req);
  const sessionId = req.body?.sessionId;
  if (!uid || !sessionId) return res.status(400).json({ error: 'missing uid or sessionId' });
  try {
    const result = await verifySession(sessionId, uid);
    if (!result.paid) return res.status(402).json({ error: 'not_paid' });
    const targetUid = result.uid || uid;
    const balance = creditPack(targetUid, sessionId);
    if (!balance.alreadyFulfilled) logEvent('paid', targetUid, { sessionId });
    res.json({ ok: true, balance, uid: targetUid });
  } catch (err) {
    console.error('fulfill failed:', err?.message || err);
    res.status(502).json({ error: 'fulfill_failed', message: err?.message });
  }
});

// Minimal funnel dashboard (CEO can eyeball conversion).
app.get('/api/funnel', (req, res) => {
  res.json(funnelSummary());
});

const PORT = process.env.PORT || 3000;
// Only auto-listen when run directly (node server.js), not when imported by tests.
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  app.listen(PORT, () => {
    console.log(`ListLift on http://localhost:${PORT}  [claude=${usingRealClaude() ? 'live' : 'mock'} stripe=${usingRealStripe() ? 'live-test' : 'mock'}]`);
  });
}

export { app };
