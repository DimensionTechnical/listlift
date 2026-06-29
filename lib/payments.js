// Stripe Checkout (TEST MODE) for the $39 "10-listing pack". Falls back to a
// simulated checkout when no STRIPE_SECRET_KEY is set, so the unlock flow is
// testable offline. NEVER switch to live keys without explicit CEO approval.
import Stripe from 'stripe';

export const PACK_PRICE_CENTS = 3900; // $39.00
export const PACK_NAME = 'ListLift — 10-Listing Pack';

export const usingRealStripe = () => Boolean(process.env.STRIPE_SECRET_KEY);

// Guardrail: refuse to run against live keys in this MVP build.
export function assertTestMode() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (key && !key.startsWith('sk_test_')) {
    throw new Error(
      'Refusing to start: STRIPE_SECRET_KEY is not a test key (sk_test_...). ' +
        'Live charges require explicit CEO approval.'
    );
  }
}

let stripe = null;
function getStripe() {
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

const baseUrl = () => process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Create a Checkout Session. Returns { url, sessionId, mode }.
export async function createCheckout(uid) {
  if (!usingRealStripe()) {
    // Simulated session: success page will self-fulfill in mock mode.
    const sessionId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      mode: 'mock',
      sessionId,
      url: `${baseUrl()}/success.html?session_id=${sessionId}&mock=1`,
    };
  }
  const s = getStripe();
  const lineItem = process.env.STRIPE_PRICE_ID
    ? { price: process.env.STRIPE_PRICE_ID, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: PACK_PRICE_CENTS,
          product_data: {
            name: PACK_NAME,
            description: '10 AI-optimized Etsy listings (SEO title, 13 tags, description, CSV export).',
          },
        },
      };
  const session = await s.checkout.sessions.create({
    mode: 'payment',
    line_items: [lineItem],
    client_reference_id: uid,
    metadata: { uid },
    success_url: `${baseUrl()}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl()}/cancel.html`,
  });
  return { mode: 'live', sessionId: session.id, url: session.url };
}

// Verify a session is paid. In mock mode any mock_* id is treated as paid.
// Returns { paid, uid, sessionId }.
export async function verifySession(sessionId, fallbackUid) {
  if (!usingRealStripe()) {
    return { paid: sessionId.startsWith('mock_'), uid: fallbackUid, sessionId };
  }
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  return {
    paid: session.payment_status === 'paid',
    uid: session.metadata?.uid || session.client_reference_id || fallbackUid,
    sessionId,
  };
}
