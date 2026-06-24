/**
 * Account Lambda — per-user account settings, auto-created on first GET.
 *
 * Routes:
 *   GET    /  → get account (creates if missing using X-User-Email + X-User-Name)
 *   PATCH  /  → update account settings
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { checkInternalKey } from './auth.js';
import { corsHeaders } from './cors.js';

const TABLE  = process.env.ACCOUNTS_TABLE;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

let CORS;

function json(status, body) {
  return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function checkAuth(event) {
  return checkInternalKey(event);
}

const PATCHABLE = new Set([
  'sending', 'automation', 'displayName', 'replyToEmail',
]);

export const handler = async (event) => {
  CORS = corsHeaders(event);
  const method = event.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  if (!checkAuth(event)) return json(401, { error: 'Unauthorised' });
  const userId = event.headers?.['x-user-id'];
  if (!userId) return json(401, { error: 'Missing X-User-Id' });

  const now = new Date().toISOString();

  try {
    if (method === 'GET') {
      const { Item } = await client.send(new GetCommand({ TableName: TABLE, Key: { id: userId } }));
      if (Item) return json(200, Item);

      // First visit — create account from Google profile info
      const email = event.headers?.['x-user-email'] || '';
      const name  = event.headers?.['x-user-name']  || '';
      const account = {
        id: userId,
        displayName: name,
        replyToEmail: email,
        sending: { provider: 'ses', fromAddress: '', fromName: name },
        automation: {
          autoEnrich: false,
          autoGenerate: false,
          autoSend: false,
          trustRampCount: 0,
          manualReviewRequired: true,
        },
        createdAt: now,
        updatedAt: now,
      };
      await client.send(new PutCommand({ TableName: TABLE, Item: account }));
      return json(200, account);
    }

    if (method === 'PATCH') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return json(400, { error: 'Invalid JSON' });
      }

      const updates = Object.keys(body).filter(k => PATCHABLE.has(k));
      if (updates.length === 0) return json(400, { error: 'No patchable fields' });

      const setExprs = [...updates.map((k, i) => `#f${i} = :v${i}`), '#ua = :ua'];
      const names = { '#ua': 'updatedAt' };
      const values = { ':ua': now };
      updates.forEach((k, i) => { names[`#f${i}`] = k; values[`:v${i}`] = body[k]; });

      const result = await client.send(new UpdateCommand({
        TableName: TABLE,
        Key: { id: userId },
        UpdateExpression: `SET ${setExprs.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: 'attribute_exists(id)',
        ReturnValues: 'ALL_NEW',
      }));
      return json(200, result.Attributes);
    }

    return json(404, { error: 'Not found' });

  } catch (e) {
    console.error('Account error:', e);
    if (e.name === 'ConditionalCheckFailedException') return json(404, { error: 'Account not found' });
    return json(500, { error: 'Internal server error' });
  }
};
