// Etsy listing domain logic: the prompt, output schema, validation, CSV export,
// and a deterministic mock generator used when no ANTHROPIC_API_KEY is set.

// Etsy hard limits we tune to:
//  - Title: <= 140 chars, keyword-front-loaded
//  - Tags: exactly 13, each <= 20 chars, multi-word allowed
//  - Description: long-form, benefit-led, scannable
export const ETSY = { TITLE_MAX: 140, TAGS: 13, TAG_MAX: 20 };

export const OUTPUT_SCHEMA = `Return ONLY valid JSON (no markdown fences) with this exact shape:
{
  "title": "string, <=140 chars, keyword-front-loaded, no ALL CAPS spam",
  "tags": ["exactly 13 strings, each <=20 chars, lowercase, multi-word ok, no '#'"],
  "description": "string, 120-250 words, benefit-led, scannable short paragraphs, includes a materials/size line and a gift-angle line where relevant",
  "materials": ["3-7 short material/component strings"],
  "primary_keywords": ["5-8 core search phrases you optimized for"],
  "alt_text": "string, <=125 chars, describes the main photo for accessibility/SEO"
}`;

export function buildPrompt(input) {
  const { productName, category, details, keywords, audience, tone } = input;
  return `You are ListLift, an expert Etsy SEO and conversion copywriter. Optimize a single Etsy listing.

PRODUCT INPUT
- Name/idea: ${productName || '(not given)'}
- Category: ${category || '(not given)'}
- Details/specs: ${details || '(not given)'}
- Seed keywords: ${keywords || '(none — infer the best ones)'}
- Target buyer: ${audience || '(infer)'}
- Brand tone: ${tone || 'warm, trustworthy, lightly enthusiastic'}

RULES
- Optimize for Etsy search: front-load the strongest buyer search phrase in the title.
- Title <= ${ETSY.TITLE_MAX} characters. Tags: EXACTLY ${ETSY.TAGS}, each <= ${ETSY.TAG_MAX} characters, all lowercase, multi-word phrases preferred, NO duplicates, NO single-letter filler.
- Spread keywords: tags should cover distinct search intents (style, use, recipient, occasion, material), not 13 variations of one phrase.
- Description: benefit-led and scannable; never make unverifiable claims; no medical or guarantee language.
- Be specific to the product; do not invent dimensions you weren't given — speak generally if unknown.

${OUTPUT_SCHEMA}`;
}

// Parse + normalize model output into a guaranteed-valid listing object.
export function normalizeListing(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/m, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    obj = JSON.parse(cleaned.slice(start, end + 1));
  }
  const title = String(obj.title || '').trim().slice(0, ETSY.TITLE_MAX);

  let tags = Array.isArray(obj.tags) ? obj.tags : [];
  tags = tags
    .map((t) => String(t).toLowerCase().replace(/[#]/g, '').trim().slice(0, ETSY.TAG_MAX))
    .filter((t, i, a) => t && a.indexOf(t) === i);
  // pad/trim to exactly 13
  while (tags.length < ETSY.TAGS) tags.push(`etsy ${tags.length + 1}`);
  tags = tags.slice(0, ETSY.TAGS);

  return {
    title,
    tags,
    description: String(obj.description || '').trim(),
    materials: Array.isArray(obj.materials) ? obj.materials.map(String) : [],
    primary_keywords: Array.isArray(obj.primary_keywords) ? obj.primary_keywords.map(String) : [],
    alt_text: String(obj.alt_text || '').trim().slice(0, 125),
  };
}

// CSV with one row per listing — columns aligned to how sellers paste into Etsy.
export function listingsToCsv(listings) {
  const headers = ['title', 'tags', 'description', 'materials', 'primary_keywords', 'alt_text'];
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [headers.join(',')];
  for (const l of listings) {
    rows.push([
      esc(l.title),
      esc((l.tags || []).join(', ')),
      esc(l.description),
      esc((l.materials || []).join(', ')),
      esc((l.primary_keywords || []).join(', ')),
      esc(l.alt_text),
    ].join(','));
  }
  return rows.join('\r\n');
}

// Deterministic mock so the whole funnel is demoable without an API key.
export function mockListing(input) {
  const name = (input.productName || 'Handmade Item').trim();
  const cat = (input.category || 'handmade').toLowerCase();
  const base = name.toLowerCase();
  const tagSeeds = [
    base.slice(0, 20),
    `${cat} gift`,
    'personalized gift',
    'gift for her',
    'gift for him',
    'home decor',
    'handmade gift',
    'unique gift',
    'birthday gift',
    'custom order',
    'small batch',
    'made to order',
    'gift idea',
  ];
  const tags = tagSeeds
    .map((t) => t.toLowerCase().slice(0, ETSY.TAG_MAX))
    .filter((t, i, a) => a.indexOf(t) === i)
    .slice(0, ETSY.TAGS);
  return normalizeListing({
    title: `${name} | Personalized ${cat} Gift, Handmade Custom Keepsake for Her & Him`.slice(0, ETSY.TITLE_MAX),
    tags,
    description:
      `Meet your new favorite ${name}. Thoughtfully handmade and built to last, it makes an easy, memorable gift for birthdays, holidays, or "just because."\n\n` +
      `• Carefully crafted with attention to detail\n• Personalization available on request\n• Ships ready to gift\n\n` +
      `Materials and sizing vary by option — message us for custom requests. Add a little meaning to the everyday with ${name}. [SAMPLE OUTPUT — set ANTHROPIC_API_KEY for real AI listings]`,
    materials: ['premium materials', 'eco-friendly packaging'],
    primary_keywords: [base, `${cat} gift`, 'personalized gift', 'handmade gift', 'gift for her'],
    alt_text: `Handmade ${name} shown on a clean background, a personalized ${cat} gift idea`,
  });
}
