import { auth } from '../../auth';
import { callLambda, lambdaHeaders } from './lambda';
import { NextRequest, NextResponse } from 'next/server';

async function safeResJson(res: Response) {
  const text = await res.text();
  try {
    return { data: JSON.parse(text), status: res.status };
  } catch {
    return { data: { error: 'Upstream error' }, status: res.status >= 400 ? res.status : 502 };
  }
}

export function proxyPost(urlEnv: string) {
  return async (req: NextRequest) => {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const url = process.env[urlEnv];
    if (!url) return NextResponse.json({ error: 'Misconfigured' }, { status: 500 });
    let body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const res = await callLambda(url, {
      method: 'POST', headers: lambdaHeaders(session.user.id), body: JSON.stringify(body),
    });
    const { data, status } = await safeResJson(res);
    return NextResponse.json(data, { status });
  };
}

export function proxyGet(urlEnv: string) {
  return async () => {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const url = process.env[urlEnv];
    if (!url) return NextResponse.json({ error: 'Misconfigured' }, { status: 500 });
    const res = await callLambda(url, { method: 'GET', headers: lambdaHeaders(session.user.id) });
    const { data, status } = await safeResJson(res);
    return NextResponse.json(data, { status });
  };
}

export { safeResJson };
