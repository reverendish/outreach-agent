import { auth } from '../../../../auth';
import { callLambda, lambdaHeaders } from '../../../lib/lambda';
import { NextRequest, NextResponse } from 'next/server';

const DRAFTS_URL = process.env.DRAFTS_LAMBDA_URL!;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  const res = await callLambda(`${DRAFTS_URL}/${params.id}`, {
    method: 'PATCH', headers: lambdaHeaders(session.user.id), body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
