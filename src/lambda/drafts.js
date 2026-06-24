/**
 * Drafts Lambda — email draft store, per-user, per-contact.
 *
 * Routes:
 *   GET    /              → list drafts for user (optionally ?contactId=xxx)
 *   GET    /:id           → get single draft
 *   POST   /              → create draft
 *   PATCH  /:id           → update draft (subject, body, status)
 *   DELETE /:id           → delete draft
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, PutCommand, QueryCommand,
  UpdateCommand, DeleteCommand, GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { checkInternalKey } from './auth.js';
import { corsHeaders } from './cors.js';

const TABLE  = process.env.DRAFTS_TABLE;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

let CORS;

function json(status, body) {
  return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function checkAuth(event) {
  return checkInternalKey(event);
}

const PATCHABLE = new Set(['subject', 'body', 'status', 'sentAt', 'provider', 'error']);

export const handler = async (event) => {
  CORS = corsHeaders(event);
  const method = event.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  if (!checkAuth(event)) return json(401, { error: 'Unauthorised' });
  const userId = event.headers?.['x-user-id'];
  if (!userId) return json(401, { error: 'Missing X-User-Id' });

  const draftId = event.pathParameters?.id || null;
  const now = new Date().toISOString();

  try {
    // ── GET / (list) ──────────────────────────────────────────────────────────
    if (method === 'GET' && !draftId) {
      const contactId = event.queryStringParameters?.contactId || null;
      let result;
      if (contactId) {
        result = await client.send(new QueryCommand({
          TableName: TABLE,
          IndexName: 'ByContact',
          KeyConditionExpression: 'accountId = :uid AND contactId = :cid',
          ExpressionAttributeValues: { ':uid': userId, ':cid': contactId },
        }));
      } else {
        result = await client.send(new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: 'accountId = :uid',
          ExpressionAttributeValues: { ':uid': userId },
        }));
      }
      return json(200, result.Items || []);
    }

    // ── GET /:id ──────────────────────────────────────────────────────────────
    if (method === 'GET' && draftId) {
      const { Item } = await client.send(new GetCommand({
        TableName: TABLE, Key: { accountId: userId, id: draftId },
      }));
      if (!Item) return json(404, { error: 'Not found' });
      return json(200, Item);
    }

    // ── POST / (create) ───────────────────────────────────────────────────────
    if (method === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return json(400, { error: 'Invalid JSON' });
      }
      if (!body.contactId) return json(400, { error: 'contactId required' });

      const item = {
        id: body.id || crypto.randomUUID(),
        accountId: userId,
        contactId: body.contactId,
        subject: body.subject || '',
        body: body.body || '',
        status: body.status || 'draft',
        isFollowup: body.isFollowup ?? false,
        followupNumber: body.followupNumber ?? 0,
        provider: body.provider || null,
        sentAt: body.sentAt || null,
        error: body.error || null,
        createdAt: now,
        updatedAt: now,
      };

      await client.send(new PutCommand({ TableName: TABLE, Item: item }));
      return json(200, item);
    }

    // ── PATCH /:id ────────────────────────────────────────────────────────────
    if (method === 'PATCH' && draftId) {
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
        Key: { accountId: userId, id: draftId },
        UpdateExpression: `SET ${setExprs.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: 'attribute_exists(accountId)',
        ReturnValues: 'ALL_NEW',
      }));
      return json(200, result.Attributes);
    }

    // ── DELETE /:id ───────────────────────────────────────────────────────────
    if (method === 'DELETE' && draftId) {
      await client.send(new DeleteCommand({
        TableName: TABLE, Key: { accountId: userId, id: draftId },
      }));
      return json(200, { deleted: draftId });
    }

    return json(404, { error: 'Not found' });

  } catch (e) {
    console.error('Drafts error:', e);
    if (e.name === 'ConditionalCheckFailedException') return json(404, { error: 'Not found' });
    return json(500, { error: 'Internal server error' });
  }
};
