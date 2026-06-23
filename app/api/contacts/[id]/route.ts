import { auth } from '../../../../auth';
import { callLambda, lambdaHeaders } from '../../../lib/lambda';
import { safeResJson } from '../../../lib/proxy';
import { NextRequest, NextResponse } from 'next/server';

const CRM_URL = process.env.CRM_LAMBDA_URL!;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const res = await callLambda(`${CRM_URL}/${params.id}`, { method: 'GET', headers: lambdaHeaders(session.user.id) });
  const { data, status } = await safeResJson(res);
  return NextResponse.json(data, { status });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const res = await callLambda(`${CRM_URL}/${params.id}`, {
    method: 'PATCH', headers: lambdaHeaders(session.user.id), body: JSON.stringify(body),
  });
  const { data, status } = await safeResJson(res);
  return NextResponse.json(data, { status });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const res = await callLambda(`${CRM_URL}/${params.id}`, { method: 'DELETE', headers: lambdaHeaders(session.user.id) });
  const { data, status } = await safeResJson(res);
  return NextResponse.json(data, { status });
}
