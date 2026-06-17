"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "../components/Shell";
import * as api from "../src/api";
import type { Contact, PipelineStage } from "../src/types";
import { PIPELINE_STAGE_LABELS, STAGE_NEXT_ACTION } from "../src/types";

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

const STAGE_BADGE: Record<PipelineStage, string> = {
  new: "badge-blue", enriched: "badge-blue", draft_ready: "badge-blue",
  contacted: "badge-amber", review: "badge-amber", replied: "badge-amber",
  converted: "badge-green", archived: "badge-grey",
};

export default function Dashboard() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.contacts.list()
      .then(setContacts)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: contacts.length,
    enriched: contacts.filter(c => c.enrichment).length,
    contacted: contacts.filter(c => ["contacted", "replied", "converted"].includes(c.status)).length,
    replied: contacts.filter(c => c.status === "replied").length,
    converted: contacts.filter(c => c.status === "converted").length,
  };

  // Omotenashi: surface what each contact needs next
  const actionQueue = contacts
    .filter(c => c.status !== "archived" && c.status !== "converted")
    .sort((a, b) => {
      // Starred first, then oldest-updated first
      if (a.starred !== b.starred) return a.starred ? -1 : 1;
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });

  const STAGES: PipelineStage[] = ["new", "enriched", "draft_ready", "contacted", "replied", "converted"];

  if (loading) {
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
          <span className="spinner" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ display: "grid", gap: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Dashboard</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Your outreach at a glance.</p>
        </div>

        {error && (
          <div style={{ padding: 16, background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: "var(--radius-sm)", color: "var(--status-red)", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {[
            { label: "Total", value: stats.total, color: "var(--text)" },
            { label: "Enriched", value: stats.enriched, color: "var(--status-blue)" },
            { label: "Contacted", value: stats.contacted, color: "var(--status-amber)" },
            { label: "Replied", value: stats.replied, color: "var(--status-green)" },
            { label: "Converted", value: stats.converted, color: "var(--status-green)" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: 20 }}>
              <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
              <p style={{ fontSize: "1.8rem", fontWeight: 800, color: s.value > 0 ? s.color : "var(--faint)" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Action queue */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
              Next actions
              {actionQueue.length > 0 && <span className="badge badge-amber" style={{ marginLeft: 8 }}>{actionQueue.length}</span>}
            </h2>
            <button onClick={() => router.push("/contacts")} className="btn btn-ghost btn-sm">
              All contacts →
            </button>
          </div>
          {actionQueue.length === 0 ? (
            <p style={{ padding: 24, fontSize: "0.875rem", color: "var(--faint)", textAlign: "center" }}>
              {contacts.length === 0
                ? <>No contacts yet. <button onClick={() => router.push("/search")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: "0.875rem" }}>Search Companies House →</button></>
                : "All caught up. 🎉"}
            </p>
          ) : (
            actionQueue.slice(0, 10).map(c => {
              const nextAction = STAGE_NEXT_ACTION[c.status];
              const directorName = c.directors?.[0]?.name
                ? toTitleCase(c.directors[0].name.split(",").reverse().join(" ").trim())
                : null;
              return (
                <div
                  key={c.id}
                  onClick={() => router.push(`/contact/${c.id}`)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    {c.starred && <span style={{ color: "var(--accent)", fontSize: "0.85rem", flexShrink: 0 }}>★</span>}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {toTitleCase(c.ch?.companyName ?? "Unknown")}
                      </p>
                      {directorName && (
                        <p style={{ fontSize: "0.72rem", color: "var(--faint)" }}>{directorName}</p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, marginLeft: 12 }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{nextAction}</span>
                    <span className={`badge ${STAGE_BADGE[c.status]}`}>{PIPELINE_STAGE_LABELS[c.status]}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pipeline kanban */}
        <div>
          <h2 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Pipeline</h2>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, minmax(160px, 1fr))`, gap: 10, overflowX: "auto" }}>
            {STAGES.map(stage => {
              const stageContacts = contacts.filter(c => c.status === stage);
              return (
                <div key={stage}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {PIPELINE_STAGE_LABELS[stage]}
                    </span>
                    <span className={`badge ${STAGE_BADGE[stage]}`} style={{ padding: "2px 7px", fontSize: "0.68rem" }}>
                      {stageContacts.length}
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {stageContacts.slice(0, 6).map(c => (
                      <div
                        key={c.id}
                        onClick={() => router.push(`/contact/${c.id}`)}
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 12px", cursor: "pointer" }}
                      >
                        {c.starred && <span style={{ color: "var(--accent)", fontSize: "0.75rem" }}>★ </span>}
                        <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                          {toTitleCase((c.ch?.companyName ?? "Unknown").slice(0, 24))}
                        </p>
                        <p style={{ fontSize: "0.68rem", color: "var(--faint)" }}>{daysSince(c.updatedAt)}d in stage</p>
                      </div>
                    ))}
                    {stageContacts.length > 6 && (
                      <p style={{ fontSize: "0.72rem", color: "var(--faint)", textAlign: "center", padding: "4px 0" }}>
                        +{stageContacts.length - 6} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Shell>
  );
}
