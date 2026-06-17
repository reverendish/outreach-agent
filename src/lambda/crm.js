/**
 * CRM Lambda — DynamoDB-backed contact store, multi-tenant.
 *
 * Auth: X-Internal-Key (verified against INTERNAL_API_KEY env var) +
 *       X-User-Id (the authenticated Google sub, injected by Next.js BFF).
 *
 * Routes (path relative to function URL):
 *   GET    /              → list contacts for userId
 *   GET    /?status=x     → filter by status
 *   GET    /:id           → get single contact
 *   POST   /              → upsert contact
 *   PATCH  /:id           → partial update
 *   DELETE /:id           → remove contact
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, PutCommand, QueryCommand,
  UpdateCommand, DeleteCommand, GetCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE  = process.env.CONTACTS_TABLE;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Internal-Key, X-User-Id',
};

function json(status, body) {
  return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function checkInternalKey(event) {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) return false;
  return event.headers?.['x-internal-key'] === expected;
}

function getUserId(event) {
  return event.headers?.['x-user-id'] || null;
}

// Fields allowed in a PATCH (prevents overwriting keys)
const PATCHABLE = new Set([
  'status', 'starred', 'tags', 'directors', 'enrichment',
  'enrichmentError', 'latestDraftId', 'notes', 'suppressedEmails',
  'lastEnrichedAt', 'updatedAt',
]);

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  if (!checkInternalKey(event)) return json(401, { error: 'Unauthorised' });
  const userId = getUserId(event);
  if (!userId) return json(401, { error: 'Missing X-User-Id' });

  const contactId = event.pathParameters?.id || null;
  const now = new Date().toISOString();

  try {
    // ── GET / (list) ──────────────────────────────────────────────────────────
    if (method === 'GET' && !contactId) {
      const statusFilter = event.queryStringParameters?.status || null;
      let result;
      if (statusFilter) {
        result = await client.send(new QueryCommand({
          TableName: TABLE,
          IndexName: 'ByStatus',
          KeyConditionExpression: 'accountId = :uid AND #s = :status',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':uid': userId, ':status': statusFilter },
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

    // ── GET /:id (single) ─────────────────────────────────────────────────────
    if (method === 'GET' && contactId) {
      const result = await client.send(new GetCommand({
        TableName: TABLE,
        Key: { accountId: userId, id: contactId },
      }));
      if (!result.Item) return json(404, { error: 'Not found' });
      return json(200, result.Item);
    }

    // ── POST / (upsert) ───────────────────────────────────────────────────────
    if (method === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return json(400, { error: 'Invalid JSON' });
      }

      const id = body.id || crypto.randomUUID();
      const existing = await client.send(new GetCommand({
        TableName: TABLE, Key: { accountId: userId, id },
      }));

      const item = {
        ...body,
        id,
        accountId: userId,
        status: body.status || 'new',
        starred: body.starred ?? false,
        tags: body.tags || [],
        directors: body.directors || [],
        enrichment: body.enrichment || null,
        latestDraftId: body.latestDraftId || null,
        notes: body.notes || [],
        suppressedEmails: body.suppressedEmails || [],
        createdAt: existing.Item?.createdAt || now,
        updatedAt: now,
        lastEnrichedAt: body.lastEnrichedAt || null,
      };

      await client.send(new PutCommand({ TableName: TABLE, Item: item }));
      return json(200, item);
    }

    // ── PATCH /:id ────────────────────────────────────────────────────────────
    if (method === 'PATCH' && contactId) {
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
        Key: { accountId: userId, id: contactId },
        UpdateExpression: `SET ${setExprs.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: 'attribute_exists(accountId)',
        ReturnValues: 'ALL_NEW',
      }));
      return json(200, result.Attributes);
    }

    // ── DELETE /:id ───────────────────────────────────────────────────────────
    if (method === 'DELETE' && contactId) {
      await client.send(new DeleteCommand({
        TableName: TABLE, Key: { accountId: userId, id: contactId },
      }));
      return json(200, { deleted: contactId });
    }

    return json(404, { error: 'Not found' });

  } catch (e) {
    console.error('CRM error:', e);
    if (e.name === 'ConditionalCheckFailedException') return json(404, { error: 'Not found' });
    return json(500, { error: 'Internal server error', details: e.message });
  }
};
