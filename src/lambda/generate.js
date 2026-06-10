import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'eu-west-2' });

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://outreach.ishsitotombe.co.uk',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }

  const { name, business, context } = body;

  const prompt = `Write a short cold email from Ish, a developer based in Colchester who builds small automations for businesses. Business: ${business}. Director/contact name: ${name}. Extra context: ${context}.

Format:
Subject: [short subject line, title case, no ALL CAPS, max 8 words]

[greeting using first name if it looks like a person's name, otherwise "Hi there,"]

[2-3 sentences max. Be specific about what you could help with based on their industry. Sound like a real person. No buzzwords like streamline, leverage, synergy. No "I hope this finds you well". Don't mention AI in the first sentence.]

[one simple low-pressure question to end]

Output only the email. No commentary.`;

  try {
    const command = new InvokeModelCommand({
      modelId: process.env.BEDROCK_MODEL_ID || 'eu.anthropic.claude-sonnet-4-5-20251001-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 400,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      })
    });

    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const result = responseBody.content[0].text;

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ result })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Generation failed', details: e.message })
    };
  }
};
