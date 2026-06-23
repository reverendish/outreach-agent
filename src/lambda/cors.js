const ALLOWED = new Set([
  'https://outreach.ishsitotombe.co.uk',
  'https://ishsitotombe.co.uk',
  'https://www.ishsitotombe.co.uk',
  'http://localhost:3000',
]);

export function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED.has(origin) ? origin : 'https://outreach.ishsitotombe.co.uk',
    'Access-Control-Allow-Headers': 'Content-Type, X-Internal-Key, X-User-Id, X-User-Email, X-User-Name',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
}
