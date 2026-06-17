import { auth } from '../../../auth';
import { callLambda, lambdaHeaders } from '../../lib/lambda';
import { NextRequest, NextResponse } from 'next/server';

const DRAFTS_URL = process.env.DRAFTS_LAMBDA_URL!;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const contactId = req.nextUrl.searchParams.get('contactId');
  const url = contactId ? `${DRAFTS_URL}?contactId=${contactId}` : DRAFTS_URL;
  const res = await callLambda(url, { method: 'GET', headers: lambdaHeaders(session.user.id) });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  const res = await callLambda(DRAFTS_URL, {
    method: 'POST', headers: lambdaHeaders(session.user.id), body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
