import { timingSafeEqual } from 'crypto';

const INTERNAL_KEY = process.env.INTERNAL_API_KEY;

export function checkInternalKey(event) {
  if (!INTERNAL_KEY) return false;
  const got = event.headers?.['x-internal-key'] || '';
  if (got.length !== INTERNAL_KEY.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(INTERNAL_KEY));
}
