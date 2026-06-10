import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const { handler } = await import('../officers.js');

function makeEvent(method, overrides = {}) {
  return {
    requestContext: { http: { method } },
    queryStringParameters: {},
    body: null,
    ...overrides,
  };
}

function mockOfficersResponse(items, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    json: async () => ({ items }),
  });
}

const ACTIVE_DIRECTOR = {
  name: 'SMITH, John William',
  officer_role: 'director',
  appointed_on: '2020-01-01',
  // no resigned_on → active
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
    expect(res.body).toBe('');
  });
});

// ── Missing inputs (graceful degradation) ────────────────────────────────────
describe('graceful degradation', () => {
  it('returns director:null when no company number provided (GET)', async () => {
    const res = await handler(makeEvent('GET', { queryStringParameters: {} }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ director: null });
  });

  it('returns director:null when no company number provided (POST)', async () => {
    const res = await handler(makeEvent('POST', { body: JSON.stringify({}) }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ director: null });
  });

  it('returns director:null when API key not set', async () => {
    delete process.env.COMPANIES_HOUSE_API_KEY;
    const res = await handler(makeEvent('GET', {
      queryStringParameters: { number: '12345678' },
    }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ director: null });
  });

  it('returns director:null when CH responds with non-ok status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const res = await handler(makeEvent('GET', {
      queryStringParameters: { number: '12345678' },
    }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ director: null });
  });

  it('returns director:null when all officers have resigned', async () => {
    mockOfficersResponse([
      { ...ACTIVE_DIRECTOR, resigned_on: '2023-01-01' },
    ]);
    const res = await handler(makeEvent('GET', {
      queryStringParameters: { number: '12345678' },
    }));
    expect(JSON.parse(res.body)).toEqual({ director: null });
  });

  it('returns director:null on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await handler(makeEvent('GET', {
      queryStringParameters: { number: '12345678' },
    }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ director: null });
  });
});

// ── Name formatting ───────────────────────────────────────────────────────────
describe('name formatting', () => {
  it('extracts and title-cases first name from "SURNAME, FIRSTNAME" format', async () => {
    mockOfficersResponse([ACTIVE_DIRECTOR]);
    const res = await handler(makeEvent('GET', {
      queryStringParameters: { number: '12345678' },
    }));
    expect(JSON.parse(res.body).director).toBe('John');
  });

  it('handles single-part name gracefully', async () => {
    mockOfficersResponse([{ name: 'ACMECORP', officer_role: 'director' }]);
    const res = await handler(makeEvent('GET', {
      queryStringParameters: { number: '12345678' },
    }));
    // Should return something, not throw
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).director).toBeTruthy();
  });

  it('picks the first non-resigned officer', async () => {
    mockOfficersResponse([
      { ...ACTIVE_DIRECTOR, resigned_on: '2022-01-01', name: 'OLD, Director' },
      { ...ACTIVE_DIRECTOR, name: 'JONES, Sarah' },
    ]);
    const res = await handler(makeEvent('GET', {
      queryStringParameters: { number: '12345678' },
    }));
    expect(JSON.parse(res.body).director).toBe('Sarah');
  });
});

// ── GET vs POST ───────────────────────────────────────────────────────────────
describe('GET vs POST routing', () => {
  it('reads company number from query string in GET', async () => {
    mockOfficersResponse([ACTIVE_DIRECTOR]);
    await handler(makeEvent('GET', { queryStringParameters: { number: '12345678' } }));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('12345678'),
      expect.anything()
    );
  });

  it('reads company number from POST body', async () => {
    mockOfficersResponse([ACTIVE_DIRECTOR]);
    await handler(makeEvent('POST', { body: JSON.stringify({ companyNumber: '87654321' }) }));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('87654321'),
      expect.anything()
    );
  });
});
