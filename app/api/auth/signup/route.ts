import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcryptjs';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-2' }));
const USERS_TABLE = process.env.USERS_TABLE!;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; name?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim() ?? '';
  const password = body.password ?? '';
  const name = body.name?.trim() ?? '';

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  // Check for existing user
  const existing = await db.send(new GetCommand({ TableName: USERS_TABLE, Key: { email } }));
  if (existing.Item) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();

  await db.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: { id, email, passwordHash, name: name || null, createdAt: now, updatedAt: now },
  }));

  return NextResponse.json({ id, email, name: name || null }, { status: 201 });
}
