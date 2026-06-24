/**
 * Suppression Lambda — per-account opt-out list.
 *
 * Routes:
 *   GET    /        → list suppressed emails for user
 *   POST   /        → add email to suppression list
 *   DELETE /:email  → remove email (manual removal only)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { checkInternalKey } from './auth.js';
import { corsHeaders } from './cors.js';

const TABLE  = process.env.SUPPRESSION_TABLE;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

let CORS;

function json(status, body) {
  return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function checkAuth(event) {
  return checkInternalKey(event);
}

export const handler = async (event) => {
  CORS = corsHeaders(event);
  const method = event.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  if (!checkAuth(event)) return json(401, { error: 'Unauthorised' });
  const userId = event.headers?.['x-user-id'];
  if (!userId) return json(401, { error: 'Missing X-User-Id' });

  const email = event.pathParameters?.email
    ? decodeURIComponent(event.pathParameters.email)
    : null;
  const now = new Date().toISOString();

  try {
    if (method === 'GET') {
      const result = await client.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'accountId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
      }));
      return json(200, result.Items || []);
    }

    if (method === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return json(400, { error: 'Invalid JSON' });
      }
      if (!body.email) return json(400, { error: 'email required' });

      const item = {
        accountId: userId,
        email: body.email.toLowerCase(),
        optedOutAt: now,
        source: body.source || 'manual',
        contactId: body.contactId || null,
        companyName: body.companyName || null,
      };
      await client.send(new PutCommand({ TableName: TABLE, Item: item }));
      return json(200, item);
    }

    if (method === 'DELETE' && email) {
      await client.send(new DeleteCommand({
        TableName: TABLE,
        Key: { accountId: userId, email: email.toLowerCase() },
      }));
      return json(200, { deleted: email });
    }

    return json(404, { error: 'Not found' });

  } catch (e) {
    console.error('Suppression error:', e);
    return json(500, { error: 'Internal server error' });
  }
};
