/**
 * enrichment-synthesis Lambda
 * Receives raw output from ch-lookup + web-enrichment.
 * Makes a single Bedrock call to produce a structured Enrichment object.
 * Also computes change summary if previous enrichment is provided.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'eu-west-2' });

const CORS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://outreach.ishsitotombe.co.uk',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';

async function bedrockCall(systemPrompt, userPrompt) {
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
  return parsed.content[0].text;
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { chData, webData, previousEnrichment, profileContext } = body;

  if (!chData && !webData) {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'chData or webData required' }) };
  }

  const systemPrompt = `You are a B2B data analyst. Given raw company research data, return a structured JSON Enrichment object.

Rules:
- Do NOT invent information. If a field cannot be determined from the data, return null.
- Pain points must be inferred from the actual data — not generic industry pain points.
- Return ONLY valid JSON. No explanation, no markdown, no code blocks.
- Conflicting data (e.g. size estimates that differ across sources) must be flagged in conflictingDataFlags.
- confidenceScore is 0–100 based on how much real data was found.

The JSON must match this schema exactly:
{
  "website": {
    "url": string|null,
    "lastChecked": string,
    "isActive": boolean,
    "title": string|null,
    "metaDescription": string|null,
    "techStack": string[]|null,
    "hasBlog": boolean|null,
    "hasLivechat": boolean|null,
    "mobileScore": "good"|"poor"|"unknown"|null,
    "lastModifiedEstimate": string|null
  }|null,
  "gbp": {
    "category": string|null,
    "address": string|null,
    "phone": string|null,
    "hours": string|null,
    "reviewRating": number|null,
    "reviewCount": number|null,
    "recentReviewThemes": string[]|null,
    "photosCount": number|null,
    "isVerified": boolean|null,
    "source": "gbp"|"maps"|null
  }|null,
  "filings": {
    "lastConfirmationStatement": string|null,
    "confirmationStatementOverdue": boolean,
    "activeCharges": number,
    "recentDirectorChanges": [{"name":string,"role":string,"type":"appointment"|"resignation","date":string}],
    "dormantFlag": boolean
  }|null,
  "news": {
    "articles": [{"headline":string,"url":string,"source":string,"date":string|null,"excerpt":string}],
    "overallSentiment": "positive"|"neutral"|"negative"|"mixed"|null,
    "lastMentionDate": string|null
  }|null,
  "social": {
    "sources": [{"platform":string,"url":string,"lastActivity":string|null,"followerCount":number|null}],
    "overallPresence": "active"|"inactive"|"none"|null
  }|null,
  "companySize": {
    "employeeEstimate": string|null,
    "revenueEstimate": string|null,
    "source": string|null,
    "confidence": "high"|"medium"|"low"|null
  }|null,
  "credentialsAndAwards": string[]|null,
  "activeJobPostings": {
    "count": number|null,
    "roles": string[]|null,
    "source": string|null
  }|null,
  "painPoints": string[]|null,
  "confidenceScore": number,
  "conflictingDataFlags": string[],
  "sourcesUsed": string[],
  "enrichedAt": string
}`;

  const userPrompt = `Here is the raw research data for this company. Produce the Enrichment JSON object.

Profile context (what the outreach sender does — use this to weight which pain points are most relevant):
${profileContext ? JSON.stringify(profileContext, null, 2) : 'Not provided'}

Companies House data:
${chData ? JSON.stringify(chData, null, 2) : 'Not available'}

Web enrichment data (website, GBP, news, social):
${webData ? JSON.stringify(webData, null, 2) : 'Not available'}

Current datetime: ${new Date().toISOString()}

Return ONLY the JSON object.`;

  let enrichmentText;
  try {
    enrichmentText = await bedrockCall(systemPrompt, userPrompt);
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Bedrock call failed', details: e.message }),
    };
  }

  // Parse JSON — strip any accidental markdown fences
  let enrichment;
  try {
    const cleaned = enrichmentText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    enrichment = JSON.parse(cleaned);
  } catch {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to parse Bedrock response as JSON', raw: enrichmentText.slice(0, 500) }),
    };
  }

  // ── Change summary (if previous enrichment provided) ──────────────────

  let changesSummary = '';
  if (previousEnrichment) {
    try {
      const changeSummaryPrompt = `Compare these two enrichment snapshots and write a single plain-English sentence summarising the most important changes. Be specific. If nothing meaningful changed, say "No significant changes detected."

Previous:
${JSON.stringify(previousEnrichment, null, 2)}

Current:
${JSON.stringify(enrichment, null, 2)}

Output only the one-sentence summary.`;

      changesSummary = await bedrockCall('You are a concise data comparison assistant.', changeSummaryPrompt);
      changesSummary = changesSummary.trim();
    } catch {
      changesSummary = 'Change summary unavailable.';
    }
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrichment, changesSummary }),
  };
};
