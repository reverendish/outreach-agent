"use client";
import { useState } from "react";
import ToolShell from "../components/ToolShell";

interface Company {
  name: string;
  number: string;
  type: string;
  incorporated: string;
  address: string;
  sic: string;
}

interface GeneratedMessage {
  company: Company;
  director: string | null;
  message: string;
  loading: boolean;
  error: boolean;
}

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

function BatchMessageCard({ item }: { item: GeneratedMessage }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(item.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ border: "1px solid var(--border-2)", borderRadius: "10px", overflow: "hidden", background: "var(--surface-2)" }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: !item.loading && !item.error ? "pointer" : "default" }}
        onClick={() => !item.loading && !item.error && setOpen(o => !o)}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text)" }}>
            {toTitleCase(item.company.name)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
            {item.director ? `${item.director} · ` : ""}{item.company.address}
          </div>
        </div>
        {item.loading ? (
          <span style={{ fontSize: "0.78rem", color: "var(--faint)" }}>Generating…</span>
        ) : item.error ? (
          <span style={{ fontSize: "0.78rem", color: "#f87171" }}>Failed</span>
        ) : (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={e => { e.stopPropagation(); copy(); }}
              style={{ fontSize: "0.78rem", padding: "4px 12px", background: "transparent", border: `1px solid ${copied ? "var(--accent)" : "var(--border-2)"}`, borderRadius: "6px", color: copied ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <span style={{ fontSize: "0.78rem", color: "var(--faint)" }}>{open ? "▲" : "▼"}</span>
          </div>
        )}
      </div>
      {open && item.message && (
        <div style={{ padding: "14px 16px 16px", borderTop: "1px solid var(--border)", fontFamily: "monospace", fontSize: "0.82rem", lineHeight: 1.8, color: "var(--text)", whiteSpace: "pre-wrap" }}>
          {item.message}
        </div>
      )}
    </div>
  );
}

export default function OutreachAgent() {
  const [query, setQuery]               = useState("");
  const [results, setResults]           = useState<Company[]>([]);
  const [searching, setSearching]       = useState(false);
  const [searchError, setSearchError]   = useState("");
  const [messages, setMessages]         = useState<GeneratedMessage[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [selected, setSelected]         = useState<Company | null>(null);
  const [director, setDirector]         = useState<string | null>(null);
  const [context, setContext]           = useState("");
  const [singleMsg, setSingleMsg]       = useState("");
  const [generating, setGenerating]     = useState(false);
  const [copied, setCopied]             = useState(false);
  const [mode, setMode]                 = useState<"search" | "single" | "batch">("search");

  const fetchDirector = async (number: string): Promise<string | null> => {
    try {
      const res = await fetch(`/officers?number=${number}`);
      const data = await res.json();
      return data.director || null;
    } catch { return null; }
  };

  const generateMessage = async (c: Company, dir: string | null, ctx = ""): Promise<string> => {
    const res = await fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: dir || toTitleCase(c.name),
        business: `${toTitleCase(c.name)}, ${c.sic || c.type}, ${c.address}`,
        context: ctx || `Incorporated ${c.incorporated}`,
      }),
    });
    const data = await res.json();
    return data.result || "Generation failed.";
  };

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setResults([]);
    setMessages([]);
    setSelected(null);
    setMode("search");
    try {
      const res = await fetch(`/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.error) { setSearchError(data.error); return; }
      const companies = data.companies || [];
      setResults(companies);
      if (companies.length === 0) setSearchError("No active companies found. Try a different search.");
    } catch {
      setSearchError("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const selectSingle = async (c: Company) => {
    setSelected(c);
    setMode("single");
    setSingleMsg("");
    setContext("");
    setDirector(null);
    const dir = await fetchDirector(c.number);
    setDirector(dir);
  };

  const generateSingle = async () => {
    if (!selected) return;
    setGenerating(true);
    try {
      const msg = await generateMessage(selected, director, context);
      setSingleMsg(msg);
    } finally {
      setGenerating(false);
    }
  };

  const runBatch = async () => {
    if (results.length === 0) return;
    setBatchRunning(true);
    setMode("batch");
    const initial: GeneratedMessage[] = results.map(c => ({ company: c, director: null, message: "", loading: true, error: false }));
    setMessages([...initial]);
    const updated = [...initial];
    for (let i = 0; i < results.length; i++) {
      const c = results[i];
      try {
        const dir = await fetchDirector(c.number);
        const msg = await generateMessage(c, dir);
        updated[i] = { ...updated[i], director: dir, message: msg, loading: false };
      } catch {
        updated[i] = { ...updated[i], loading: false, error: true };
      }
      setMessages([...updated]);
    }
    setBatchRunning(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", background: "var(--surface)",
    border: "1px solid var(--border-2)", borderRadius: "8px", color: "var(--text)",
    fontSize: "0.9rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const btn = (active: boolean): React.CSSProperties => ({
    padding: "11px 20px", background: active ? "var(--accent)" : "var(--surface-2)",
    color: active ? "#000" : "var(--faint)", border: "none", borderRadius: "8px",
    fontWeight: 700, fontSize: "0.875rem", cursor: active ? "pointer" : "default", transition: "all 0.2s",
  });
  const box: React.CSSProperties = { padding: "24px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" };

  return (
    <ToolShell
      title="Outreach Agent"
      tag="Sales automation"
      description="Search any UK company. Pick one for a single personalised email — or hit Generate all to produce messages for every result at once."
    >
      <div style={{ display: "grid", gap: "20px" }}>

        {/* Search */}
        <div style={box}>
          <h3 style={{ fontWeight: 600, marginBottom: "16px", fontSize: "0.95rem" }}>Search a UK company</h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              placeholder="e.g. estate agents Colchester, cleaning services Essex"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && search()}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={search} disabled={searching || !query.trim()} style={btn(!!query.trim() && !searching)}>
              {searching ? "Searching…" : "Search →"}
            </button>
          </div>
          {searchError && <p style={{ marginTop: "12px", fontSize: "0.85rem", color: "#f87171" }}>{searchError}</p>}
        </div>

        {/* Results */}
        {mode === "search" && results.length > 0 && (
          <div style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <h3 style={{ fontWeight: 600, fontSize: "0.95rem" }}>{results.length} companies found</h3>
              <button onClick={runBatch} disabled={batchRunning} style={btn(!batchRunning)}>
                {batchRunning ? "Generating…" : `Generate all ${results.length} →`}
              </button>
            </div>
            <div style={{ display: "grid", gap: "8px" }}>
              {results.map(c => (
                <button
                  key={c.number}
                  onClick={() => selectSingle(c)}
                  style={{ textAlign: "left", padding: "14px 16px", background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: "8px", cursor: "pointer", width: "100%" }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)", marginBottom: "4px" }}>{toTitleCase(c.name)}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{c.address}{c.sic ? ` · ${c.sic}` : ""}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Single mode */}
        {mode === "single" && selected && (
          <>
            <div style={box}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text)" }}>{toTitleCase(selected.name)}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "2px" }}>
                    {director ? `Director: ${director} · ` : ""}{selected.address}
                  </div>
                </div>
                <button onClick={() => { setMode("search"); setSelected(null); setSingleMsg(""); }} style={{ fontSize: "0.8rem", color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>
                  ← Back
                </button>
              </div>
              <textarea rows={2} placeholder="Optional: extra context (e.g. 'their website looks outdated', 'recently opened new branch')" value={context} onChange={e => setContext(e.target.value)} style={{ ...inputStyle, resize: "vertical", marginBottom: "12px" }} />
              <button onClick={generateSingle} disabled={generating} style={btn(!generating)}>
                {generating ? "Generating…" : "Generate message →"}
              </button>
            </div>
            {singleMsg && (
              <div style={box}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ fontWeight: 600, fontSize: "0.95rem" }}>Your message</h3>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={generateSingle} style={{ fontSize: "0.8rem", padding: "6px 14px", background: "transparent", border: "1px solid var(--border-2)", borderRadius: "6px", color: "var(--muted)", cursor: "pointer" }}>Regenerate</button>
                    <button onClick={() => { navigator.clipboard.writeText(singleMsg); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ fontSize: "0.8rem", padding: "6px 14px", background: "transparent", border: "1px solid var(--border-2)", borderRadius: "6px", color: copied ? "var(--accent)" : "var(--muted)", cursor: "pointer" }}>
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "0.875rem", lineHeight: 1.8, color: "var(--text)", whiteSpace: "pre-wrap" }}>{singleMsg}</div>
              </div>
            )}
          </>
        )}

        {/* Batch mode */}
        {mode === "batch" && messages.length > 0 && (
          <div style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                {batchRunning
                  ? `Generating… ${messages.filter(m => !m.loading).length} / ${messages.length}`
                  : `${messages.length} messages ready — click any to expand`}
              </h3>
              <button onClick={() => { setMode("search"); setMessages([]); }} style={{ fontSize: "0.8rem", color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>
                ← Back
              </button>
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              {messages.map((m, i) => <BatchMessageCard key={i} item={m} />)}
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ padding: "20px", background: "var(--accent-dim)", border: "1px solid rgba(110,231,183,0.2)", borderRadius: "10px" }}>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
            <strong style={{ color: "var(--accent)" }}>Want this end-to-end?</strong> — I can build a version that searches by industry and location, generates in bulk, tracks replies, and follows up automatically. <a href="/#contact" style={{ color: "var(--accent)" }}>Get in touch →</a>
          </p>
        </div>

      </div>
    </ToolShell>
  );
}
