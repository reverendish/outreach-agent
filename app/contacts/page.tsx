"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Shell from "../../components/Shell";
import * as api from "../../src/api";
import type { Contact, PipelineStage } from "../../src/types";
import { PIPELINE_STAGE_LABELS } from "../../src/types";

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

const STAGE_BADGE: Record<PipelineStage, string> = {
  new: "badge-blue", enriched: "badge-blue", draft_ready: "badge-blue",
  contacted: "badge-amber", review: "badge-amber", replied: "badge-amber",
  converted: "badge-green", archived: "badge-grey",
};

interface CHResult {
  name: string;
  number: string;
  type: string;
  incorporated: string;
  address: string;
  sic: string;
}

export default function Contacts() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<PipelineStage | "all">("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // CH search
  const [chQuery, setChQuery] = useState("");
  const [chSearching, setChSearching] = useState(false);
  const [chResults, setChResults] = useState<CHResult[]>([]);
  const [chError, setChError] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    api.contacts.list()
      .then(setContacts)
      .finally(() => setLoading(false));
  }, []);

  const searchCH = async () => {
    if (!chQuery.trim()) return;
    setChSearching(true);
    setChError("");
    setChResults([]);
    try {
      const data = await api.search.companies(chQuery);
      setChResults((data as { companies?: CHResult[] }).companies ?? []);
    } catch (e: unknown) {
      setChError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setChSearching(false);
    }
  };

  const addFromCH = async (r: CHResult) => {
    if (contacts.find(c => c.ch?.companyNumber === r.number)) return;
    setAddingId(r.number);
    try {
      let directors: Contact["directors"] = [];
      try {
        const dirRes = await fetch(`/api/search?officers=${r.number}`);
        if (dirRes.ok) {
          const dirData = await dirRes.json();
          directors = (dirData.officers ?? []).map((o: {
            name: string; officer_role: string; appointed_on: string; resigned_on?: string;
          }) => ({
            id: crypto.randomUUID(),
            name: o.name,
            role: o.officer_role,
            appointedOn: o.appointed_on,
            resignedOn: o.resigned_on ?? null,
            nationality: null,
            countryOfResidence: null,
            dateOfBirth: null,
            address: null,
            email: null,
            emailConfidence: null,
            phone: null,
            linkedinUrl: null,
          }));
        }
      } catch { /* non-critical */ }

      const contact = await api.contacts.upsert({
        ch: {
          companyNumber: r.number,
          companyName: r.name,
          companyType: r.type,
          entityCategory: "corporate",
          registeredAddress: { addressLine1: r.address, locality: "", postalCode: "", country: "United Kingdom" },
          incorporationDate: r.incorporated ?? "",
          sicCodes: [],
          sicDescriptions: r.sic ? [r.sic] : [],
          status: "active",
        },
        status: "new" as const,
        starred: false,
        tags: [],
        directors,
        enrichment: null,
        notes: [],
        suppressedEmails: [],
        source: "ch_search" as const,
      } as Parameters<typeof api.contacts.upsert>[0]);
      setContacts(prev => [contact, ...prev]);
      setChResults(prev => prev.filter(x => x.number !== r.number));
    } finally {
      setAddingId(null);
    }
  };

  const filtered = useMemo(() => {
    let list = contacts;
    if (stageFilter !== "all") list = list.filter(c => c.status === stageFilter);
    if (starredOnly) list = list.filter(c => c.starred);
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      list = list.filter(c =>
        (c.ch?.companyName ?? "").toLowerCase().includes(q) ||
        c.directors?.[0]?.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [contacts, stageFilter, starredOnly, tableSearch]);

  const toggleStar = async (id: string, starred: boolean) => {
    await api.contacts.patch(id, { starred: !starred });
    setContacts(prev => prev.map(c => c.id === id ? { ...c, starred: !starred } : c));
  };

  const bulkArchive = async () => {
    await Promise.all(
      Array.from(selectedIds).map(id => api.contacts.patch(id, { status: "archived" }))
    );
    setContacts(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, status: "archived" as PipelineStage } : c));
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAll = () => {
    setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id)));
  };

  const STAGES: Array<PipelineStage | "all"> = ["all", "new", "enriched", "draft_ready", "contacted", "replied", "converted", "archived"];
  const stageCount = (s: PipelineStage | "all") =>
    s === "all" ? contacts.length : contacts.filter(c => c.status === s).length;

  return (
    <Shell>
      <div style={{ display: "grid", gap: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Contacts</h1>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
              {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
              {filtered.length !== contacts.length ? ` · ${filtered.length} shown` : ""}
            </p>
          </div>
          {selectedIds.size > 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{selectedIds.size} selected</span>
              <button onClick={bulkArchive} className="btn btn-ghost btn-sm">Archive</button>
            </div>
          )}
        </div>

        {/* CH Search */}
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>Search Companies House</p>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={chQuery}
              onChange={e => setChQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchCH()}
              placeholder="e.g. IT support London"
              style={{ flex: 1 }}
            />
            <button onClick={searchCH} disabled={chSearching || !chQuery.trim()} className="btn btn-primary">
              {chSearching ? <><span className="spinner" /> Searching</> : "Search →"}
            </button>
          </div>
          {chError && <p style={{ marginTop: 8, fontSize: "0.82rem", color: "var(--status-red)" }}>{chError}</p>}
          {chResults.length > 0 && (
            <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
              {chResults.map(r => {
                const alreadyAdded = contacts.some(c => c.ch?.companyNumber === r.number);
                return (
                  <div key={r.number} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-2)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{toTitleCase(r.name)}</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{r.address}{r.sic ? ` · ${r.sic}` : ""}</p>
                    </div>
                    <button onClick={() => addFromCH(r)} disabled={alreadyAdded || addingId === r.number} className="btn btn-primary btn-sm" style={{ marginLeft: 12, flexShrink: 0 }}>
                      {alreadyAdded ? "Added" : addingId === r.number ? "…" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {STAGES.map(s => (
              <button key={s} onClick={() => setStageFilter(s)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: "0.78rem", fontWeight: stageFilter === s ? 600 : 400, border: stageFilter === s ? "1px solid var(--accent)" : "1px solid var(--border-2)", background: stageFilter === s ? "var(--accent-dim)" : "var(--surface)", color: stageFilter === s ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}>
                {s === "all" ? "All" : PIPELINE_STAGE_LABELS[s as PipelineStage]} ({stageCount(s)})
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
            <button onClick={() => setStarredOnly(!starredOnly)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: "0.78rem", border: starredOnly ? "1px solid var(--accent)" : "1px solid var(--border-2)", background: starredOnly ? "var(--accent-dim)" : "var(--surface)", color: starredOnly ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}>
              ★ Starred
            </button>
            <input value={tableSearch} onChange={e => setTableSearch(e.target.value)} placeholder="Search…" style={{ width: 180, padding: "6px 12px" }} />
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center" }}><span className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <p style={{ padding: 32, textAlign: "center", fontSize: "0.875rem", color: "var(--faint)" }}>
              {contacts.length === 0 ? "No contacts yet — search Companies House above to add some." : "No contacts match these filters."}
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "10px 16px", width: 36 }}>
                    <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={selectAll} style={{ width: 14, height: 14, cursor: "pointer" }} />
                  </th>
                  {["Company", "Director", "Stage", "Last updated", ""].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--faint)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const director = c.directors?.find(d => !d.resignedOn) ?? c.directors?.[0];
                  const selected = selectedIds.has(c.id);
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border)", background: selected ? "var(--accent-dim)" : i % 2 === 0 ? "transparent" : "var(--surface-2)", cursor: "pointer" }} onClick={() => router.push(`/contact/${c.id}`)}>
                      <td style={{ padding: "12px 16px" }} onClick={e => { e.stopPropagation(); toggleSelect(c.id); }}>
                        <input type="checkbox" checked={selected} onChange={() => {}} style={{ width: 14, height: 14, cursor: "pointer" }} />
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button onClick={e => { e.stopPropagation(); toggleStar(c.id, c.starred); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", color: c.starred ? "var(--accent)" : "var(--faint)", flexShrink: 0 }}>
                            {c.starred ? "★" : "☆"}
                          </button>
                          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                            {toTitleCase(c.ch?.companyName ?? "Unknown")}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "0.82rem", color: "var(--muted)" }}>
                        {director ? toTitleCase(director.name.split(",").reverse().join(" ").trim()) : "—"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className={`badge ${STAGE_BADGE[c.status]}`}>{PIPELINE_STAGE_LABELS[c.status]}</span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "0.78rem", color: "var(--faint)" }}>
                        {daysSince(c.updatedAt) === 0 ? "Today" : `${daysSince(c.updatedAt)}d ago`}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button onClick={e => { e.stopPropagation(); router.push(`/contact/${c.id}`); }} className="btn btn-ghost btn-sm">View →</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  );
}
