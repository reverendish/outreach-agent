/**
 * API client — wraps all Lambda calls.
 * Reads NEXT_PUBLIC_LAMBDA_BASE and NEXT_PUBLIC_OUTREACH_API_KEY from env.
 */

const BASE = (process.env.NEXT_PUBLIC_LAMBDA_BASE || '').replace(/\/$/, '');
const KEY  = process.env.NEXT_PUBLIC_OUTREACH_API_KEY || '';

function authHeaders(method = 'POST'): HeadersInit {
  const h: Record<string, string> = { 'Authorization': `Bearer ${KEY}` };
  if (method !== 'GET' && method !== 'DELETE') h['Content-Type'] = 'application/json';
  return h;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(method), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ── Prospect shape ──────────────────────────────────────────────────────────

export type ProspectStatus = 'new' | 'contacted' | 'replied' | 'converted' | 'archived';
export type ReplyStatus    = 'none' | 'positive' | 'negative';

export interface Prospect {
  userId: string;
  companyNumber: string;
  companyName: string;
  status: ProspectStatus;
  notes: string;
  contactedAt: string;    // ISO or 'NONE'
  lastEmailAt: string | null;
  emailsSent: number;
  replyStatus: ReplyStatus;
  chData: CHData | null;
  enrichment: null;
  createdAt: string;
  updatedAt: string;
}

export interface CHData {
  name: string;
  number: string;
  type: string;
  incorporated: string;
  address: string;
  sic: string;
}

// ── CRM ─────────────────────────────────────────────────────────────────────

export const crmApi = {
  list: (status?: string): Promise<{ prospects: Prospect[] }> =>
    req(`/api/crm${status ? `?status=${encodeURIComponent(status)}` : ''}`),

  upsert: (data: Partial<Prospect> & { companyNumber: string }): Promise<{ prospect: Prospect }> =>
    req('/api/crm', { method: 'POST', body: JSON.stringify(data) }),

  update: (companyNumber: string, patch: Partial<Prospect>): Promise<{ prospect: Prospect }> =>
    req(`/api/crm/${encodeURIComponent(companyNumber)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  delete: (companyNumber: string): Promise<{ deleted: string }> =>
    req(`/api/crm/${encodeURIComponent(companyNumber)}`, { method: 'DELETE' }),
};

// ── CH Search ────────────────────────────────────────────────────────────────

export interface CHCompany {
  name: string;
  number: string;
  type: string;
  incorporated: string;
  address: string;
  sic: string;
}

export async function searchCompanies(query: string): Promise<{ companies: CHCompany[] }> {
  // search.js doesn't require auth, but we include auth anyway (ignored server-side)
  return req(`/search?q=${encodeURIComponent(query)}`, { method: 'GET' });
}

// ── Generate email (Bedrock) ─────────────────────────────────────────────────

export interface GenerateParams {
  name: string;       // director / contact name
  business: string;   // company description
  context: string;    // extra notes
}

export async function generateEmail(params: GenerateParams): Promise<{ result: string }> {
  return req('/generate', { method: 'POST', body: JSON.stringify(params) });
}

// ── Send email ────────────────────────────────────────────────────────────────

export interface SendParams {
  companyNumber: string;
  recipientEmail: string;
  subject: string;
  body: string;
}

export async function sendEmail(params: SendParams): Promise<{ success: boolean; emailId: string }> {
  return req('/send', { method: 'POST', body: JSON.stringify(params) });
}
