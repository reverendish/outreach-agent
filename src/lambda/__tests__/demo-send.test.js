import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mocks before import ───────────────────────────────────────────────────────
const mockSend = jest.fn();
jest.unstable_mockModule('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  InvokeModelCommand: jest.fn().mockImplementation((input) => input),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const { handler } = await import('../demo-send.js');

// ── Helpers ───────────────────────────────────────────────────────────────────
const VALID_BODY = {
  name: 'Sarah',
  business: 'estate agent in London',
  recipientEmail: 'sarah@example.com',
};

function makeEvent(body = VALID_BODY, origin = 'https://ishsitotombe.co.uk') {
  return {
    requestContext: { http: { method: 'POST' } },
    headers: { origin },
    body: JSON.stringify(body),
  };
}

const EMAIL_TEXT = 'Subject: Quick question about your agency\n\nHi Sarah,\n\nI noticed your estate agency in London. Are you interested?\n\nWorth a chat?';

function mockBedrockSuccess(text = EMAIL_TEXT) {
  mockSend.mockResolvedValueOnce({
    body: new TextEncoder().encode(JSON.stringify({ content: [{ text }] })),
  });
}

function mockResendSuccess() {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'msg_123' }) });
}

beforeEach(() => {
  mockSend.mockReset();
  mockFetch.mockReset();
  process.env.RESEND_API_KEY = 'resend-test-key';
  delete process.env.BEDROCK_MODEL_ID;
});

// ── CORS preflight ────────────────────────────────────────────────────────────
describe('OPTIONS preflight', () => {
  it('returns 200 with CORS headers', async () => {
    const res = await handler({ requestContext: { http: { method: 'OPTIONS' } }, headers: { origin: 'https://ishsitotombe.co.uk' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(res.body).toBe('');
  });
});

// ── CORS origin handling ──────────────────────────────────────────────────────
describe('CORS origin', () => {
  it('reflects portfolio origin in response', async () => {
    mockBedrockSuccess();
    mockResendSuccess();
    const res = await handler(makeEvent(VALID_BODY, 'https://ishsitotombe.co.uk'));
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://ishsitotombe.co.uk');
  });

  it('reflects outreach app origin in response', async () => {
    mockBedrockSuccess();
    mockResendSuccess();
    const res = await handler(makeEvent(VALID_BODY, 'https://outreach.ishsitotombe.co.uk'));
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://outreach.ishsitotombe.co.uk');
  });

  it('falls back to portfolio origin for unknown origins', async () => {
    mockBedrockSuccess();
    mockResendSuccess();
    const res = await handler(makeEvent(VALID_BODY, 'https://attacker.com'));
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://ishsitotombe.co.uk');
  });
});

// ── Input validation ──────────────────────────────────────────────────────────
describe('input validation', () => {
  it('returns 400 on malformed JSON', async () => {
    const res = await handler({ requestContext: { http: { method: 'POST' } }, headers: {}, body: '{ bad' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when name is missing', async () => {
    const res = await handler(makeEvent({ business: 'Acme', recipientEmail: 'a@b.com' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/required/i);
  });

  it('returns 400 when business is missing', async () => {
    const res = await handler(makeEvent({ name: 'Alice', recipientEmail: 'a@b.com' }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when recipientEmail is missing', async () => {
    const res = await handler(makeEvent({ name: 'Alice', business: 'Acme' }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await handler(makeEvent({ ...VALID_BODY, recipientEmail: 'not-an-email' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/email/i);
  });

  it('accepts email with subdomain', async () => {
    mockBedrockSuccess();
    mockResendSuccess();
    const res = await handler(makeEvent({ ...VALID_BODY, recipientEmail: 'user@mail.example.co.uk' }));
    expect(res.statusCode).toBe(200);
  });

  it('returns 500 when RESEND_API_KEY not set', async () => {
    delete process.env.RESEND_API_KEY;
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/not configured/i);
  });
});

// ── Successful send ───────────────────────────────────────────────────────────
describe('successful send', () => {
  it('returns success:true and emailText', async () => {
    mockBedrockSuccess();
    mockResendSuccess();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.emailText).toBe(EMAIL_TEXT);
  });

  it('sends to Resend with correct from address', async () => {
    mockBedrockSuccess();
    mockResendSuccess();
    await handler(makeEvent());
    const resendCall = mockFetch.mock.calls[0];
    const resendBody = JSON.parse(resendCall[1].body);
    expect(resendBody.from).toContain('demo@ishsitotombe.co.uk');
  });

  it('sends to recipient email', async () => {
    mockBedrockSuccess();
    mockResendSuccess();
    await handler(makeEvent());
    const resendBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(resendBody.to).toContain('sarah@example.com');
  });

  it('extracts subject from generated email', async () => {
    mockBedrockSuccess();
    mockResendSuccess();
    await handler(makeEvent());
    const resendBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(resendBody.subject).toBe('Quick question about your agency');
  });

  it('email body does not include the Subject: line', async () => {
    mockBedrockSuccess();
    mockResendSuccess();
    await handler(makeEvent());
    const resendBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(resendBody.text).not.toMatch(/^Subject:/i);
  });

  it('falls back to default subject when Subject line absent', async () => {
    mockBedrockSuccess('Hi Sarah,\n\nQuick note.\n\nInterested?');
    mockResendSuccess();
    await handler(makeEvent());
    const resendBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(resendBody.subject).toBeTruthy();
  });

  it('does not use the old us. Bedrock prefix', async () => {
    mockBedrockSuccess();
    mockResendSuccess();
    await handler(makeEvent());
    const callArg = mockSend.mock.calls[0][0];
    expect(callArg.modelId).not.toMatch(/^us\./);
  });
});

// ── Bedrock failure ───────────────────────────────────────────────────────────
describe('Bedrock failure', () => {
  it('returns 500 when Bedrock throws', async () => {
    mockSend.mockRejectedValueOnce(new Error('ValidationException'));
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/Generation failed/i);
  });
});

// ── Resend failure ────────────────────────────────────────────────────────────
describe('Resend failure', () => {
  it('returns 502 when Resend responds with non-ok status', async () => {
    mockBedrockSuccess();
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => '{"message":"Invalid API key"}' });
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).error).toMatch(/Send failed/i);
  });

  it('returns 502 when Resend fetch throws', async () => {
    mockBedrockSuccess();
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(502);
  });
});
