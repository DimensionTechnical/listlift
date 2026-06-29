// Listing generation via Claude. Falls back to a deterministic mock when no
// ANTHROPIC_API_KEY is configured, so the funnel is fully testable offline.
import Anthropic from '@anthropic-ai/sdk';
import { buildPrompt, normalizeListing, mockListing } from './listings.js';

// CEO chose Haiku for cost (~10x cheaper than Sonnet) — DIM-3, 2026-06-29.
const MODEL = process.env.LISTLIFT_MODEL || 'claude-haiku-4-5-20251001';

export const usingRealClaude = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export async function generateListing(input) {
  if (!usingRealClaude()) {
    return { listing: mockListing(input), mode: 'mock', model: 'mock' };
  }
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system:
      'You are ListLift, an expert Etsy SEO copywriter. You always return only valid JSON matching the requested schema, nothing else.',
    messages: [{ role: 'user', content: buildPrompt(input) }],
  });
  const text = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return { listing: normalizeListing(text), mode: 'live', model: MODEL };
}
