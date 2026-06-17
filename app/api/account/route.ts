import { auth } from '../../../auth';
import { callLambda, lambdaHeaders } from '../../lib/lambda';
import { NextRequest, NextResponse } from 'next/server';

const URL = process.env.ACCOUNT_LAMBDA_URL!;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  // Seed user info from Google so Lambda can create account on first visit
  const res = await callLambda(URL, {
    method: 'GET',
    headers: {
      ...lambdaHeaders(session.user.id),
      'X-User-Email': session.user.email ?? '',
      'X-User-Name': session.user.name ?? '',
    },
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  const res = await callLambda(URL, {
    method: 'PATCH', headers: lambdaHeaders(session.user.id), body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
