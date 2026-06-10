export const handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://outreach.ishsitotombe.co.uk',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // Support both GET (query params) and POST (JSON body)
  let companyNumber;
  if (event.requestContext?.http?.method === 'GET') {
    const { number } = event.queryStringParameters || {};
    companyNumber = number;
  } else {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { }
    companyNumber = body?.companyNumber || event.queryStringParameters?.number;
  }

  if (!companyNumber) {
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ director: null })
    };
  }

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ director: null })
    };
  }

  try {
    const credentials = Buffer.from(`${apiKey}:`).toString('base64');
    const res = await fetch(
      `https://api.company-information.service.gov.uk/company/${companyNumber}/officers`,
      { headers: { Authorization: `Basic ${credentials}` } }
    );

    if (!res.ok) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ director: null })
      };
    }

    const data = await res.json();
    const director = (data.items || []).find(o => !o.resigned_on);
    if (!director) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ director: null })
      };
    }

    const raw = director.name || '';
    const parts = raw.split(',');
    const firstName = parts[1]?.trim().split(' ')[0] || raw.split(' ')[0];
    const formatted = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ director: formatted })
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ director: null })
    };
  }
};
