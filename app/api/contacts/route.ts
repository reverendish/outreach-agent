import { auth } from '../../../auth';
import { callLambda, lambdaHeaders } from '../../lib/lambda';
import { safeResJson } from '../../lib/proxy';
import { NextRequest, NextResponse } from 'next/server';

const CRM_URL = process.env.CRM_LAMBDA_URL!;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const status = req.nextUrl.searchParams.get('status');
  const url = status ? `${CRM_URL}?status=${status}` : CRM_URL;
  const res = await callLambda(url, { method: 'GET', headers: lambdaHeaders(session.user.id) });
  const { data, status: s } = await safeResJson(res);
  return NextResponse.json(data, { status: s });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const res = await callLambda(CRM_URL, {
    method: 'POST', headers: lambdaHeaders(session.user.id), body: JSON.stringify(body),
  });
  const { data, status: s } = await safeResJson(res);
  return NextResponse.json(data, { status: s });
}
