/**
 * Generate Lambda — Bedrock-powered cold email writer.
 *
 * POST /
 * Body: { contact, enrichment, isFollowup?, followupNumber?, previousEmails? }
 *
 * Auth: X-Internal-Key + X-User-Id (injected by BFF — no direct browser access)
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { checkInternalKey } from './auth.js';
import { corsHeaders } from './cors.js';
import { checkRateLimit } from './rate-limit.js';

const MODEL  = process.env.BEDROCK_MODEL_ID || 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';
const REGION = process.env.BEDROCK_REGION   || 'eu-west-2';
const bedrock = new BedrockRuntimeClient({ region: REGION });

let CORS;

function json(status, body) {
  return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function checkAuth(event) {
  return checkInternalKey(event);
}

function buildPrompt(contact, enrichment, isFollowup, followupNumber, previousEmails) {
  const directorName = contact.directors?.[0]?.name || '';
  const firstName = directorName.split(' ')[0] || '';
  const companyName = contact.companyName || contact.title || 'the company';
  const sector = contact.enrichment?.sector || enrichment?.sector || contact.sector || 'business services';

  const painPoints = enrichment?.painPoints || contact.enrichment?.painPoints || [];
  const whyNow = enrichment?.whyContactNow || contact.enrichment?.whyContactNow || '';
  const services = enrichment?.services?.join(', ') || contact.enrichment?.services?.join(', ') || '';
  const description = enrichment?.description || contact.enrichment?.description || '';

  const contextBlock = [
    description && `About them: ${description}`,
    services && `Services: ${services}`,
    painPoints.length > 0 && `Potential pain points: ${painPoints.join(', ')}`,
    whyNow && `Why contact now: ${whyNow}`,
  ].filter(Boolean).join('\n');

  if (isFollowup && previousEmails?.length > 0) {
    const prevChain = previousEmails.map((e, i) => `Email ${i + 1}:\n${e}`).join('\n\n---\n\n');
    return `You are Ish, a developer based in Colchester who builds automations and software tools for UK businesses.

You previously sent ${followupNumber} email(s) to ${firstName || 'the contact'} at ${companyName} (${sector}). Write follow-up email #${followupNumber + 1}.

Previous emails:
${prevChain}

${contextBlock ? `Context:\n${contextBlock}\n` : ''}
Rules:
- Reference the previous email briefly but don't be passive-aggressive about no reply
- Add something new — a different angle, a small insight, or a relevant example
- 2–3 sentences max
- End with a low-pressure question or offer to share an example
- No buzzwords (streamline, leverage, synergy)
- No "I hope this finds you well"
- Sound like a real person

Format:
Subject: [short subject, max 8 words]

[greeting]

[email body]

Output only the email. No commentary.`;
  }

  return `You are Ish, a developer based in Colchester who builds automations and software tools for UK businesses. You send short, specific cold emails to directors at UK SMBs.

Target:
- Company: ${companyName}
- Sector: ${sector}
- Director/contact: ${firstName || 'the director'}
${contextBlock ? `\nContext:\n${contextBlock}` : ''}

Write a cold outreach email. Rules:
- Subject: max 8 words, title case, no ALL CAPS
- Greeting: use first name if it looks like a person's name, otherwise "Hi there,"
- Body: 2–3 sentences. Be specific to their industry. Sound like a real person.
- No buzzwords (streamline, leverage, synergy). No "I hope this finds you well".
- Do not mention AI in the first sentence.
- End with one simple low-pressure question.

Format:
Subject: [subject line]

[greeting]

[email body]

Output only the email. No commentary.`;
}

export const handler = async (event) => {
  CORS = corsHeaders(event);
  const method = event.requestContext?.http?.method || 'POST';
  if (method === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  if (!checkAuth(event)) return json(401, { error: 'Unauthorised' });
  const userId = event.headers?.['x-user-id'];
  if (!userId) return json(401, { error: 'Missing X-User-Id' });

  const limited = await checkRateLimit(userId, 'generate', 50);
  if (limited) return { ...limited, headers: CORS };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const { contact, enrichment, isFollowup = false, followupNumber = 0, previousEmails = [] } = body;
  if (!contact) return json(400, { error: 'contact is required' });

  const prompt = buildPrompt(contact, enrichment, isFollowup, followupNumber, previousEmails);

  try {
    const command = new InvokeModelCommand({
      modelId: MODEL,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 500,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const response = await bedrock.send(command);
    const parsed = JSON.parse(new TextDecoder().decode(response.body));
    const result = parsed.content[0].text;

    // Parse subject and body from the structured output
    const lines = result.trim().split('\n');
    const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:'));
    const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, '').trim() : '';
    const bodyStart = subjectLine ? lines.indexOf(subjectLine) + 1 : 0;
    const emailBody = lines.slice(bodyStart).join('\n').trim();

    return json(200, { result, subject, body: emailBody });

  } catch (e) {
    console.error('Generation error:', e);
    return json(500, { error: 'Generation failed', details: e.message });
  }
};
