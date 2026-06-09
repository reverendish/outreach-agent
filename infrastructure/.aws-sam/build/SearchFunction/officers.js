export const handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://outreach.ishsitotombe.co.uk',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const number = event.queryStringParameters?.number;
  if (!number) {
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ director: null }) };
  }

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ director: null }) };
  }

  const credentials = Buffer.from(`${apiKey}:`).toString('base64');
  const url = `https://api.company-information.service.gov.uk/company/${number}/officers`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}` }
    });

    if (!res.ok) {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ director: null }) };
    }

    const data = await res.json();
    const director = (data.items || []).find((o) => !o.resigned_on);
    if (!director) {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ director: null }) };
    }

    const raw = director.name || '';
    const parts = raw.split(',');
    const firstName = parts[1]?.trim().split(' ')[0] || raw.split(' ')[0];
    const formatted = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ director: formatted }) };
  } catch (error) {
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ director: null }) };
  }
};
