import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock AWS SDK before importing the module ──────────────────────────────────
const mockSend = jest.fn();
jest.unstable_mockModule('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  InvokeModelCommand: jest.fn().mockImplementation((input) => input),
}));

const { handler } = await import('../generate.js');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeEvent(body = {}, method = 'POST') {
  return {
    requestContext: { http: { method } },
    body: JSON.stringify(body),
  };
}

function mockBedrockSuccess(text) {
  const responseBody = { content: [{ text }] };
  mockSend.mockResolvedValueOnce({
    body: new TextEncoder().encode(JSON.stringify(responseBody)),
  });
}

beforeEach(() => {
  mockSend.mockReset();
  process.env.BEDROCK_MODEL_ID = undefined;
  process.env.BEDROCK_REGION = undefined;
});

// ── CORS preflight ────────────────────────────────────────────────────────────
describe('OPTIONS preflight', () => {
  it('returns 200 with CORS headers', async () => {
    const res = await handler({ requestContext: { http: { method: 'OPTIONS' } } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(res.body).toBe('');
  });
});

// ── Input validation ──────────────────────────────────────────────────────────
describe('input validation', () => {
  it('returns 400 on malformed JSON body', async () => {
    const res = await handler({
      requestContext: { http: { method: 'POST' } },
      body: '{ not valid json',
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/JSON/i);
  });

  it('handles empty body gracefully', async () => {
    mockBedrockSuccess('Subject: Hello\n\nHi there,\n\nTest email.\n\nAre you interested?');
    const res = await handler({
      requestContext: { http: { method: 'POST' } },
      body: null,
    });
    // Should attempt generation even with empty fields
    expect(res.statusCode).toBe(200);
  });
});

// ── Successful generation ─────────────────────────────────────────────────────
describe('successful generation', () => {
  it('returns generated email text in result field', async () => {
    const emailText = 'Subject: Quick question\n\nHi John,\n\nI noticed your bakery in Colchester. Are you interested?';
    mockBedrockSuccess(emailText);

    const res = await handler(makeEvent({ name: 'John', business: 'Acme Bakery', context: 'local bakery' }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).result).toBe(emailText);
  });

  it('sends request to Bedrock with correct structure', async () => {
    mockBedrockSuccess('Subject: Test\n\nHi,\n\nTest.\n\nInterested?');
    await handler(makeEvent({ name: 'Jane', business: 'Tech Ltd', context: 'SaaS company' }));

    const callArg = mockSend.mock.calls[0][0];
    expect(callArg.body).toBeTruthy();
    const parsed = JSON.parse(callArg.body);
    expect(parsed.messages[0].role).toBe('user');
    expect(parsed.max_tokens).toBe(400);
    expect(parsed.anthropic_version).toBe('bedrock-2023-05-31');
  });

  it('uses BEDROCK_MODEL_ID env var when set', async () => {
    process.env.BEDROCK_MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20251001-v1:0';
    mockBedrockSuccess('Subject: Test\n\nBody');
    await handler(makeEvent({ name: 'A', business: 'B', context: 'C' }));
    const callArg = mockSend.mock.calls[0][0];
    expect(callArg.modelId).toBe('eu.anthropic.claude-sonnet-4-5-20251001-v1:0');
  });

  it('falls back to EU model ID when BEDROCK_MODEL_ID not set', async () => {
    delete process.env.BEDROCK_MODEL_ID;
    mockBedrockSuccess('Subject: Test\n\nBody');
    await handler(makeEvent({ name: 'A', business: 'B', context: 'C' }));
    const callArg = mockSend.mock.calls[0][0];
    // Must NOT use the old us. prefix which doesn't work in eu-west-2
    expect(callArg.modelId).not.toMatch(/^us\./);
    expect(callArg.modelId).toMatch(/eu\.|anthropic\./);
  });

  it('prompt includes business and contact name', async () => {
    mockBedrockSuccess('Subject: Test\n\nBody');
    await handler(makeEvent({ name: 'Sarah', business: 'Green Plumbers Ltd', context: 'plumbing' }));
    const callArg = mockSend.mock.calls[0][0];
    const prompt = JSON.parse(callArg.body).messages[0].content;
    expect(prompt).toContain('Sarah');
    expect(prompt).toContain('Green Plumbers Ltd');
  });
});

// ── Bedrock errors ────────────────────────────────────────────────────────────
describe('Bedrock errors', () => {
  it('returns 500 when Bedrock call throws', async () => {
    mockSend.mockRejectedValueOnce(new Error('ValidationException'));
    const res = await handler(makeEvent({ name: 'A', business: 'B', context: 'C' }));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/Generation failed/i);
  });

  it('includes error details in 500 response', async () => {
    mockSend.mockRejectedValueOnce(new Error('ResourceNotFoundException: model not found'));
    const res = await handler(makeEvent({ name: 'A', business: 'B', context: 'C' }));
    const body = JSON.parse(res.body);
    expect(body.details).toContain('model not found');
  });
});

// ── CORS headers ──────────────────────────────────────────────────────────────
describe('CORS headers', () => {
  it('includes Access-Control-Allow-Origin on success', async () => {
    mockBedrockSuccess('Subject: Test\n\nBody');
    const res = await handler(makeEvent({ name: 'A', business: 'B', context: 'C' }));
    expect(res.headers['Access-Control-Allow-Origin']).toBeTruthy();
  });

  it('includes Access-Control-Allow-Origin on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('fail'));
    const res = await handler(makeEvent({ name: 'A', business: 'B', context: 'C' }));
    expect(res.headers['Access-Control-Allow-Origin']).toBeTruthy();
  });
});
