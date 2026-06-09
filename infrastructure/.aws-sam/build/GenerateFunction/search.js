export const handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://outreach.ishsitotombe.co.uk',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const q = event.queryStringParameters?.q;
  if (!q) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing query' }) };
  }

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  const credentials = Buffer.from(`${apiKey}:`).toString('base64');
  const url = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(q)}&items_per_page=10`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}` }
    });

    if (!res.ok) {
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Companies House error' }) };
    }

    const data = await res.json();
    const companies = (data.items || [])
      .filter((c) => c.company_status === 'active')
      .slice(0, 8)
      .map((c) => {
        const addr = c.address;
        return {
          name: c.title,
          number: c.company_number,
          type: c.company_type,
          incorporated: c.date_of_creation,
          address: addr ? [addr.address_line_1, addr.locality, addr.postal_code].filter(Boolean).join(', ') : '',
          sic: c.description || '',
        };
      });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companies })
    };
  } catch (error) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
