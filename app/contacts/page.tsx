"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Shell from "../../components/Shell";
import { db, newId, getSettings } from "../../src/db";
import type { Contact, PipelineStage, EntityCategory } from "../../src/types";
import { mapEntityCategory, PIPELINE_STAGE_LABELS } from "../../src/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ─── Helpers ────────────────────────────────────────────────────────────────

function entityBadge(cat: EntityCategory) {
  if (cat === "corporate")    return <span className="badge badge-green">● Ltd</span>;
  if (cat === "flagged")      return <span className="badge badge-amber">⚠ Flagged</span>;
  return                             <span className="badge badge-red">○ Unregistered</span>;
}

function stageBadge(stage: PipelineStage) {
  const map: Record<PipelineStage, string> = {
    new:       "badge-blue",
    enriched:  "badge-blue",
    contacted: "badge-amber",
    replied:   "badge-amber",
    converted: "badge-green",
    archived:  "badge-grey",
  };
  return <span className={`badge ${map[stage]}`}>{PIPELINE_STAGE_LABELS[stage]}</span>;
}

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ─── CH search result type ───────────────────────────────────────────────────

interface CHResult {
  name: string;
  number: string;
  type: string;
  incorporated: string;
  address: string;
  sic: string;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Contacts() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stageFilter, setStageFilter] = useState<PipelineStage | "all">("all");
  const [entityFilter, setEntityFilter] = useState<EntityCategory | "all">("all");
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
    db.contacts.toArray().then(setContacts);
  }, []);

  // ── CH Search ──────────────────────────────────────────────────────────────

  const searchCH = async () => {
    if (!chQuery.trim()) return;
    setChSearching(true);
    setChError("");
    setChResults([]);
    try {
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(chQuery)}`);
      const data = await res.json();
      if (data.error) { setChError(data.error); return; }
      setChResults(data.companies ?? []);
    } catch {
      setChError("Search failed. Check your connection.");
    } finally {
      setChSearching(false);
    }
  };

  const addFromCH = async (r: CHResult) => {
    if (contacts.find(c => c.ch?.companyNumber === r.number)) return;
    setAddingId(r.number);
    try {
      const apiUrl = API_URL;
      // Fetch directors
      let directors: Contact["directors"] = [];
      try {
        const dirRes = await fetch(`${apiUrl}/officers?number=${r.number}`);
        const dirData = await dirRes.json();
        directors = (dirData.officers ?? []).map((o: {
          name: string; officer_role: string; appointed_on: string;
          resigned_on?: string; nationality?: string; country_of_residence?: string;
          date_of_birth?: { month: number; year: number };
        }) => ({
          id: newId(),
          name: o.name,
          role: o.officer_role,
          appointedOn: o.appointed_on,
          resignedOn: o.resigned_on ?? null,
          nationality: o.nationality ?? null,
          countryOfResidence: o.country_of_residence ?? null,
          dateOfBirth: o.date_of_birth ?? null,
          address: null,
          email: null,
          emailConfidence: null,
          phone: null,
          phoneSource: null,
          linkedinUrl: null,
          linkedinData: null,
        }));
      } catch { /* non-critical */ }

      const entityCategory = mapEntityCategory(r.type);
      const contact: Contact = {
        id: newId(),
        source: "ch_search",
        status: "new",
        starred: false,
        tags: [],
        ch: {
          companyNumber: r.number,
          companyName: r.name,
          companyType: r.type,
          entityCategory,
          registeredAddress: {
            addressLine1: r.address.split(",")[0]?.trim() ?? "",
            locality: r.address.split(",")[1]?.trim() ?? "",
            postalCode: r.address.split(",").at(-1)?.trim() ?? "",
            country: "United Kingdom",
          },
          incorporationDate: r.incorporated,
          sicCodes: [],
          sicDescriptions: r.sic ? [r.sic] : [],
          status: "active",
        },
        directors,
        enrichment: null,
        enrichmentHistory: [],
        campaignIds: [],
        sequenceState: null,
        notes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastEnrichedAt: null,
      };

      await db.contacts.add(contact);
      setContacts(prev => [contact, ...prev]);
      setChResults(prev => prev.filter(x => x.number !== r.number));
    } finally {
      setAddingId(null);
    }
  };

  // ── Filtering / sorting ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = contacts;
    if (stageFilter !== "all") list = list.filter(c => c.status === stageFilter);
    if (entityFilter !== "all") list = list.filter(c => c.ch?.entityCategory === entityFilter);
    if (starredOnly) list = list.filter(c => c.starred);
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      list = list.filter(c =>
        c.ch?.companyName.toLowerCase().includes(q) ||
        c.directors[0]?.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [contacts, stageFilter, entityFilter, starredOnly, tableSearch]);

  const toggleStar = async (id: string) => {
    const c = contacts.find(x => x.id === id);
    if (!c) return;
    const starred = !c.starred;
    await db.contacts.update(id, { starred });
    setContacts(prev => prev.map(x => x.id === id ? { ...x, starred } : x));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(c => c.id)));
  };

  const bulkArchive = async () => {
    await db.contacts.bulkPut(
      contacts.filter(c => selectedIds.has(c.id)).map(c => ({ ...c, status: "archived" as PipelineStage }))
    );
    setContacts(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, status: "archived" } : c));
    setSelectedIds(new Set());
  };

  const STAGES: Array<PipelineStage | "all"> = ["all", "new", "enriched", "contacted", "replied", "converted", "archived"];
  const stageCount = (s: PipelineStage | "all") =>
    s === "all" ? contacts.length : contacts.filter(c => c.status === s).length;

  const primaryDirector = (c: Contact) =>
    c.directors.find(d => !d.resignedOn) ?? c.directors[0];

  return (
    <Shell>
      <div style={{ display: "grid", gap: 24 }}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Contacts</h1>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
              {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
              {filtered.length !== contacts.length ? ` · ${filtered.length} shown` : ""}
            </p>
          </div>
          {selectedIds.size > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: "0.82rem", color: "var(--muted)", alignSelf: "center" }}>
                {selectedIds.size} selected
              </span>
              <button onClick={bulkArchive} className="btn btn-ghost btn-sm">Archive</button>
            </div>
          )}
        </div>

        {/* ── CH Search ───────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>
            Search Companies House
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={chQuery}
              onChange={e => setChQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchCH()}
              placeholder="e.g. estate agents Colchester"
              style={{ flex: 1 }}
            />
            <button
              onClick={searchCH}
              disabled={chSearching || !chQuery.trim()}
              className="btn btn-primary"
            >
              {chSearching ? <><span className="spinner" /> Searching</> : "Search →"}
            </button>
          </div>
          {chError && (
            <p style={{ marginTop: 8, fontSize: "0.82rem", color: "var(--status-red)" }}>{chError}</p>
          )}
          {chResults.length > 0 && (
            <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
              {chResults.map(r => {
                const alreadyAdded = contacts.some(c => c.ch?.companyNumber === r.number);
                return (
                  <div key={r.number} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    background: "var(--surface-2)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-2)",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                          {toTitleCase(r.name)}
                        </p>
                        {entityBadge(mapEntityCategory(r.type))}
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        {r.address}{r.sic ? ` · ${r.sic}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => addFromCH(r)}
                      disabled={alreadyAdded || addingId === r.number}
                      className="btn btn-primary btn-sm"
                      style={{ marginLeft: 12, flexShrink: 0 }}
                    >
                      {alreadyAdded ? "Added" : addingId === r.number ? "…" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {/* Stage filter */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {STAGES.map(s => (
              <button
                key={s}
                onClick={() => setStageFilter(s)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: "0.78rem",
                  fontWeight: stageFilter === s ? 600 : 400,
                  border: stageFilter === s ? "1px solid var(--accent)" : "1px solid var(--border-2)",
                  background: stageFilter === s ? "var(--accent-dim)" : "var(--surface)",
                  color: stageFilter === s ? "var(--accent)" : "var(--muted)",
                  cursor: "pointer",
                }}
              >
                {s === "all" ? "All" : PIPELINE_STAGE_LABELS[s]} ({stageCount(s)})
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
            <button
              onClick={() => setStarredOnly(!starredOnly)}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                fontSize: "0.78rem",
                border: starredOnly ? "1px solid var(--accent)" : "1px solid var(--border-2)",
                background: starredOnly ? "var(--accent-dim)" : "var(--surface)",
                color: starredOnly ? "var(--accent)" : "var(--muted)",
                cursor: "pointer",
              }}
            >
              ★ Starred
            </button>
            <input
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              placeholder="Search contacts…"
              style={{ width: 200, padding: "6px 12px" }}
            />
          </div>
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          {filtered.length === 0 ? (
            <p style={{ padding: 32, textAlign: "center", fontSize: "0.875rem", color: "var(--faint)" }}>
              {contacts.length === 0
                ? "No contacts yet — search Companies House above to add some."
                : "No contacts match these filters."}
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "10px 16px", width: 36 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={selectAll}
                      style={{ width: 14, height: 14, cursor: "pointer" }}
                    />
                  </th>
                  {["Company", "Entity", "Director", "Stage", "Last contact", ""].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--faint)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const director = primaryDirector(c);
                  const selected = selectedIds.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: selected
                          ? "var(--accent-dim)"
                          : i % 2 === 0 ? "transparent" : "var(--surface-2)",
                        cursor: "pointer",
                      }}
                      onClick={() => router.push(`/contact/${c.id}`)}
                    >
                      <td style={{ padding: "12px 16px" }} onClick={e => { e.stopPropagation(); toggleSelect(c.id); }}>
                        <input type="checkbox" checked={selected} onChange={() => {}} style={{ width: 14, height: 14, cursor: "pointer" }} />
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            onClick={e => { e.stopPropagation(); toggleStar(c.id); }}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", color: c.starred ? "var(--accent)" : "var(--faint)", flexShrink: 0 }}
                          >
                            {c.starred ? "★" : "☆"}
                          </button>
                          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                            {toTitleCase(c.ch?.companyName ?? "Unknown")}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {entityBadge(c.ch?.entityCategory ?? "unregistered")}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "0.82rem", color: "var(--muted)" }}>
                        {director ? toTitleCase(director.name.split(",").reverse().join(" ").trim()) : "—"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {stageBadge(c.status)}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "0.78rem", color: "var(--faint)" }}>
                        {c.lastEnrichedAt
                          ? `${daysSince(c.lastEnrichedAt)}d ago`
                          : "Never enriched"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          onClick={e => { e.stopPropagation(); router.push(`/contact/${c.id}`); }}
                          className="btn btn-ghost btn-sm"
                        >
                          View →
                        </button>
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
