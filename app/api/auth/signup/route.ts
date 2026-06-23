import { NextRequest, NextResponse } from 'next/server';

// Public self-service signup is disabled — this app now has a single allowed
// user, enforced via the signIn callback in auth.ts (ALLOWED_USER_EMAILS).
// Account creation is no longer available through this route.
export async function POST(_req: NextRequest) {
  return NextResponse.json({ error: 'Sign-up is closed.' }, { status: 403 });
}
