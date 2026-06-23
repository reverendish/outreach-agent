import { auth } from '../../../auth';
import { callLambda, lambdaHeaders } from '../../lib/lambda';
import { safeResJson } from '../../lib/proxy';
import { NextRequest, NextResponse } from 'next/server';

const DRAFTS_URL = process.env.DRAFTS_LAMBDA_URL!;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const contactId = req.nextUrl.searchParams.get('contactId');
  const url = contactId ? `${DRAFTS_URL}?contactId=${contactId}` : DRAFTS_URL;
  const res = await callLambda(url, { method: 'GET', headers: lambdaHeaders(session.user.id) });
  const { data, status } = await safeResJson(res);
  return NextResponse.json(data, { status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const res = await callLambda(DRAFTS_URL, {
    method: 'POST', headers: lambdaHeaders(session.user.id), body: JSON.stringify(body),
  });
  const { data, status } = await safeResJson(res);
  return NextResponse.json(data, { status });
}
