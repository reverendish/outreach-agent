/**
 * ch-lookup Lambda
 * Fetches Companies House: company profile, officers, filing history.
 * Returns a structured object including entity category mapping.
 */

const CORS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://outreach.ishsitotombe.co.uk',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ENTITY_CATEGORY_MAP = {
  'ltd': 'corporate',
  'plc': 'corporate',
  'llp': 'corporate',
  'limited-partnership': 'corporate',
  'community-interest-company': 'corporate',
  'scottish-limited-partnership': 'corporate',
  'scottish-limited-liability-partnership': 'corporate',
  'charitable-incorporated-organisation': 'flagged',
  'industrial-and-provident-society': 'flagged',
  'registered-society': 'flagged',
  'royal-charter': 'flagged',
};

function mapEntityCategory(chType) {
  return ENTITY_CATEGORY_MAP[chType?.toLowerCase()] ?? 'unregistered';
}

function chHeaders(apiKey) {
  return {
    Authorization: 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
  };
}

async function fetchCH(path, apiKey) {
  const base = 'https://api.company-information.service.gov.uk';
  const res = await fetch(`${base}${path}`, { headers: chHeaders(apiKey) });
  if (!res.ok) return null;
  return res.json();
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'CH API key not configured' }) };
  }

  const { query, type, companyNumber } = body;

  // ── Mode 1: search ──────────────────────────────────────────────────────

  if (type === 'search') {
    if (!query) return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'query required' }) };

    const data = await fetchCH(`/search/companies?q=${encodeURIComponent(query)}&items_per_page=10`, apiKey);
    if (!data) return { statusCode: 502, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Companies House error' }) };

    const companies = (data.items || [])
      .filter(c => c.company_status === 'active')
      .slice(0, 8)
      .map(c => {
        const addr = c.address || {};
        return {
          name: c.title,
          number: c.company_number,
          type: c.company_type,
          entityCategory: mapEntityCategory(c.company_type),
          incorporated: c.date_of_creation,
          address: [addr.address_line_1, addr.locality, addr.postal_code].filter(Boolean).join(', '),
          sic: c.description || '',
        };
      });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companies }),
    };
  }

  // ── Mode 2: profile (full company data + officers + filings) ───────────

  if (type === 'profile') {
    if (!companyNumber) return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'companyNumber required' }) };

    const [company, officersData, filingData] = await Promise.allSettled([
      fetchCH(`/company/${companyNumber}`, apiKey),
      fetchCH(`/company/${companyNumber}/officers?items_per_page=50`, apiKey),
      fetchCH(`/company/${companyNumber}/filing-history?category=confirmation-statement,mortgage&items_per_page=20`, apiKey),
    ]);

    const co = company.status === 'fulfilled' ? company.value : null;
    const officers = officersData.status === 'fulfilled' ? officersData.value : null;
    const filings = filingData.status === 'fulfilled' ? filingData.value : null;

    if (!co) return { statusCode: 502, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Company not found' }) };

    // Map address
    const ra = co.registered_office_address || {};
    const registeredAddress = {
      addressLine1: ra.address_line_1 || '',
      addressLine2: ra.address_line_2 || undefined,
      locality: ra.locality || '',
      region: ra.region || undefined,
      postalCode: ra.postal_code || '',
      country: ra.country || 'United Kingdom',
    };

    // SIC
    const sicCodes = (co.sic_codes || []);
    const sicDescriptions = sicCodes; // CH doesn't return descriptions in basic profile; enrichment-synthesis adds them

    // Directors
    const activeOfficers = ((officers?.items) || [])
      .filter(o => !o.resigned_on)
      .map(o => ({
        id: `${companyNumber}_${o.links?.self?.replace(/\//g, '_') || Math.random()}`,
        name: o.name || '',
        role: o.officer_role || '',
        appointedOn: o.appointed_on || '',
        resignedOn: o.resigned_on || null,
        nationality: o.nationality || null,
        countryOfResidence: o.country_of_residence || null,
        dateOfBirth: o.date_of_birth ? { month: o.date_of_birth.month, year: o.date_of_birth.year } : null,
        address: o.address || null,
        // enrichment fields — null until web enrichment
        email: null,
        emailConfidence: null,
        phone: null,
        phoneSource: null,
        linkedinUrl: null,
        linkedinData: null,
      }));

    // Filing analysis
    const filingItems = filings?.items || [];
    const confirmationStatement = filingItems.find(f => f.category === 'confirmation-statement');
    const mortgages = filingItems.filter(f => f.category === 'mortgage');
    const lastCsDate = confirmationStatement?.date || null;

    // Check overdue (confirmation statement due within 14 days of anniversary)
    let confirmationStatementOverdue = false;
    if (co.confirmation_statement?.overdue) confirmationStatementOverdue = true;

    const filingResult = {
      lastConfirmationStatement: lastCsDate,
      confirmationStatementOverdue,
      activeCharges: co.charges?.total_count || 0,
      recentDirectorChanges: [],
      dormantFlag: co.has_been_liquidated === false && co.company_status === 'active' && co.type === 'dormant' ? true :
                   (co.accounts?.accounting_reference_date ? false : false),
    };

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: {
          companyNumber: co.company_number,
          companyName: co.company_name,
          companyType: co.type,
          entityCategory: mapEntityCategory(co.type),
          registeredAddress,
          incorporationDate: co.date_of_creation || '',
          sicCodes,
          sicDescriptions,
          status: co.company_status || 'unknown',
        },
        directors: activeOfficers,
        filings: filingResult,
      }),
    };
  }

  return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'type must be "search" or "profile"' }) };
};
