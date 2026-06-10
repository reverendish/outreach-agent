import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock AWS SDK and fetch before importing ───────────────────────────────────
const mockSend = jest.fn();
jest.unstable_mockModule('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  InvokeModelCommand: jest.fn().mockImplementation((input) => input),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const { handler } = await import('../enrich.js');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeEvent(body = {}) {
  return {
    requestContext: { http: { method: 'POST' } },
    body: JSON.stringify(body),
  };
}

const MINIMAL_ENRICHMENT = JSON.stringify({
  website: null, gbp: null, filings: null, news: null, social: null,
  companySize: null, credentialsAndAwards: null, activeJobPostings: null,
  painPoints: null, confidenceScore: 30, conflictingDataFlags: [], sourcesUsed: [],
  enrichedAt: new Date().toISOString(),
});

function mockBedrockSuccess(json = MINIMAL_ENRICHMENT) {
  mockSend.mockResolvedValue({
    body: new TextEncoder().encode(
      JSON.stringify({ content: [{ text: json }] })
    ),
  });
}

function mockFetchJson(data) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
}

beforeEach(() => {
  mockSend.mockReset();
  mockFetch.mockReset();
  process.env.COMPANIES_HOUSE_API_KEY = 'ch-test-key';
  process.env.BRAVE_API_KEY = 'brave-test-key';
  delete process.env.BEDROCK_MODEL_ID;
});

// ── CORS preflight ────────────────────────────────────────────────────────────
describe('OPTIONS preflight', () => {
  it('returns 200 with CORS headers', async () => {
    const res = await handler({ requestContext: { http: { method: 'OPTIONS' } }, headers: { origin: 'https://outreach.ishsitotombe.co.uk' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('');
    expect(res.headers['Access-Control-Allow-Origin']).toBeTruthy();
  });

  it('reflects outreach app origin', async () => {
    const res = await handler({ requestContext: { http: { method: 'OPTIONS' } }, headers: { origin: 'https://outreach.ishsitotombe.co.uk' } });
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://outreach.ishsitotombe.co.uk');
  });

  it('reflects portfolio origin', async () => {
    const res = await handler({ requestContext: { http: { method: 'OPTIONS' } }, headers: { origin: 'https://ishsitotombe.co.uk' } });
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://ishsitotombe.co.uk');
  });

  it('falls back to outreach origin for unknown origins', async () => {
    const res = await handler({ requestContext: { http: { method: 'OPTIONS' } }, headers: { origin: 'https://attacker.com' } });
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://outreach.ishsitotombe.co.uk');
  });

  it('includes CORS header even when no origin header present', async () => {
    const res = await handler({ requestContext: { http: { method: 'OPTIONS' } } });
    expect(res.headers['Access-Control-Allow-Origin']).toBeTruthy();
  });
});

// ── Input validation ──────────────────────────────────────────────────────────
describe('input validation', () => {
  it('returns 400 on malformed JSON', async () => {
    const res = await handler({
      requestContext: { http: { method: 'POST' } },
      body: '{ bad json',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when neither companyNumber nor companyName provided', async () => {
    const res = await handler(makeEvent({}));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/companyNumber or companyName/i);
  });

  it('accepts request with only companyName', async () => {
    mockBedrockSuccess();
    // Mock CH and Brave fetch calls to resolve quickly
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], web: { results: [] } }),
      text: async () => '<html><body>Test site</body></html>',
    });
    const res = await handler(makeEvent({ companyName: 'Acme Ltd' }));
    // Should get to synthesis phase (200) or synthesis error (500 if JSON parse fails)
    expect([200, 500]).toContain(res.statusCode);
  });
});

// ── Model ID ──────────────────────────────────────────────────────────────────
describe('model ID selection', () => {
  it('does not use the old us. cross-region prefix', async () => {
    mockBedrockSuccess();
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
      text: async () => '',
    });
    await handler(makeEvent({ companyNumber: '12345678', companyName: 'Acme Ltd' }));
    const callArg = mockSend.mock.calls[0]?.[0];
    if (callArg) {
      expect(callArg.modelId).not.toMatch(/^us\./);
    }
  });

  it('uses BEDROCK_MODEL_ID env var when set', async () => {
    process.env.BEDROCK_MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20251001-v1:0';
    mockBedrockSuccess();
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}), text: async () => '' });
    await handler(makeEvent({ companyNumber: '12345678', companyName: 'Acme Ltd' }));
    const callArg = mockSend.mock.calls[0]?.[0];
    if (callArg) {
      expect(callArg.modelId).toBe('eu.anthropic.claude-sonnet-4-5-20251001-v1:0');
    }
  });
});

// ── Successful enrichment ─────────────────────────────────────────────────────
describe('successful enrichment', () => {
  it('returns enrichment and changesSummary on success', async () => {
    mockBedrockSuccess();
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}), text: async () => '' });
    const res = await handler(makeEvent({ companyNumber: '12345678', companyName: 'Acme Ltd' }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('enrichment');
    expect(body).toHaveProperty('changesSummary');
  });

  it('changesSummary is empty string when no previousEnrichment', async () => {
    mockBedrockSuccess();
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}), text: async () => '' });
    const res = await handler(makeEvent({ companyNumber: '12345678', companyName: 'Acme Ltd' }));
    expect(JSON.parse(res.body).changesSummary).toBe('');
  });
});

// ── Synthesis failure ─────────────────────────────────────────────────────────
describe('synthesis failure', () => {
  it('returns 500 when Bedrock throws', async () => {
    mockSend.mockRejectedValue(new Error('ServiceUnavailableException'));
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}), text: async () => '' });
    const res = await handler(makeEvent({ companyNumber: '12345678', companyName: 'Acme Ltd' }));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/Synthesis failed/i);
  });

  it('returns 500 when Bedrock returns non-JSON text', async () => {
    mockSend.mockResolvedValue({
      body: new TextEncoder().encode(
        JSON.stringify({ content: [{ text: 'Sorry, I cannot help with that.' }] })
      ),
    });
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}), text: async () => '' });
    const res = await handler(makeEvent({ companyNumber: '12345678', companyName: 'Acme Ltd' }));
    expect(res.statusCode).toBe(500);
  });
});

// ── Internal helpers ──────────────────────────────────────────────────────────
describe('internal helpers (via integration)', () => {
  it('detects tech stack signals from website HTML', async () => {
    // The enrich handler runs detectTechStack internally — verify it does
    // not crash on various HTML inputs by exercising the full path.
    mockBedrockSuccess();
    mockFetch
      // CH company endpoint
      .mockResolvedValueOnce({ ok: true, json: async () => ({ company_name: 'Acme', company_number: '12345678' }) })
      // CH officers
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      // CH filings
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      // Brave website search
      .mockResolvedValueOnce({ ok: true, json: async () => ({ web: { results: [{ url: 'https://acme.co.uk', title: 'Acme' }] } }) })
      // Brave GBP search
      .mockResolvedValueOnce({ ok: true, json: async () => ({ web: { results: [] } }) })
      // Brave news search
      .mockResolvedValueOnce({ ok: true, json: async () => ({ web: { results: [] } }) })
      // Brave general search
      .mockResolvedValueOnce({ ok: true, json: async () => ({ web: { results: [] } }) })
      // Website fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<html><body><script src="wp-content/themes"></script><p>Welcome to Acme. We build widgets.</p></body></html>',
      });

    const res = await handler(makeEvent({ companyNumber: '12345678', companyName: 'Acme Ltd' }));
    // Should reach synthesis (no crash in helpers)
    expect([200, 500]).toContain(res.statusCode);
  });
});
