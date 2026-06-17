/**
 * Thin wrapper for calling Lambda function URLs from Next.js API routes.
 * Injects X-Internal-Key + X-User-Id so Lambdas can scope data by account
 * without needing to verify Google JWTs themselves.
 */
export function lambdaHeaders(userId: string) {
  return {
    'Content-Type': 'application/json',
    'X-Internal-Key': process.env.INTERNAL_API_KEY ?? '',
    'X-User-Id': userId,
  };
}

export async function callLambda(url: string, options: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(90_000) });
  return res;
}
