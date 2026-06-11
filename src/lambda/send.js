/**
 * send Lambda — sends a real outreach email via Resend, then updates
 * the prospect's CRM record in DynamoDB.
 *
 * POST /send
 * Body: { companyNumber, recipientEmail, subject, body }
 * Auth: Bearer <OUTREACH_API_KEY>
 *
 * On success:
 *   - Sends email from outreach@ishsitotombe.co.uk via Resend
 *   - Updates CRM: status → 'contacted', lastEmailAt, emailsSent++
 *   - Returns { success: true, emailId }
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const USER_ID = 'ish';
const TABLE   = process.env.PROSPECTS_TABLE;
const dbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const ALLOWED_ORIGINS = new Set([
  'https://outreach.ishsitotombe.co.uk',
  'https://ishsitotombe.co.uk',
  'https://www.ishsitotombe.co.uk',
  'http://localhost:3000',
]);

function cors(requestOrigin) {
  const origin = ALLOWED_ORIGINS.has(requestOrigin)
    ? requestOrigin
    : 'https://outreach.ishsitotombe.co.uk';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function json(statusCode, body, origin = '') {
  return {
    statusCode,
    headers: { ...cors(origin), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const method = event.requestContext?.http?.method || 'POST';

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: cors(origin), body: '' };
  }

  // Auth
  const expected = process.env.OUTREACH_API_KEY;
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (!expected || auth !== `Bearer ${expected}`) {
    return json(401, { error: 'Unauthorised' }, origin);
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return json(500, { error: 'Email service not configured' }, origin);
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return json(400, { error: 'Invalid JSON' }, origin);
  }

  const { companyNumber, recipientEmail, subject, body: emailBody } = body;

  if (!companyNumber || !recipientEmail || !subject || !emailBody) {
    return json(400, { error: 'companyNumber, recipientEmail, subject, and body are required' }, origin);
  }

  if (!EMAIL_RE.test(recipientEmail)) {
    return json(400, { error: 'Invalid email address' }, origin);
  }

  // ── Send via Resend ───────────────────────────────────────────────────────
  let emailId;
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
      const errText = await res.text();
      return json(502, { error: 'Send failed', details: errText }, origin);
    }

    const resData = await res.json();
    emailId = resData.id;
  } catch (e) {
    return json(502, { error: 'Send failed', details: e.message }, origin);
  }

  // ── Update CRM record ─────────────────────────────────────────────────────
  try {
    // Get current emailsSent count
    const existing = await dbClient.send(new GetCommand({
      TableName: TABLE,
      Key: { userId: USER_ID, companyNumber },
    }));

    const currentCount = existing.Item?.emailsSent || 0;
    const now = new Date().toISOString();

    await dbClient.send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId: USER_ID, companyNumber },
      UpdateExpression: 'SET #status = :status, lastEmailAt = :now, emailsSent = :count, contactedAt = :contactedAt, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'contacted',
        ':now': now,
        ':count': currentCount + 1,
        ':contactedAt': existing.Item?.contactedAt === 'NONE' ? now : (existing.Item?.contactedAt || now),
      },
      ConditionExpression: 'attribute_exists(userId)',
    }));
  } catch (e) {
    // CRM update failure is non-fatal — email was already sent
    console.error('CRM update failed:', e.message);
  }

  return json(200, { success: true, emailId }, origin);
};
