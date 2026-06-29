# ListLift — AI Etsy Listing Optimizer (MVP v0)

Rough product notes in → a keyword-front-loaded **Etsy-tuned listing** out: SEO title (≤140 chars),
**13 tags**, benefit-led description, materials, photo alt text, and **CSV export**.

First listing is **free** (the lead magnet); after that a **$39 one-time 10-Listing Pack**
unlocks more, paid via **Stripe Checkout**. This is the DIM-3 MVP — milestone is *"a stranger could pay."*

## Run locally

```bash
npm install
npm start          # http://localhost:3000
npm run smoke      # end-to-end funnel test (mock mode, no keys needed)
```

### Mock mode vs. live
With **no API keys set**, the app runs in **mock mode**: a templated sample listing + a
*simulated* checkout that still exercises the full unlock flow. This is intentional so the
funnel is demoable/testable offline. To go live, set env vars (see `.env.example`):

| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Real Claude listing generation |
| `LISTLIFT_MODEL` | Model id (default `claude-sonnet-4-6`) |
| `STRIPE_SECRET_KEY` | **`sk_test_...` only** — app refuses to boot on live keys |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable test key |
| `PUBLIC_BASE_URL` | Deployment URL (for Stripe success/cancel redirects) |

> ⚠️ **Test mode only.** `lib/payments.js` hard-refuses any `STRIPE_SECRET_KEY`
> that isn't `sk_test_...`. Switching to live keys / charging real cards requires
> explicit CEO approval (DIM-3 boundary).

## Architecture (ruthless MVP)
- `server.js` — Express: static frontend + JSON API.
- `lib/claude.js` — listing generation (Claude SDK, mock fallback).
- `lib/payments.js` — Stripe Checkout + verify (mock fallback, test-mode guard).
- `lib/listings.js` — Etsy rules, prompt, output normalization, CSV.
- `lib/store.js` — file-backed credit wallet + funnel event log.
- `public/` — landing, generator, paywall, success/cancel pages.

### API
`POST /api/visit` · `POST /api/generate` · `POST /api/checkout` · `POST /api/fulfill`
· `POST /api/export.csv` · `GET /api/balance` · `GET /api/config` · `GET /api/funnel`

### Funnel instrumentation
Events (`visit`, `generate`, `paywall`, `checkout_start`, `paid`) are logged to
`data/store.json`. `GET /api/funnel` returns visitor→generate→checkout→paid counts and
conversion rates for the CEO dashboard.

## Deploy (free tier)
- **Render:** `render.yaml` included — connect repo, set secret env vars in dashboard.
- **Railway/Fly/any Node host:** `Procfile` (`web: node server.js`) works.
- Set `PUBLIC_BASE_URL` to the deployed URL so Stripe redirects resolve.

> Note: `lib/store.js` is single-instance file storage — fine for v0. Move to a
> KV/DB before scaling to multiple instances or serverless.

## Verify checkout works (smallest proof)
`npm run smoke` walks the whole funnel including paywall → checkout → fulfill → paid
generation and idempotent fulfillment. For a live Stripe test-mode pass, use card
`4242 4242 4242 4242`, any future expiry/CVC, and confirm the success page credits 10 listings.
