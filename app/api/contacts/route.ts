import { auth } from '../../../auth';
import { callLambda, lambdaHeaders } from '../../lib/lambda';
import { NextRequest, NextResponse } from 'next/server';

const CRM_URL = process.env.CRM_LAMBDA_URL!;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const status = req.nextUrl.searchParams.get('status');
  const url = status ? `${CRM_URL}?status=${status}` : CRM_URL;
  const res = await callLambda(url, { method: 'GET', headers: lambdaHeaders(session.user.id) });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  const res = await callLambda(CRM_URL, {
    method: 'POST',
    headers: lambdaHeaders(session.user.id),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
