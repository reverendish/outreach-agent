"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "../../components/Shell";
import * as api from "../../src/api";
import type { Contact } from "../../src/types";

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

interface CHCompany {
  name: string;
  number: string;
  type: string;
  incorporated: string;
  address: string;
  sic: string;
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CHCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, Contact>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const data = await api.search.companies(query.trim());
      const companies = (data as { companies?: CHCompany[] }).companies ?? [];
      setResults(companies);
      if (companies.length === 0) setError("No active companies found.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveToContacts(company: CHCompany) {
    setSaving(prev => ({ ...prev, [company.number]: true }));
    try {
      const contact = await api.contacts.upsert({
        ch: {
          companyNumber: company.number,
          companyName: company.name,
          companyType: company.type,
          entityCategory: "corporate",
          registeredAddress: { addressLine1: company.address, locality: "", postalCode: "", country: "United Kingdom" },
          incorporationDate: company.incorporated ?? "",
          sicCodes: [],
          sicDescriptions: company.sic ? [company.sic] : [],
          status: "active",
        },
        status: "new" as const,
        starred: false,
        tags: [],
        directors: [],
        enrichment: null,
        notes: [],
        suppressedEmails: [],
        source: "ch_search" as const,
      } as Parameters<typeof api.contacts.upsert>[0]);
      setSaved(prev => ({ ...prev, [company.number]: contact }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(prev => ({ ...prev, [company.number]: false }));
    }
  }

  return (
    <Shell>
      <div style={{ maxWidth: 760 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Company Search</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Search Companies House, then save to your contacts.</p>
        </div>

        <form onSubmit={doSearch} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Company name or number…"
            style={{ flex: 1, minWidth: 0 }}
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()}>
            {loading ? <span className="spinner" /> : "Search"}
          </button>
        </form>

        {error && <p style={{ fontSize: "0.875rem", color: "var(--status-red)", marginBottom: 16 }}>{error}</p>}

        {results.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {results.map((company, i) => {
              const isSaved = !!saved[company.number];
              const isSaving = !!saving[company.number];
              const savedContact = saved[company.number];
              return (
                <div key={company.number} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                      {toTitleCase(company.name)}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {company.number} · {company.type} · Inc. {company.incorporated}
                    </p>
                    {company.address && <p style={{ fontSize: "0.72rem", color: "var(--faint)", marginTop: 2 }}>{company.address}</p>}
                    {company.sic && <p style={{ fontSize: "0.7rem", color: "var(--faint)", marginTop: 2 }}>{company.sic}</p>}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    {isSaved ? (
                      <>
                        <span className="badge badge-blue">saved</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/contact/${savedContact.id}`)}>
                          View →
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-primary btn-sm" disabled={isSaving} onClick={() => saveToContacts(company)}>
                        {isSaving ? <span className="spinner" style={{ width: 12, height: 12 }} /> : "Save to contacts"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
