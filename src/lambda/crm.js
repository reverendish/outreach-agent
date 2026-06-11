/**
 * CRM Lambda — DynamoDB-backed prospect store.
 *
 * Routes:
 *   GET    /api/crm                    → list all prospects for userId
 *   GET    /api/crm?status=contacted   → filter by status
 *   POST   /api/crm                    → upsert prospect
 *   PATCH  /api/crm/:companyNumber     → update status / notes / fields
 *   DELETE /api/crm/:companyNumber     → remove prospect
 *
 * Auth: Bearer token from SSM /outreach/api_key, checked against OUTREACH_API_KEY env var.
 * userId is hardcoded as 'ish' — the single-tenant key. Ready to become the
 * decoded user sub when multi-tenant auth is added.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';

const USER_ID = 'ish';
const TABLE   = process.env.PROSPECTS_TABLE;
const client  = DynamoDBDocumentClient.from(new DynamoDBClient({}));

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
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function json(statusCode, body, requestOrigin = '') {
  return {
    statusCode,
    headers: { ...cors(requestOrigin), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function checkAuth(event) {
  const expected = process.env.OUTREACH_API_KEY;
  if (!expected) return false; // no key configured — deny
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  return auth === `Bearer ${expected}`;
}

export const handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const method = event.requestContext?.http?.method || 'GET';

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: cors(origin), body: '' };
  }

  if (!checkAuth(event)) {
    return json(401, { error: 'Unauthorised' }, origin);
  }

  const path          = event.rawPath || '';
  const companyNumber = event.pathParameters?.companyNumber || null;

  try {
    // ── GET /api/crm ─────────────────────────────────────────────────────────
    if (method === 'GET' && !companyNumber) {
      const statusFilter = event.queryStringParameters?.status || null;

      let result;
      if (statusFilter) {
        result = await client.send(new QueryCommand({
          TableName: TABLE,
          IndexName: 'ByStatus',
          KeyConditionExpression: 'userId = :uid AND #s = :status',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':uid': USER_ID, ':status': statusFilter },
        }));
      } else {
        result = await client.send(new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: 'userId = :uid',
          ExpressionAttributeValues: { ':uid': USER_ID },
        }));
      }

      return json(200, { prospects: result.Items || [] }, origin);
    }

    // ── POST /api/crm — upsert ───────────────────────────────────────────────
    if (method === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return json(400, { error: 'Invalid JSON' }, origin);
      }

      const { companyNumber: cn, companyName, chData } = body;
      if (!cn) return json(400, { error: 'companyNumber required' }, origin);

      const now = new Date().toISOString();

      // Check if already exists to preserve createdAt
      const existing = await client.send(new GetCommand({
        TableName: TABLE,
        Key: { userId: USER_ID, companyNumber: cn },
      }));

      const item = {
        userId: USER_ID,
        companyNumber: cn,
        companyName: companyName || '',
        status: body.status || 'new',
        notes: body.notes || '',
        contactedAt: body.contactedAt || 'NONE',  // 'NONE' makes GSI sort work for uncontacted
        lastEmailAt: body.lastEmailAt || null,
        emailsSent: body.emailsSent || 0,
        replyStatus: body.replyStatus || 'none',
        chData: chData || null,
        enrichment: body.enrichment || null,
        createdAt: existing.Item?.createdAt || now,
        updatedAt: now,
      };

      await client.send(new PutCommand({ TableName: TABLE, Item: item }));
      return json(200, { prospect: item }, origin);
    }

    // ── PATCH /api/crm/:companyNumber ────────────────────────────────────────
    if (method === 'PATCH' && companyNumber) {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return json(400, { error: 'Invalid JSON' }, origin);
      }

      // Build UpdateExpression dynamically from allowed fields
      const ALLOWED = ['status', 'notes', 'contactedAt', 'lastEmailAt', 'emailsSent', 'replyStatus', 'enrichment', 'chData', 'companyName'];
      const updates = Object.keys(body).filter(k => ALLOWED.includes(k));

      if (updates.length === 0) {
        return json(400, { error: 'No valid fields to update' }, origin);
      }

      const now = new Date().toISOString();
      const setExprs = updates.map((k, i) => `#f${i} = :v${i}`);
      setExprs.push('#updatedAt = :updatedAt');

      const exprNames = {};
      const exprValues = { ':updatedAt': now };
      updates.forEach((k, i) => {
        exprNames[`#f${i}`] = k;
        exprValues[`:v${i}`] = body[k];
      });
      exprNames['#updatedAt'] = 'updatedAt';

      const result = await client.send(new UpdateCommand({
        TableName: TABLE,
        Key: { userId: USER_ID, companyNumber },
        UpdateExpression: `SET ${setExprs.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ConditionExpression: 'attribute_exists(userId)',
        ReturnValues: 'ALL_NEW',
      }));

      return json(200, { prospect: result.Attributes }, origin);
    }

    // ── DELETE /api/crm/:companyNumber ────────────────────────────────────────
    if (method === 'DELETE' && companyNumber) {
      await client.send(new DeleteCommand({
        TableName: TABLE,
        Key: { userId: USER_ID, companyNumber },
      }));
      return json(200, { deleted: companyNumber }, origin);
    }

    return json(404, { error: 'Not found' }, origin);

  } catch (e) {
    console.error('CRM error:', e);
    return json(500, { error: 'Internal server error', details: e.message }, origin);
  }
};
