import { checkInternalKey } from './auth.js';
import { corsHeaders } from './cors.js';

export const handler = async (event) => {
  const CORS = corsHeaders(event);

  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (!checkInternalKey(event)) {
    return { statusCode: 401, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorised' }) };
  }

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'API key not configured' })
    };
  }

  const credentials = Buffer.from(`${apiKey}:`).toString('base64');
  const qsp = event.queryStringParameters || {};

  // GET ?officers=<company_number> — fetch company officers
  if (event.requestContext?.http?.method === 'GET' && qsp.officers) {
    try {
      const url = `https://api.company-information.service.gov.uk/company/${encodeURIComponent(qsp.officers)}/officers?items_per_page=50`;
      const res = await fetch(url, { headers: { Authorization: `Basic ${credentials}` } });
      if (!res.ok) {
        return { statusCode: 502, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Companies House error' }) };
      }
      const data = await res.json();
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ officers: data.items || [] })
      };
    } catch {
      return { statusCode: 500, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Internal server error' }) };
    }
  }

  // POST (or GET ?q=) — company search
  let query;
  if (event.requestContext?.http?.method === 'GET') {
    query = qsp.q;
  } else {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { }
    query = body?.query || qsp.q;
  }

  if (!query) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'query required' })
    };
  }

  try {
    const url = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(query)}&items_per_page=10`;
    const res = await fetch(url, { headers: { Authorization: `Basic ${credentials}` } });

    if (!res.ok) {
      return {
        statusCode: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Companies House error' })
      };
    }

    const data = await res.json();
    const companies = (data.items || [])
      .filter(c => c.company_status === 'active')
      .slice(0, 8)
      .map(c => {
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
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companies })
    };
  } catch {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
