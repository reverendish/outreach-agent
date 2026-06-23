import { proxyGet, proxyPost } from '../../lib/proxy';

export const GET = proxyGet('SUPPRESSION_LAMBDA_URL');
export const POST = proxyPost('SUPPRESSION_LAMBDA_URL');
