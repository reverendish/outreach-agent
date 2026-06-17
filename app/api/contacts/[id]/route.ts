import { auth } from '../../../../auth';
import { callLambda, lambdaHeaders } from '../../../lib/lambda';
import { NextRequest, NextResponse } from 'next/server';

const CRM_URL = process.env.CRM_LAMBDA_URL!;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const res = await callLambda(`${CRM_URL}/${params.id}`, { method: 'GET', headers: lambdaHeaders(session.user.id) });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const body = await req.json();
  const res = await callLambda(`${CRM_URL}/${params.id}`, {
    method: 'PATCH', headers: lambdaHeaders(session.user.id), body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const res = await callLambda(`${CRM_URL}/${params.id}`, { method: 'DELETE', headers: lambdaHeaders(session.user.id) });
  return NextResponse.json(await res.json(), { status: res.status });
}
