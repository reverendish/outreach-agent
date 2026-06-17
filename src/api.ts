/**
 * Typed API client for outreach-agent.
 * All calls go through Next.js API routes (BFF) which verify the session
 * and inject X-Internal-Key + X-User-Id before forwarding to Lambdas.
 */
import type { Contact, EmailDraft, Account, SuppressionEntry } from './types';

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Contacts ───────────────────────────────────────────────────────────────

export const contacts = {
  list: (params?: { status?: string }) =>
    req<Contact[]>('/api/contacts' + (params?.status ? `?status=${params.status}` : '')),

  get: (id: string) =>
    req<Contact>(`/api/contacts/${id}`),

  upsert: (contact: Partial<Contact> & { ch: Contact['ch'] }) =>
    req<Contact>('/api/contacts', { method: 'POST', body: JSON.stringify(contact) }),

  patch: (id: string, patch: Partial<Contact>) =>
    req<Contact>(`/api/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  delete: (id: string) =>
    req<void>(`/api/contacts/${id}`, { method: 'DELETE' }),
};

// ── Drafts ─────────────────────────────────────────────────────────────────

export const drafts = {
  list: (contactId?: string) =>
    req<EmailDraft[]>('/api/drafts' + (contactId ? `?contactId=${contactId}` : '')),

  get: (id: string) =>
    req<EmailDraft>(`/api/drafts/${id}`),

  create: (draft: Omit<EmailDraft, 'id' | 'accountId'>) =>
    req<EmailDraft>('/api/drafts', { method: 'POST', body: JSON.stringify(draft) }),

  patch: (id: string, patch: Partial<EmailDraft>) =>
    req<EmailDraft>(`/api/drafts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
};

// ── Account ────────────────────────────────────────────────────────────────

export const account = {
  get: () => req<Account>('/api/account'),
  update: (patch: Partial<Account>) =>
    req<Account>('/api/account', { method: 'PATCH', body: JSON.stringify(patch) }),
};

// ── Suppression ────────────────────────────────────────────────────────────

export const suppression = {
  list: () => req<SuppressionEntry[]>('/api/suppression'),
  add: (entry: Omit<SuppressionEntry, 'accountId' | 'optedOutAt'>) =>
    req<SuppressionEntry>('/api/suppression', { method: 'POST', body: JSON.stringify(entry) }),
  remove: (email: string) =>
    req<void>(`/api/suppression/${encodeURIComponent(email)}`, { method: 'DELETE' }),
};

// ── Search (CH) ────────────────────────────────────────────────────────────

export const search = {
  companies: (query: string) =>
    req<{ items: unknown[] }>('/api/search', { method: 'POST', body: JSON.stringify({ q: query }) }),
};

// ── Enrich ─────────────────────────────────────────────────────────────────

export const enrich = {
  run: (params: {
    companyNumber: string;
    companyName: string;
    website?: string;
    previousEnrichment?: unknown;
  }) => req<{ enrichment: unknown; changesSummary: string }>(
    '/api/enrich', { method: 'POST', body: JSON.stringify(params) }
  ),
};

// ── Generate ───────────────────────────────────────────────────────────────

export const generate = {
  draft: (params: {
    contact: Partial<Contact>;
    enrichment: unknown;
    isFollowup?: boolean;
    followupNumber?: number;
    previousEmails?: string[];
  }) => req<{ subject: string; body: string }>(
    '/api/generate', { method: 'POST', body: JSON.stringify(params) }
  ),
};

// ── Send ───────────────────────────────────────────────────────────────────

export const send = {
  email: (params: {
    draftId: string;
    recipientEmail: string;
    recipientName: string;
  }) => req<{ messageId: string; provider: string }>(
    '/api/send', { method: 'POST', body: JSON.stringify(params) }
  ),
};
