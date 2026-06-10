/**
 * web-enrichment Lambda
 * Fetches raw company data from the web:
 *   - Company website (if known) or finds it via Brave search
 *   - Google Business Profile / Maps listing
 *   - News articles (top 3)
 *   - General social / directory presence
 *
 * Returns raw data objects. NO AI synthesis — that's enrichment-synthesis.
 */

const CORS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://outreach.ishsitotombe.co.uk',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const BRAVE_BASE = 'https://api.search.brave.com/res/v1/web/search';

async function braveSearch(query, apiKey, count = 5) {
  const url = `${BRAVE_BASE}?q=${encodeURIComponent(query)}&count=${count}&safesearch=off`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchPage(url, maxBytes = 50000) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OutreachBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, maxBytes);
  } catch {
    return null;
  }
}

function extractMeta(html) {
  if (!html) return { title: null, metaDescription: null };
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    metaDescription: descMatch ? descMatch[1].trim() : null,
  };
}

function detectTechStack(html) {
  if (!html) return [];
  const stack = [];
  const checks = [
    { pattern: /wordpress/i, name: 'WordPress' },
    { pattern: /shopify/i, name: 'Shopify' },
    { pattern: /wix\.com/i, name: 'Wix' },
    { pattern: /squarespace/i, name: 'Squarespace' },
    { pattern: /webflow/i, name: 'Webflow' },
    { pattern: /react|reactjs/i, name: 'React' },
    { pattern: /next\.js|nextjs/i, name: 'Next.js' },
    { pattern: /angular/i, name: 'Angular' },
    { pattern: /vue\.js|vuejs/i, name: 'Vue.js' },
    { pattern: /gtm\.js|google.*tag.*manager/i, name: 'Google Tag Manager' },
    { pattern: /ga\.js|google-analytics|gtag/i, name: 'Google Analytics' },
    { pattern: /hubspot/i, name: 'HubSpot' },
    { pattern: /intercom/i, name: 'Intercom' },
    { pattern: /zendesk/i, name: 'Zendesk' },
    { pattern: /stripe/i, name: 'Stripe' },
    { pattern: /livechat|tawk\.to|crisp/i, name: 'Live chat' },
    { pattern: /cloudflare/i, name: 'Cloudflare' },
  ];
  for (const { pattern, name } of checks) {
    if (pattern.test(html)) stack.push(name);
  }
  return [...new Set(stack)];
}

function hasLivechat(html) {
  return /livechat|tawk\.to|crisp|intercom|zendesk.*chat|freshchat/i.test(html || '');
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { companyName, companyNumber, website: knownWebsite } = body;
  if (!companyName) {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'companyName required' }) };
  }

  const braveKey = process.env.BRAVE_API_KEY;
  if (!braveKey) {
    return { statusCode: 500, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Brave API key not configured' }) };
  }

  const result = {
    website: null,
    gbp: null,
    news: null,
    social: null,
  };

  // ── 1. Find / fetch website ────────────────────────────────────────────

  let websiteUrl = knownWebsite || null;

  if (!websiteUrl) {
    // Try to find official website via Brave
    const searchRes = await braveSearch(`"${companyName}" official website`, braveKey, 5);
    const webResults = searchRes?.web?.results || [];
    // Pick first result that looks like an official site (not a directory)
    const directories = /companies house|duedil|endole|linkedin|facebook|yell|bark\.com|checkatrade|trustpilot/i;
    const candidate = webResults.find(r => !directories.test(r.url) && r.url.startsWith('http'));
    websiteUrl = candidate?.url ? new URL(candidate.url).origin : null;
  }

  if (websiteUrl) {
    const html = await fetchPage(websiteUrl);
    const { title, metaDescription } = extractMeta(html);
    const techStack = detectTechStack(html);
    result.website = {
      url: websiteUrl,
      lastChecked: new Date().toISOString(),
      isActive: !!html,
      title,
      metaDescription,
      techStack: techStack.length > 0 ? techStack : null,
      hasBlog: html ? /blog|news|articles|insights/i.test(html) : null,
      hasLivechat: html ? hasLivechat(html) : null,
      mobileScore: null, // not determinable from raw HTML; enrichment-synthesis can infer
      lastModifiedEstimate: null,
      rawHtmlExcerpt: html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2000) : null,
    };
  } else {
    result.website = { url: null, lastChecked: new Date().toISOString(), isActive: false, title: null, metaDescription: null, techStack: null, hasBlog: null, hasLivechat: null, mobileScore: null, lastModifiedEstimate: null };
  }

  // ── 2. Google Business Profile / Maps ──────────────────────────────────

  const gbpSearch = await braveSearch(`"${companyName}" google reviews OR site:google.com/maps`, braveKey, 5);
  const gbpResults = gbpSearch?.web?.results || [];
  const gbpResult = gbpResults.find(r => /google\.com\/maps|maps\.google/i.test(r.url));

  if (gbpResult) {
    // Attempt to fetch the maps page (often blocked, but we get metadata from Brave)
    const snippet = gbpResult.description || gbpResult.extra_snippets?.[0] || '';
    const ratingMatch = snippet.match(/(\d+\.?\d*)\s*(?:stars?|out of 5|\/ ?5)/i) || snippet.match(/rating[:\s]+(\d+\.?\d*)/i);
    const reviewMatch = snippet.match(/(\d+[\d,]*)\s+reviews?/i);
    result.gbp = {
      category: null,
      address: null,
      phone: null,
      hours: null,
      reviewRating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
      reviewCount: reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, '')) : null,
      recentReviewThemes: null, // populated by enrichment-synthesis
      photosCount: null,
      isVerified: null,
      source: 'maps',
      rawSnippet: snippet,
      gbpUrl: gbpResult.url,
    };
  }

  // ── 3. News articles ───────────────────────────────────────────────────

  const newsSearch = await braveSearch(`"${companyName}" news`, braveKey, 5);
  const newsResults = newsSearch?.web?.results || [];
  const articles = [];

  for (const r of newsResults.slice(0, 3)) {
    articles.push({
      headline: r.title || '',
      url: r.url || '',
      source: r.meta_url?.hostname || new URL(r.url || 'https://example.com').hostname,
      date: r.page_age || null,
      excerpt: r.description?.slice(0, 300) || '',
    });
  }

  result.news = { articles };

  // ── 4. Social / general presence ──────────────────────────────────────

  const generalSearch = await braveSearch(companyName, braveKey, 10);
  const generalResults = generalSearch?.web?.results || [];

  const socialSources = [];
  const socialPatterns = [
    { pattern: /linkedin\.com\/company/i, platform: 'LinkedIn' },
    { pattern: /facebook\.com/i, platform: 'Facebook' },
    { pattern: /twitter\.com|x\.com/i, platform: 'X (Twitter)' },
    { pattern: /instagram\.com/i, platform: 'Instagram' },
    { pattern: /youtube\.com/i, platform: 'YouTube' },
    { pattern: /trustpilot\.com/i, platform: 'Trustpilot' },
    { pattern: /yell\.com/i, platform: 'Yell' },
    { pattern: /checkatrade\.com/i, platform: 'Checkatrade' },
    { pattern: /bark\.com/i, platform: 'Bark' },
  ];

  for (const r of generalResults) {
    for (const { pattern, platform } of socialPatterns) {
      if (pattern.test(r.url) && !socialSources.find(s => s.platform === platform)) {
        socialSources.push({
          platform,
          url: r.url,
          lastActivity: null,
          followerCount: null,
        });
      }
    }
  }

  result.social = { sources: socialSources };

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  };
};
