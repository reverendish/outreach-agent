/**
 * Send Lambda — provider-agnostic email sending + CRM status update.
 *
 * POST /
 * Body: { contactId, draftId, recipientEmail, subject, body, provider? }
 *
 * Auth: X-Internal-Key + X-User-Id (injected by BFF)
 *
 * Provider precedence: SES → Resend → SMTP stub
 * Determined by which env vars are set (SES_FROM_EMAIL takes priority).
 *
 * On success:
 *   - Updates draft status → 'sent', sentAt, provider
 *   - Updates contact status → 'contacted', lastEmailAt, emailsSent++
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { checkInternalKey } from './auth.js';
import { corsHeaders } from './cors.js';
import { checkRateLimit } from './rate-limit.js';

const CONTACTS_TABLE = process.env.CONTACTS_TABLE;
const DRAFTS_TABLE   = process.env.DRAFTS_TABLE;
const dbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sesClient = new SESv2Client({ region: process.env.SES_REGION || 'eu-west-1' });

let CORS;

function json(status, body) {
  return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function checkAuth(event) {
  return checkInternalKey(event);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function sendViaSES(recipientEmail, subject, emailBody, fromEmail, fromName) {
  const command = new SendEmailCommand({
    FromEmailAddress: `${fromName} <${fromEmail}>`,
    Destination: { ToAddresses: [recipientEmail] },
    Content: {
      Simple: {
        Subject: { Data: subject },
        Body: { Text: { Data: emailBody } },
      },
    },
  });
  const result = await sesClient.send(command);
  return result.MessageId;
}

async function sendViaResend(recipientEmail, subject, emailBody, fromEmail, fromName) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error('RESEND_API_KEY not set');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [recipientEmail], subject, text: emailBody }),
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.id;
}

async function dispatchEmail(recipientEmail, subject, emailBody) {
  const sesFrom  = process.env.SES_FROM_EMAIL;
  const fromName = process.env.FROM_NAME || 'Ish Sitotombe';

  if (sesFrom) {
    const id = await sendViaSES(recipientEmail, subject, emailBody, sesFrom, fromName);
    return { provider: 'ses', messageId: id };
  }

  const resendFrom = process.env.RESEND_FROM_EMAIL || 'outreach@ishsitotombe.co.uk';
  const id = await sendViaResend(recipientEmail, subject, emailBody, resendFrom, fromName);
  return { provider: 'resend', messageId: id };
}

export const handler = async (event) => {
  CORS = corsHeaders(event);
  const method = event.requestContext?.http?.method || 'POST';
  if (method === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  if (!checkAuth(event)) return json(401, { error: 'Unauthorised' });
  const userId = event.headers?.['x-user-id'];
  if (!userId) return json(401, { error: 'Missing X-User-Id' });

  const limited = await checkRateLimit(userId, 'send', 30);
  if (limited) return { ...limited, headers: CORS };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const { contactId, draftId, recipientEmail, subject, body: emailBody } = body;
  if (!contactId || !recipientEmail || !subject || !emailBody) {
    return json(400, { error: 'contactId, recipientEmail, subject, body are required' });
  }
  if (!EMAIL_RE.test(recipientEmail)) return json(400, { error: 'Invalid email address' });

  // Check suppression list via the contact record
  if (contactId) {
    const { Item } = await dbClient.send(new GetCommand({
      TableName: CONTACTS_TABLE,
      Key: { accountId: userId, id: contactId },
    }));
    if (Item?.suppressedEmails?.includes(recipientEmail)) {
      return json(422, { error: 'Recipient is suppressed', suppressed: true });
    }
  }

  const now = new Date().toISOString();
  let sendResult;
  try {
    sendResult = await dispatchEmail(recipientEmail, subject, emailBody);
  } catch (e) {
    console.error('Send error:', e);
    // Update draft with error status
    if (draftId) {
      await dbClient.send(new UpdateCommand({
        TableName: DRAFTS_TABLE,
        Key: { accountId: userId, id: draftId },
        UpdateExpression: 'SET #s = :s, #err = :err, updatedAt = :now',
        ExpressionAttributeNames: { '#s': 'status', '#err': 'error' },
        ExpressionAttributeValues: { ':s': 'error', ':err': e.message, ':now': now },
      })).catch(() => {});
    }
    return json(502, { error: 'Send failed', details: e.message });
  }

  // ── Update draft → sent ───────────────────────────────────────────────────
  if (draftId) {
    await dbClient.send(new UpdateCommand({
      TableName: DRAFTS_TABLE,
      Key: { accountId: userId, id: draftId },
      UpdateExpression: 'SET #s = :s, sentAt = :now, provider = :p, updatedAt = :now',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': 'sent', ':now': now, ':p': sendResult.provider },
    })).catch(e => console.error('Draft update failed:', e.message));
  }

  // ── Update contact → contacted ────────────────────────────────────────────
  if (contactId) {
    const { Item } = await dbClient.send(new GetCommand({
      TableName: CONTACTS_TABLE,
      Key: { accountId: userId, id: contactId },
    })).catch(() => ({ Item: null }));

    const emailsSent = (Item?.emailsSent || 0) + 1;
    await dbClient.send(new UpdateCommand({
      TableName: CONTACTS_TABLE,
      Key: { accountId: userId, id: contactId },
      UpdateExpression: 'SET #s = :s, lastEmailAt = :now, emailsSent = :count, contactedAt = if_not_exists(contactedAt, :now), updatedAt = :now',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': 'contacted', ':now': now, ':count': emailsSent },
    })).catch(e => console.error('Contact update failed:', e.message));
  }

  return json(200, { success: true, messageId: sendResult.messageId, provider: sendResult.provider });
};
