/**
 * demo-send Lambda
 * Portfolio demo endpoint — generates a personalised cold email via Bedrock
 * then sends it to the visitor's inbox via Resend.
 *
 * Called by ishsitotombe.co.uk's "send yourself a demo email" form.
 * Rate limited by API Gateway (5 req/s burst 20) — no additional per-user
 * throttle needed at this scale.
 *
 * Required SSM params:
 *   /outreach/resend_api_key  — Resend API key
 * Resend sender domain must have "outreach@ishsitotombe.co.uk" verified.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { checkRateLimit } from './rate-limit.js';
import { corsHeaders } from './cors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const handler = async (event) => {
  const CORS = corsHeaders(event);

  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' }),
    };
  }

  const { name, recipientEmail } = body;

  if (!name || !recipientEmail) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'name and recipientEmail are required' }),
    };
  }

  if (!EMAIL_RE.test(recipientEmail)) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid email address' }),
    };
  }

  const sourceIp = event.requestContext?.http?.sourceIp || 'unknown';
  const ipLimit = await checkRateLimit(sourceIp, 'demo-ip', 3);
  if (ipLimit) return { ...ipLimit, headers: { ...CORS, 'Content-Type': 'application/json' } };
  const rcptLimit = await checkRateLimit(recipientEmail, 'demo-rcpt', 2);
  if (rcptLimit) return { ...rcptLimit, headers: { ...CORS, 'Content-Type': 'application/json' } };

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Email service not configured' }),
    };
  }

  // ── Generate email via Bedrock ────────────────────────────────────────────
  const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'eu-west-2' });

  const prompt = `Write a short cold email from Ish, a developer based in Colchester who builds small automations for businesses.

Recipient: ${name}

Rules:
- If "${name}" looks like a person's name, greet them by first name
- If "${name}" looks like a business or organisation name, open with "Hi ${name} team,"
- 2-3 sentences max. Focus on saving time through automation — be genuine but don't assume their exact workflow
- Sound like a real person. No buzzwords like "streamline", "leverage", "synergy". No "I hope this finds you well". Don't mention AI in the first sentence
- End with one simple, low-pressure question

Format:
Subject: [short subject line, title case, no ALL CAPS, max 8 words]

[body]

Output only the email. No commentary.`;

  let emailText;
  try {
    const command = new InvokeModelCommand({
      modelId: process.env.BEDROCK_MODEL_ID || 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 400,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    emailText = responseBody.content[0].text;
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Generation failed' }),
    };
  }

  // ── Parse subject + body ──────────────────────────────────────────────────
  const lines = emailText.trim().split('\n');
  const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:'));
  const subject = subjectLine
    ? subjectLine.replace(/^subject:\s*/i, '').trim()
    : 'A quick note from Ish';
  const emailBody = lines
    .filter(l => !l.toLowerCase().startsWith('subject:'))
    .join('\n')
    .trim();

  // ── Send via Resend ───────────────────────────────────────────────────────
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Ish Sitotombe <outreach@ishsitotombe.co.uk>',
        to: [recipientEmail],
        subject,
        text: emailBody,
      }),
    });

    if (!res.ok) {
      console.error('Resend error:', await res.text());
      return {
        statusCode: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Send failed' }),
      };
    }
  } catch (e) {
    return {
      statusCode: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Send failed' }),
    };
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, emailText }),
  };
};
