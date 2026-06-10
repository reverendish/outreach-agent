import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock fetch (global) before importing the module ──────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

const { handler } = await import('../search.js');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeEvent(method, overrides = {}) {
  return {
    requestContext: { http: { method } },
    queryStringParameters: {},
    body: null,
    ...overrides,
  };
}

function mockChResponse(items, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    json: async () => ({ items }),
  });
}

const ACTIVE_COMPANY = {
  title: 'Acme Ltd',
  company_number: '12345678',
  company_type: 'ltd',
  company_status: 'active',
  date_of_creation: '2015-01-01',
  address: { address_line_1: '1 High St', locality: 'London', postal_code: 'EC1A 1BB' },
  description: '62012 - Business and domestic software development',
};

beforeEach(() => {
  mockFetch.mockReset();
  process.env.COMPANIES_HOUSE_API_KEY = 'test-api-key';
});

// ── CORS preflight ────────────────────────────────────────────────────────────
describe('OPTIONS preflight', () => {
  it('returns 200 with CORS headers', async () => {
    const res = await handler(makeEvent('OPTIONS'));
    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(res.body).toBe('');
  });
});

// ── Input validation ──────────────────────────────────────────────────────────
describe('input validation', () => {
  it('returns 400 when query is missing (GET)', async () => {
    const res = await handler(makeEvent('GET', { queryStringParameters: {} }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/query/i);
  });

  it('returns 400 when body has no query (POST)', async () => {
    const res = await handler(makeEvent('POST', { body: JSON.stringify({}) }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 500 when API key is not set', async () => {
    delete process.env.COMPANIES_HOUSE_API_KEY;
    const res = await handler(makeEvent('GET', { queryStringParameters: { q: 'acme' } }));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/API key/i);
  });
});

// ── Successful search ─────────────────────────────────────────────────────────
describe('successful search', () => {
  it('returns mapped companies from GET request', async () => {
    mockChResponse([ACTIVE_COMPANY]);
    const res = await handler(makeEvent('GET', { queryStringParameters: { q: 'acme' } }));
    expect(res.statusCode).toBe(200);
    const { companies } = JSON.parse(res.body);
    expect(companies).toHaveLength(1);
    expect(companies[0]).toMatchObject({
      name: 'Acme Ltd',
      number: '12345678',
      type: 'ltd',
      incorporated: '2015-01-01',
    });
  });

  it('returns mapped companies from POST request', async () => {
    mockChResponse([ACTIVE_COMPANY]);
    const res = await handler(makeEvent('POST', { body: JSON.stringify({ query: 'acme' }) }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).companies).toHaveLength(1);
  });

  it('formats address correctly', async () => {
    mockChResponse([ACTIVE_COMPANY]);
    const res = await handler(makeEvent('GET', { queryStringParameters: { q: 'acme' } }));
    const { companies } = JSON.parse(res.body);
    expect(companies[0].address).toBe('1 High St, London, EC1A 1BB');
  });

  it('filters out dissolved/inactive companies', async () => {
    mockChResponse([
      { ...ACTIVE_COMPANY, company_status: 'dissolved' },
      ACTIVE_COMPANY,
    ]);
    const res = await handler(makeEvent('GET', { queryStringParameters: { q: 'acme' } }));
    const { companies } = JSON.parse(res.body);
    expect(companies).toHaveLength(1);
    expect(companies[0].name).toBe('Acme Ltd');
  });

  it('caps results at 8 companies', async () => {
    const tenCompanies = Array.from({ length: 10 }, (_, i) => ({
      ...ACTIVE_COMPANY,
      company_number: String(i).padStart(8, '0'),
    }));
    mockChResponse(tenCompanies);
    const res = await handler(makeEvent('GET', { queryStringParameters: { q: 'ltd' } }));
    const { companies } = JSON.parse(res.body);
    expect(companies.length).toBeLessThanOrEqual(8);
  });

  it('returns empty companies array when CH returns no items', async () => {
    mockChResponse([]);
    const res = await handler(makeEvent('GET', { queryStringParameters: { q: 'nothing' } }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).companies).toEqual([]);
  });
});

// ── CH API errors ─────────────────────────────────────────────────────────────
describe('CH API errors', () => {
  it('returns 502 when CH responds with non-ok status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const res = await handler(makeEvent('GET', { queryStringParameters: { q: 'acme' } }));
    expect(res.statusCode).toBe(502);
  });

  it('returns 500 on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await handler(makeEvent('GET', { queryStringParameters: { q: 'acme' } }));
    expect(res.statusCode).toBe(500);
  });
});

// ── CORS headers always present ───────────────────────────────────────────────
describe('CORS headers', () => {
  it('includes Access-Control-Allow-Origin on all responses', async () => {
    mockChResponse([ACTIVE_COMPANY]);
    const res = await handler(makeEvent('GET', { queryStringParameters: { q: 'acme' } }));
    expect(res.headers['Access-Control-Allow-Origin']).toBeTruthy();
  });
});
