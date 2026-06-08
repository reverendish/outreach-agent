"use client";
import { useEffect, useState } from "react";
import Shell from "../../components/Shell";

interface Contact {
  id: string;
  name: string;
  company: string;
  address: string;
  sic: string;
  director: string | null;
  status: string;
  email: string | null;
  addedAt: string;
  generatedMessage?: string;
}

const STATUSES = ["Cold", "Contacted", "Replied", "Interested", "Closed"];

const toTitleCase = (str: string) => str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

export default function CRM() {
  const [contacts, setContacts]     = useState<Contact[]>([]);
  const [filter, setFilter]         = useState("All");
  const [query, setQuery]           = useState("");
  const [searching, setSearching]   = useState(false);
  const [results, setResults]       = useState<Contact[]>([]);
  const [searchError, setSearchError] = useState("");
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    setContacts(JSON.parse(localStorage.getItem("contacts") || "[]"));
  }, []);

  const save = (updated: Contact[]) => {
    setContacts(updated);
    localStorage.setItem("contacts", JSON.stringify(updated));
  };

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setResults([]);
    try {
      const res = await fetch(`/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.error) { setSearchError(data.error); return; }
      setResults((data.companies || []).map((c: { name: string; number: string; address: string; sic: string; incorporated: string; type: string }) => ({
        id: c.number,
        name: c.name,
        company: c.name,
        address: c.address,
        sic: c.sic,
        director: null,
        status: "Cold",
        email: null,
        addedAt: new Date().toISOString(),
      })));
    } catch { setSearchError("Search failed."); }
    finally { setSearching(false); }
  };

  const addContact = async (c: Contact) => {
    if (contacts.find(x => x.id === c.id)) return;
    // Fetch director
    try {
      const res = await fetch(`/officers?number=${c.id}`);
      const data = await res.json();
      c.director = data.director || null;
    } catch { /* non-critical */ }
    const updated = [c, ...contacts];
    save(updated);
    setResults(r => r.filter(x => x.id !== c.id));
  };

  const updateStatus = (id: string, status: string) => {
    save(contacts.map(c => c.id === id ? { ...c, status } : c));
  };

  const removeContact = (id: string) => {
    save(contacts.filter(c => c.id !== id));
  };

  const generateMessage = async (c: Contact) => {
    setGenerating(c.id);
    try {
      const res = await fetch("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: c.director || toTitleCase(c.name),
          business: `${toTitleCase(c.name)}, ${c.sic}, ${c.address}`,
          context: "",
        }),
      });
      const data = await res.json();
      save(contacts.map(x => x.id === c.id ? { ...x, generatedMessage: data.result } : x));
    } finally { setGenerating(null); }
  };

  const visible = contacts.filter(c => filter === "All" || c.status === filter);

  const inputStyle: React.CSSProperties = {
    padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border-2)",
    borderRadius: "8px", color: "var(--text)", fontSize: "0.875rem",
    fontFamily: "inherit", outline: "none",
  };

  return (
    <Shell>
      <div style={{ display: "grid", gap: "24px" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>CRM</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Search Companies House to add contacts, generate messages, track status.</p>
        </div>

        {/* Search & import */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "20px" }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "10px" }}>Search & import from Companies House</p>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && search()}
              placeholder="e.g. estate agents Colchester"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={search} disabled={searching || !query.trim()} style={{
              padding: "10px 18px", background: "var(--accent)", color: "#000",
              border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "0.875rem",
              cursor: "pointer",
            }}>
              {searching ? "Searching…" : "Search →"}
            </button>
          </div>
          {searchError && <p style={{ marginTop: "8px", fontSize: "0.85rem", color: "#f87171" }}>{searchError}</p>}
          {results.length > 0 && (
            <div style={{ marginTop: "12px", display: "grid", gap: "6px" }}>
              {results.map(c => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--surface-2)", borderRadius: "8px", border: "1px solid var(--border-2)" }}>
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>{toTitleCase(c.name)}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{c.address}{c.sic ? ` · ${c.sic}` : ""}</p>
                  </div>
                  <button onClick={() => addContact(c)} style={{ fontSize: "0.78rem", padding: "5px 12px", background: "var(--accent)", color: "#000", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {["All", ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: "6px 14px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: filter === s ? 600 : 400,
              border: filter === s ? "1px solid var(--accent)" : "1px solid var(--border-2)",
              background: filter === s ? "var(--accent-dim)" : "var(--surface)",
              color: filter === s ? "var(--accent)" : "var(--muted)", cursor: "pointer",
            }}>{s} {s === "All" ? `(${contacts.length})` : `(${contacts.filter(c => c.status === s).length})`}</button>
          ))}
        </div>

        {/* Contacts table */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
          {visible.length === 0 ? (
            <p style={{ padding: "32px", textAlign: "center", fontSize: "0.875rem", color: "var(--faint)" }}>
              {contacts.length === 0 ? "No contacts yet — search above to add some." : "No contacts match this filter."}
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                  {["Company", "Director", "Address", "Status", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--faint)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((c, i) => (
                  <>
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-2)" }}>
                      <td style={{ padding: "12px 16px", fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                        <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: "0.8rem", marginRight: "8px" }}>
                          {expanded === c.id ? "▲" : "▼"}
                        </button>
                        {toTitleCase(c.name)}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "0.8rem", color: "var(--muted)" }}>{c.director || "—"}</td>
                      <td style={{ padding: "12px 16px", fontSize: "0.78rem", color: "var(--muted)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.address}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <select value={c.status} onChange={e => updateStatus(c.id, e.target.value)} style={{
                          ...inputStyle, padding: "4px 8px", fontSize: "0.78rem",
                        }}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button onClick={() => generateMessage(c)} disabled={generating === c.id} style={{ fontSize: "0.75rem", padding: "4px 10px", background: "transparent", border: "1px solid var(--border-2)", borderRadius: "6px", color: "var(--muted)", cursor: "pointer" }}>
                            {generating === c.id ? "…" : "Generate"}
                          </button>
                          <button onClick={() => removeContact(c.id)} style={{ fontSize: "0.75rem", padding: "4px 10px", background: "transparent", border: "1px solid #f8717120", borderRadius: "6px", color: "#f87171", cursor: "pointer" }}>
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded === c.id && (
                      <tr key={`${c.id}-exp`} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td colSpan={5} style={{ padding: "16px 16px 16px 40px" }}>
                          {c.generatedMessage ? (
                            <div>
                              <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--faint)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Generated message</p>
                              <pre style={{ fontFamily: "monospace", fontSize: "0.82rem", lineHeight: 1.75, color: "var(--text)", whiteSpace: "pre-wrap", background: "var(--surface-2)", padding: "16px", borderRadius: "8px" }}>
                                {c.generatedMessage}
                              </pre>
                              <button onClick={() => { navigator.clipboard.writeText(c.generatedMessage!); }} style={{ marginTop: "8px", fontSize: "0.75rem", padding: "4px 12px", background: "transparent", border: "1px solid var(--border-2)", borderRadius: "6px", color: "var(--muted)", cursor: "pointer" }}>
                                Copy
                              </button>
                            </div>
                          ) : (
                            <p style={{ fontSize: "0.82rem", color: "var(--faint)" }}>No message generated yet — click Generate.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  );
}
