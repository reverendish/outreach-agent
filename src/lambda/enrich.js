/**
 * enrich Lambda — Orchestrator
 * Called by the frontend on the /enrich endpoint.
 * Runs ch-lookup + web-enrichment in parallel, then calls enrichment-synthesis.
 * Returns a complete Enrichment object ready to store in IndexedDB.
 *
 * This avoids needing the frontend to make 3 API calls and coordinate them.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Re-use the logic from ch-lookup and web-enrichment inline to avoid
// Lambda-to-Lambda invocation latency and cross-function auth complexity.
// In production, consider splitting if cold starts become an issue.

// Multi-origin allowlist — reflects the request origin so browsers accept the response.
// Falling back to the outreach app origin keeps legacy single-origin clients working.
const ALLOWED_ORIGINS = new Set([
  'https://outreach.ishsitotombe.co.uk',
  'https://ishsitotombe.co.uk',
  'https://www.ishsitotombe.co.uk',
]);

function corsHeaders(requestOrigin) {
  const origin = ALLOWED_ORIGINS.has(requestOrigin)
    ? requestOrigin
    : 'https://outreach.ishsitotombe.co.uk';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';

// ── Shared helpers ──────────────────────────────────────────────────────────

function chHeaders(apiKey) {
  return { Authorization: 'Basic ' + Buffer.from(apiKey + ':').toString('base64') };
}

async function fetchJSON(url, options = {}) {
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function fetchText(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OutreachBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 50000);
  } catch { return null; }
}

async function braveSearch(query, apiKey, count = 5) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&safesearch=off`;
  return fetchJSON(url, {
    headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey },
  });
}

const ENTITY_CATEGORY_MAP = {
  'ltd': 'corporate', 'plc': 'corporate', 'llp': 'corporate',
  'limited-partnership': 'corporate', 'community-interest-company': 'corporate',
  'scottish-limited-partnership': 'corporate',
  'charitable-incorporated-organisation': 'flagged',
  'industrial-and-provident-society': 'flagged',
  'registered-society': 'flagged',
};
const mapEntityCategory = (t) => ENTITY_CATEGORY_MAP[t?.toLowerCase()] ?? 'unregistered';

function extractMeta(html) {
  if (!html) return { title: null, metaDescription: null };
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  return {
    title: titleMatch ? titleMatch[1].trim().slice(0, 100) : null,
    metaDescription: descMatch ? descMatch[1].trim().slice(0, 200) : null,
  };
}

function detectTechStack(html) {
  if (!html) return [];
  const checks = [
    [/wordpress/i, 'WordPress'], [/shopify/i, 'Shopify'], [/wix\.com/i, 'Wix'],
    [/squarespace/i, 'Squarespace'], [/webflow/i, 'Webflow'], [/react|reactjs/i, 'React'],
    [/next\.js|nextjs/i, 'Next.js'], [/angular/i, 'Angular'], [/vue\.js|vuejs/i, 'Vue.js'],
    [/gtm\.js|google.*tag.*manager/i, 'GTM'], [/ga\.js|google-analytics|gtag/i, 'Google Analytics'],
    [/hubspot/i, 'HubSpot'], [/intercom/i, 'Intercom'], [/stripe/i, 'Stripe'],
    [/livechat|tawk\.to|crisp/i, 'Live chat'], [/cloudflare/i, 'Cloudflare'],
  ];
  return [...new Set(checks.filter(([p]) => p.test(html)).map(([, n]) => n))];
}

// ── Main handler ────────────────────────────────────────────────────────────

export const handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const CORS = corsHeaders(origin);

  // Top-level guard: any unhandled exception returns CORS headers so browsers
  // get a readable error instead of an opaque CORS block.
  try {

  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const internalKey = process.env.INTERNAL_API_KEY;
  if (internalKey && event.headers?.['x-internal-key'] !== internalKey) {
    return { statusCode: 401, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorised' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { companyNumber, companyName, website: knownWebsite, previousEnrichment, profileContext } = body;
  if (!companyNumber && !companyName) {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'companyNumber or companyName required' }) };
  }

  const chKey = process.env.COMPANIES_HOUSE_API_KEY;
  const braveKey = process.env.BRAVE_API_KEY;

  // ── Phase 1: CH lookup + web enrichment in parallel ────────────────────

  const [chResult, webResult] = await Promise.allSettled([
    // CH lookup
    (async () => {
      if (!chKey || !companyNumber) return null;
      const [co, officers, filings] = await Promise.allSettled([
        fetchJSON(`https://api.company-information.service.gov.uk/company/${companyNumber}`, { headers: chHeaders(chKey) }),
        fetchJSON(`https://api.company-information.service.gov.uk/company/${companyNumber}/officers?items_per_page=50`, { headers: chHeaders(chKey) }),
        fetchJSON(`https://api.company-information.service.gov.uk/company/${companyNumber}/filing-history?category=confirmation-statement,mortgage&items_per_page=20`, { headers: chHeaders(chKey) }),
      ]);
      return { company: co.value, officers: officers.value, filings: filings.value };
    })(),

    // Web enrichment
    (async () => {
      if (!braveKey || !companyName) return null;
      const name = companyName;
      const [websiteSearch, gbpSearch, newsSearch, generalSearch] = await Promise.allSettled([
        !knownWebsite ? braveSearch(`"${name}" official website`, braveKey, 5) : Promise.resolve(null),
        braveSearch(`"${name}" google reviews`, braveKey, 5),
        braveSearch(`"${name}" news`, braveKey, 5),
        braveSearch(name, braveKey, 10),
      ]);

      // Website
      let websiteData = null;
      let websiteUrl = knownWebsite;
      if (!websiteUrl) {
        const webRes = websiteSearch.value?.web?.results || [];
        const dirs = /companies house|duedil|endole|linkedin|facebook|yell|bark\.com|checkatrade|trustpilot/i;
        const c = webRes.find(r => !dirs.test(r.url) && r.url.startsWith('http'));
        if (c) {
          try { websiteUrl = new URL(c.url).origin; } catch { websiteUrl = c.url; }
        }
      }
      if (websiteUrl) {
        const html = await fetchText(websiteUrl);
        const { title, metaDescription } = extractMeta(html);
        websiteData = {
          url: websiteUrl, isActive: !!html, title, metaDescription,
          techStack: detectTechStack(html),
          hasBlog: html ? /blog|news|articles|insights/i.test(html) : null,
          hasLivechat: html ? /livechat|tawk\.to|crisp|intercom/i.test(html) : null,
          rawExcerpt: html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2000) : null,
        };
      }

      // GBP
      const gbpRes = gbpSearch.value?.web?.results || [];
      const gbpItem = gbpRes.find(r => /google\.com\/maps|maps\.google/i.test(r.url));
      const gbpSnippet = gbpItem?.description || gbpItem?.extra_snippets?.[0] || '';
      const ratingM = gbpSnippet.match(/(\d+\.?\d*)\s*(?:stars?|\/\s*5)/i);
      const reviewM = gbpSnippet.match(/(\d[\d,]*)\s+reviews?/i);
      const gbpData = gbpItem ? {
        reviewRating: ratingM ? parseFloat(ratingM[1]) : null,
        reviewCount: reviewM ? parseInt(reviewM[1].replace(/,/g, '')) : null,
        source: 'maps',
        gbpUrl: gbpItem.url,
        rawSnippet: gbpSnippet,
      } : null;

      // News
      const newsItems = (newsSearch.value?.web?.results || []).slice(0, 3).map(r => ({
        headline: r.title || '',
        url: r.url || '',
        source: (() => { try { return new URL(r.url).hostname; } catch { return r.url; } })(),
        date: r.page_age || null,
        excerpt: (r.description || '').slice(0, 300),
      }));

      // Social
      const generalRes = generalSearch.value?.web?.results || [];
      const SOCIAL_PATTERNS = [
        [/linkedin\.com\/company/i, 'LinkedIn'], [/facebook\.com/i, 'Facebook'],
        [/twitter\.com|x\.com/i, 'X (Twitter)'], [/instagram\.com/i, 'Instagram'],
        [/youtube\.com/i, 'YouTube'], [/trustpilot\.com/i, 'Trustpilot'],
        [/yell\.com/i, 'Yell'], [/checkatrade\.com/i, 'Checkatrade'],
      ];
      const socialSources = [];
      for (const r of generalRes) {
        for (const [pat, platform] of SOCIAL_PATTERNS) {
          if (pat.test(r.url) && !socialSources.find(s => s.platform === platform)) {
            socialSources.push({ platform, url: r.url, lastActivity: null, followerCount: null });
          }
        }
      }

      return { websiteData, gbpData, newsItems, socialSources };
    })(),
  ]);

  const chData = chResult.status === 'fulfilled' ? chResult.value : null;
  const webData = webResult.status === 'fulfilled' ? webResult.value : null;

  // ── Phase 2: Synthesis via Bedrock ────────────────────────────────────

  const systemPrompt = `You are a B2B data analyst. Given raw company research data, return a structured JSON Enrichment object.
Rules:
- Do NOT invent data. Return null for fields you cannot determine.
- Pain points must be inferred from actual data, not generic industry assumptions. Max 5.
- Return ONLY valid JSON — no explanation, no markdown.
- Flag conflicting data in conflictingDataFlags.
- confidenceScore 0–100 based on data richness.

Output schema (all fields required, use null for unknown):
{"website":{"url":null,"lastChecked":"","isActive":false,"title":null,"metaDescription":null,"techStack":null,"hasBlog":null,"hasLivechat":null,"mobileScore":null,"lastModifiedEstimate":null},"gbp":{"category":null,"address":null,"phone":null,"hours":null,"reviewRating":null,"reviewCount":null,"recentReviewThemes":null,"photosCount":null,"isVerified":null,"source":null},"filings":{"lastConfirmationStatement":null,"confirmationStatementOverdue":false,"activeCharges":0,"recentDirectorChanges":[],"dormantFlag":false},"news":{"articles":[],"overallSentiment":null,"lastMentionDate":null},"social":{"sources":[],"overallPresence":null},"companySize":{"employeeEstimate":null,"revenueEstimate":null,"source":null,"confidence":null},"credentialsAndAwards":null,"activeJobPostings":{"count":null,"roles":null,"source":null},"painPoints":null,"confidenceScore":0,"conflictingDataFlags":[],"sourcesUsed":[],"enrichedAt":""}`;

  const userPrompt = `Company: ${companyName || chData?.company?.company_name || 'Unknown'}
Profile context (what outreach sender offers): ${profileContext ? JSON.stringify(profileContext) : 'Not provided'}

CH data: ${JSON.stringify(chData, null, 2)}
Web data: ${JSON.stringify(webData, null, 2)}
Current time: ${new Date().toISOString()}

Return ONLY the JSON.`;

  let enrichment;
  try {
    const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'eu-west-2' });
    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    const res = await bedrock.send(command);
    const parsed = JSON.parse(new TextDecoder().decode(res.body));
    const text = parsed.content[0].text;
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    enrichment = JSON.parse(cleaned);
  } catch (e) {
    return { statusCode: 500, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Synthesis failed', details: e.message }) };
  }

  // ── Change summary ────────────────────────────────────────────────────

  let changesSummary = '';
  if (previousEnrichment) {
    try {
      const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'eu-west-2' });
      const cmd = new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 150,
          temperature: 0.1,
          system: 'You write one-sentence plain-English summaries of data changes.',
          messages: [{ role: 'user', content: `Summarise the key changes between these two enrichment snapshots in one sentence.\nBefore: ${JSON.stringify(previousEnrichment)}\nAfter: ${JSON.stringify(enrichment)}\nOutput only the sentence.` }],
        }),
      });
      const r = await bedrock.send(cmd);
      const p = JSON.parse(new TextDecoder().decode(r.body));
      changesSummary = p.content[0].text.trim();
    } catch { changesSummary = ''; }
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrichment, changesSummary }),
  };

  } catch (e) {
    // Outer catch: ensures CORS headers are always present even on unexpected failures.
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error', details: e.message }),
    };
  }
};
