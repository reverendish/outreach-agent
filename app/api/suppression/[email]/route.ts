import { auth } from '../../../../auth';
import { callLambda, lambdaHeaders } from '../../../lib/lambda';
import { NextRequest, NextResponse } from 'next/server';

const SUPPRESSION_URL = process.env.SUPPRESSION_LAMBDA_URL!;

export async function DELETE(_req: NextRequest, { params }: { params: { email: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const res = await callLambda(`${SUPPRESSION_URL}/${params.email}`, {
    method: 'DELETE', headers: lambdaHeaders(session.user.id),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
