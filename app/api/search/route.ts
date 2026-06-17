import { auth } from '../../../auth';
import { callLambda, lambdaHeaders } from '../../lib/lambda';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  const res = await callLambda(process.env.SEARCH_LAMBDA_URL!, {
    method: 'POST', headers: lambdaHeaders(session.user.id), body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
