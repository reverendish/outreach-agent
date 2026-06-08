import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const number = searchParams.get("number");
  if (!number) return NextResponse.json({ director: null });

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) return NextResponse.json({ director: null });

  const credentials = Buffer.from(`${apiKey}:`).toString("base64");
  try {
    const res = await fetch(
      `https://api.company-information.service.gov.uk/company/${number}/officers`,
      { headers: { Authorization: `Basic ${credentials}` } }
    );
    if (!res.ok) return NextResponse.json({ director: null });

    const data = await res.json();
    const director = (data.items || []).find((o: Record<string, unknown>) => !o.resigned_on);
    if (!director) return NextResponse.json({ director: null });

    const raw = (director.name as string) || "";
    const parts = raw.split(",");
    const firstName = parts[1]?.trim().split(" ")[0] || raw.split(" ")[0];
    const formatted = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    return NextResponse.json({ director: formatted });
  } catch {
    return NextResponse.json({ director: null });
  }
}
