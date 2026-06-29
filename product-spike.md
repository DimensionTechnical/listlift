# Product-Selection Spike — Dimension Industries

**Author:** Ada (Founding Engineer) · **Date:** 2026-06-28 · **Decision needed:** go/no-go on ONE product
**Goal:** $3,000 revenue by 2026-08-12 (45 days). **Binding constraint: distribution at ~$0 cash.**

## TL;DR — Recommendation

**Build Option A: "ListLift" — an AI listing optimizer for Amazon FBA & Etsy sellers.**

It wins on the constraint that actually decides this bet: these buyers cluster in huge, tightly-defined online communities, **already reflexively pay for tools** (Helium10 at $99/mo, Jungle Scout, eRank), and have an acute *weekly* pain. Build is a clean 7-day job. Option B (freelancer proposals) is the strong fallback if seller-community promo rules choke us. Option C (local-SMB review replies) I'm recommending we **reject now** — the product is fine, but its buyers don't gather anywhere we can reach for free, which is disqualifying given our constraint.

Scoring (1–5, distribution double-weighted):

| Criterion (weight) | A: ListLift | B: PitchCraft | C: ReviewReply |
|---|---|---|---|
| **Distribution at $0 (×2)** | 5 → **10** | 4 → **8** | 2 → **4** |
| Willingness to pay | 5 | 3 | 4 |
| Pain acuteness / recurrence | 4 | 4 | 4 |
| Claude quality edge | 4 | 4 | 3 |
| 7-day build feasibility | 5 | 5 | 3 |
| **Total** | **28** | **24** | **18** |

---

## Option A — ListLift: AI listing optimizer for Amazon/Etsy sellers  ✅ RECOMMENDED

**The pain & buyer.** Amazon FBA and Etsy sellers must produce a keyword-rich, policy-compliant, conversion-tuned listing — title, bullets, description, backend search terms, tags — for *every* product, and re-optimize losers constantly. It's acute (a weak listing = no sales), recurring (every SKU, every season), and they already spend hours on it or pay agencies $50–150/listing. Buyer is an SMB seller with real budget and a tool-buying habit.

**Why Claude is an unfair edge.** From a product photo + a few rough specs, Claude produces a platform-tuned listing in seconds: Amazon's 200-char title conventions and backend keyword rules, or Etsy's 13-tag / SEO-title format — with compliant, benefit-led copy and a built-in keyword spread. Batch mode (paste a CSV of rough products → get optimized listings back) is the thing a generic ChatGPT prompt does badly and that justifies paying us.

**Monetization.** Lead with a one-time pack to minimize friction and bank the first dollar fast:
- **$39 "10-listing pack"** (one-time) → **~77 sales** to $3,000, or
- **$29/mo** (unlimited-ish with fair-use cap) → **~104 active subs**, or
- **$49 "Pro" pack** (50 listings + A+/CSV export) → **~62 sales**.
Plan: ship one-time packs first (fastest to first dollar), add a $29/mo tier once we see repeat usage.

**Distribution (~$0).** This is why it wins — the buyers are concentrated and reachable:
- Subreddits: r/FulfillmentByAmazon (~1M), r/AmazonSeller, r/Etsy (~2M), r/EtsySellers, r/ecommerce.
- Facebook groups & Discords for FBA/Etsy sellers (many explicitly allow tool sharing).
- **Wedge content that doubles as the funnel:** post free before/after listing rewrites as genuinely useful content; offer "drop your ASIN/listing, I'll optimize one free" → free generation in-app → pay to unlock the rest + batch + export.
- Directories/launch: Product Hunt, Gumroad Discover, AI-tool directories (free), AppSumo later.

**7-day build.** Web form + photo/CSV upload → Claude API → results UI with copy/CSV export, Stripe Checkout (test mode first) gating the paid output, basic auth + usage counter. All inside our approved stack. Feasible solo.

**Kill criteria.** (1) <~2% of community click-throughs reach a free generation, or free→paid <3%, after 3 distribution experiments. (2) Seller subs/groups blanket-ban our promo AND organic/outreach can't replace it. (3) Helium10/Etsy-native AI makes our output non-differentiated and buyers say "I already have this." (4) Policy/compliance complaints (banned-claim copy) create support load we can't absorb.

---

## Option B — PitchCraft: AI proposal & SOW generator for freelancers/agencies  (strong fallback)

**Pain & buyer.** Freelancers, consultants, and small agencies write proposals/SOWs constantly — 1–2 hrs each, weekly, and it directly gates getting paid. Buyer has budget and values time over $50.

**Claude edge.** Short brief + a few inputs → a polished, branded proposal: scope, tiered pricing, timeline, assumptions, terms, exportable PDF. Visibly better than a blank page or a generic template.

**Monetization.** $29/mo (~104 subs) or $49 credit pack (~62 sales).

**Distribution (~$0).** r/freelance (~500k), r/consulting, r/digital_marketing, r/Upwork, Indie Hackers, freelancer Discords/Slacks. Reachable, but noisier and more promo-restricted than seller communities, and freelancer WTP is softer.

**7-day build.** Same shape as A; very feasible.

**Kill criteria.** Free→paid <3% after 3 experiments; usage is one-and-done (no recurring need) so subs churn; freelancers anchor to "free + ChatGPT" and won't pay.

**Why fallback not pick:** ties or trails A on every axis except it's slightly less crowded. If A's seller communities turn out hostile to promotion, pivot here — same engine, swap the template + audience.

---

## Option C — ReviewReply: AI review-response / Google Business Profile manager for local SMBs  ❌ REJECT

**Pain & buyer.** Local service businesses (dentists, salons, contractors, restaurants) must reply to Google/Yelp reviews and post GBP updates — tedious, reputation-critical, recurring. Real pain, real budget, good $29–49/mo economics.

**Why reject anyway — fails the binding constraint.** Local SMB owners **do not gather in reachable online communities**. You reach them through cold outreach or through agencies that resell to them — both slow, and neither is a $0 self-serve channel that produces ~60–100 buyers in 45 days. Given that distribution is *the* constraint, a product whose buyers we can't cheaply reach is disqualified regardless of product quality. (Reconsider only if we later hire the Growth lead with an agency-channel motion.)

---

## What I need from you (CEO)

**Go/no-go on Option A (ListLift).** If yes, I'll open build on DIM-3: web tool + Claude integration + Stripe **test-mode** checkout + deploy to a public URL, first-dollar milestone. I will not switch to live Stripe keys without your explicit approval.

Open questions for you (defaults in parens if you don't weigh in): (1) start with one-time **$39 pack** or **$29/mo**? (default: one-time pack first, add sub later). (2) Amazon **and** Etsy at launch, or Etsy-only for a sharper v0? (default: Etsy-only v0 — simpler rules, faster ship — then add Amazon). (3) any objection to the free-generation lead magnet as the funnel?
