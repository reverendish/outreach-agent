import { auth } from '../../../auth';
import { callLambda, lambdaHeaders } from '../../lib/lambda';
import { safeResJson } from '../../lib/proxy';
import { NextRequest, NextResponse } from 'next/server';

const URL = process.env.ACCOUNT_LAMBDA_URL!;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const res = await callLambda(URL, {
    method: 'GET',
    headers: {
      ...lambdaHeaders(session.user.id),
      'X-User-Email': session.user.email ?? '',
      'X-User-Name': session.user.name ?? '',
    },
  });
  const { data, status } = await safeResJson(res);
  return NextResponse.json(data, { status });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const res = await callLambda(URL, {
    method: 'PATCH', headers: lambdaHeaders(session.user.id), body: JSON.stringify(body),
  });
  const { data, status } = await safeResJson(res);
  return NextResponse.json(data, { status });
}
