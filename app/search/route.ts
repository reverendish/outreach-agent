import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  const credentials = Buffer.from(`${apiKey}:`).toString("base64");
  const res = await fetch(
    `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(q)}&items_per_page=10`,
    { headers: { Authorization: `Basic ${credentials}` } }
  );
  if (!res.ok) return NextResponse.json({ error: "Companies House error" }, { status: 502 });

  const data = await res.json();
  const companies = (data.items || [])
    .filter((c: Record<string, unknown>) => c.company_status === "active")
    .slice(0, 8)
    .map((c: Record<string, unknown>) => {
      const addr = c.address as Record<string, string> | undefined;
      return {
        name: c.title,
        number: c.company_number,
        type: c.company_type,
        incorporated: c.date_of_creation,
        address: addr ? [addr.address_line_1, addr.locality, addr.postal_code].filter(Boolean).join(", ") : "",
        sic: (c.description as string) || "",
      };
    });

  return NextResponse.json({ companies });
}
