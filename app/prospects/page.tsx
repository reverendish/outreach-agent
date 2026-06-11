"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Shell from "../../components/Shell";
import { crmApi, type Prospect, type ProspectStatus } from "../lib/api";

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function daysSince(iso: string | null) {
  if (!iso || iso === "NONE") return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

const STATUSES: Array<{ value: ProspectStatus | "all"; label: string }> = [
  { value: "all",       label: "All"       },
  { value: "new",       label: "New"       },
  { value: "contacted", label: "Contacted" },
  { value: "replied",   label: "Replied"   },
  { value: "converted", label: "Converted" },
  { value: "archived",  label: "Archived"  },
];

const STATUS_BADGE: Record<string, string> = {
  new:       "badge-blue",
  contacted: "badge-amber",
  replied:   "badge-amber",
  converted: "badge-green",
  archived:  "badge-grey",
};

const REPLY_BADGE: Record<string, string> = {
  positive: "badge-green",
  negative: "badge-red",
  none:     "badge-grey",
};

export default function ProspectsPage() {
  const router = useRouter();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [filter, setFilter] = useState<ProspectStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { prospects: all } = await crmApi.list(filter === "all" ? undefined : filter);
      setProspects(all);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const visible = search.trim()
    ? prospects.filter(p =>
        p.companyName.toLowerCase().includes(search.toLowerCase()) ||
        p.companyNumber.includes(search)
      )
    : prospects;

  return (
    <Shell>
      <div style={{ maxWidth: 900 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
              Prospects
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
              {prospects.length} {filter === "all" ? "total" : filter}
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => router.push("/search")}>
            + Add prospects
          </button>
        </div>

        {/* Filter tabs */}
        <div className="tab-bar">
          {STATUSES.map(s => (
            <button
              key={s.value}
              className={`tab-item${filter === s.value ? " active" : ""}`}
              onClick={() => setFilter(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by name or number…"
            style={{ width: 280 }}
          />
        </div>

        {/* Error */}
        {error && (
          <p style={{ color: "var(--status-red)", fontSize: "0.875rem", marginBottom: 16 }}>{error}</p>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <span className="spinner" style={{ width: 24, height: 24 }} />
          </div>
        ) : visible.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--faint)" }}>
              {search ? "No matches." : "No prospects yet. Search for companies to add them."}
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 90px 90px 80px 80px 90px",
              gap: 12,
              padding: "10px 20px",
              borderBottom: "1px solid var(--border)",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "var(--faint)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              <span>Company</span>
              <span>Status</span>
              <span>Contacted</span>
              <span>Emails</span>
              <span>Reply</span>
              <span></span>
            </div>

            {visible.map((p, i) => {
              const contactedDays = daysSince(p.contactedAt);
              return (
                <div
                  key={p.companyNumber}
                  onClick={() => router.push(`/prospect/${p.companyNumber}`)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 90px 80px 80px 90px",
                    gap: 12,
                    padding: "13px 20px",
                    borderBottom: i < visible.length - 1 ? "1px solid var(--border)" : "none",
                    cursor: "pointer",
                    alignItems: "center",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                      {toTitleCase(p.companyName)}
                    </p>
                    <p style={{ fontSize: "0.72rem", color: "var(--faint)", marginTop: 1 }}>
                      {p.companyNumber}
                      {p.chData?.sic ? ` · ${p.chData.sic.slice(0, 40)}` : ""}
                    </p>
                  </div>

                  <span className={`badge ${STATUS_BADGE[p.status] || "badge-grey"}`}>
                    {p.status}
                  </span>

                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                    {contactedDays === null ? "—" : contactedDays === 0 ? "Today" : `${contactedDays}d ago`}
                  </span>

                  <span style={{ fontSize: "0.82rem", color: p.emailsSent > 0 ? "var(--text)" : "var(--faint)" }}>
                    {p.emailsSent || 0}
                  </span>

                  <span className={`badge ${REPLY_BADGE[p.replyStatus || "none"]}`}>
                    {p.replyStatus === "none" ? "—" : p.replyStatus}
                  </span>

                  <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => router.push(`/compose?company=${p.companyNumber}`)}
                    >
                      Compose
                    </button>
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
