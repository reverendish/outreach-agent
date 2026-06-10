"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "../components/Shell";
import { db } from "../src/db";
import type { Contact, PipelineStage, EmailDraft } from "../src/types";
import { PIPELINE_STAGE_LABELS } from "../src/types";

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

type DashTab = "overview" | "pipeline";

export default function Dashboard() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [tab, setTab] = useState<DashTab>("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      db.contacts.toArray(),
      db.emailDrafts.where("status").anyOf(["draft", "approved"]).toArray(),
    ]).then(([c, d]) => {
      setContacts(c);
      setDrafts(d);
      setLoading(false);
    });
  }, []);

  // ── Follow-up queue ────────────────────────────────────────────────────
  // Contacts in active sequences with overdue nextSendDue
  const followUpQueue = contacts
    .filter(c => {
      if (c.sequenceState?.status !== "active") return false;
      if (!c.sequenceState.nextSendDue) return false;
      return new Date(c.sequenceState.nextSendDue) < new Date();
    })
    .sort((a, b) => {
      if (a.starred !== b.starred) return a.starred ? -1 : 1;
      const aDate = new Date(a.sequenceState!.nextSendDue!).getTime();
      const bDate = new Date(b.sequenceState!.nextSendDue!).getTime();
      return aDate - bDate;
    });

  // ── Manual review queue ─────────────────────────────────────────────────
  const manualReviewQueue = contacts.filter(c => c.sequenceState?.status === "manual_review");

  // ── Stats ──────────────────────────────────────────────────────────────
  const stats = {
    total: contacts.length,
    enriched: contacts.filter(c => c.enrichment).length,
    contacted: contacts.filter(c => ["contacted", "replied", "converted"].includes(c.status)).length,
    replied: contacts.filter(c => c.status === "replied").length,
    converted: contacts.filter(c => c.status === "converted").length,
  };

  const sentToday = drafts.filter(d => {
    if (!d.sentAt) return false;
    return new Date(d.sentAt).toDateString() === new Date().toDateString();
  }).length;

  // ── Pipeline counts ────────────────────────────────────────────────────
  const STAGES: PipelineStage[] = ["new", "enriched", "contacted", "replied", "converted"];
  const pipelineCounts = STAGES.map(s => ({
    stage: s,
    count: contacts.filter(c => c.status === s).length,
  }));

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
        {/* Header */}
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Dashboard</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Your outreach at a glance.</p>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          <button className={`tab-item${tab === "overview" ? " active" : ""}`} onClick={() => setTab("overview")}>Overview</button>
          <button className={`tab-item${tab === "pipeline" ? " active" : ""}`} onClick={() => setTab("pipeline")}>
            Pipeline
          </button>
        </div>

        {/* ═══ Overview ═══ */}
        {tab === "overview" && (
          <div style={{ display: "grid", gap: 20 }}>
            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              {[
                { label: "Total contacts", value: stats.total, color: "var(--text)" },
                { label: "Enriched", value: stats.enriched, color: "var(--status-blue)" },
                { label: "Contacted", value: stats.contacted, color: "var(--status-amber)" },
                { label: "Replied", value: stats.replied, color: "var(--status-green)" },
                { label: "Converted", value: stats.converted, color: "var(--status-green)" },
                { label: "Sent today", value: sentToday, color: "var(--accent)" },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: 20 }}>
                  <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
                  <p style={{ fontSize: "1.8rem", fontWeight: 800, color: s.value > 0 ? s.color : "var(--faint)" }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Follow-up queue */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
                  Follow-up queue
                  {followUpQueue.length > 0 && (
                    <span className="badge badge-amber" style={{ marginLeft: 8 }}>{followUpQueue.length}</span>
                  )}
                </h2>
              </div>
              {followUpQueue.length === 0 ? (
                <p style={{ padding: 24, fontSize: "0.875rem", color: "var(--faint)", textAlign: "center" }}>
                  Nothing overdue. 🎉
                </p>
              ) : (
                <div>
                  {followUpQueue.slice(0, 8).map(c => {
                    const overdueDays = c.sequenceState?.nextSendDue
                      ? daysSince(c.sequenceState.nextSendDue)
                      : 0;
                    return (
                      <div
                        key={c.id}
                        onClick={() => router.push(`/contact/${c.id}`)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 20px",
                          borderBottom: "1px solid var(--border)",
                          cursor: "pointer",
                          transition: "background 0.1s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {c.starred && <span style={{ color: "var(--accent)", fontSize: "0.85rem" }}>★</span>}
                          <div>
                            <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                              {toTitleCase(c.ch?.companyName ?? "Unknown")}
                            </p>
                            <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                              Step {c.sequenceState?.currentStepNumber}
                            </p>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span className="badge badge-red">
                            {overdueDays === 0 ? "Due today" : `${overdueDays}d overdue`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Manual review */}
            {manualReviewQueue.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                  <h2 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>
                    Replies to review
                    <span className="badge badge-amber" style={{ marginLeft: 8 }}>{manualReviewQueue.length}</span>
                  </h2>
                </div>
                {manualReviewQueue.map(c => (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/contact/${c.id}`)}
                    style={{
                      padding: "12px 20px",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                  >
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                      {toTitleCase(c.ch?.companyName ?? "Unknown")}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{c.sequenceState?.pauseReason ?? "Replied — awaiting response"}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Recent contacts */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>Recently added</h2>
                <button onClick={() => router.push("/contacts")} className="btn btn-ghost btn-sm">All contacts →</button>
              </div>
              {contacts.length === 0 ? (
                <p style={{ padding: 24, fontSize: "0.875rem", color: "var(--faint)", textAlign: "center" }}>
                  No contacts yet. <button onClick={() => router.push("/contacts")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: "0.875rem" }}>Add some →</button>
                </p>
              ) : (
                [...contacts]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 5)
                  .map(c => (
                    <div
                      key={c.id}
                      onClick={() => router.push(`/contact/${c.id}`)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 20px",
                        borderBottom: "1px solid var(--border)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {c.starred && <span style={{ color: "var(--accent)", fontSize: "0.85rem" }}>★</span>}
                        <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                          {toTitleCase(c.ch?.companyName ?? "Unknown")}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: "0.72rem", color: "var(--faint)" }}>
                          {daysSince(c.createdAt) === 0 ? "Today" : `${daysSince(c.createdAt)}d ago`}
                        </span>
                        <span className={`badge ${
                          c.status === "new" ? "badge-blue" :
                          c.status === "enriched" ? "badge-blue" :
                          c.status === "contacted" ? "badge-amber" :
                          c.status === "replied" ? "badge-amber" :
                          c.status === "converted" ? "badge-green" : "badge-grey"
                        }`}>
                          {PIPELINE_STAGE_LABELS[c.status]}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* ═══ Pipeline Kanban ═══ */}
        {tab === "pipeline" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, minmax(180px, 1fr))`, gap: 12, overflowX: "auto" }}>
              {pipelineCounts.map(({ stage, count }) => {
                const stageContacts = contacts.filter(c => c.status === stage);
                const colBadge: Record<PipelineStage, string> = {
                  new: "badge-blue", enriched: "badge-blue", contacted: "badge-amber",
                  replied: "badge-amber", converted: "badge-green", archived: "badge-grey",
                };
                return (
                  <div key={stage}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", textTransform: "capitalize" }}>
                        {PIPELINE_STAGE_LABELS[stage]}
                      </span>
                      <span className={`badge ${colBadge[stage]}`} style={{ padding: "2px 7px", fontSize: "0.68rem" }}>{count}</span>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {stageContacts.slice(0, 12).map(c => (
                        <div
                          key={c.id}
                          onClick={() => router.push(`/contact/${c.id}`)}
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            padding: "10px 12px",
                            cursor: "pointer",
                            transition: "border-color 0.1s",
                          }}
                        >
                          {c.starred && <span style={{ color: "var(--accent)", fontSize: "0.75rem" }}>★ </span>}
                          <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                            {toTitleCase((c.ch?.companyName ?? "Unknown").slice(0, 28))}
                          </p>
                          <p style={{ fontSize: "0.7rem", color: "var(--faint)" }}>
                            {daysSince(c.updatedAt)}d in stage
                          </p>
                        </div>
                      ))}
                      {stageContacts.length > 12 && (
                        <p style={{ fontSize: "0.72rem", color: "var(--faint)", textAlign: "center", padding: "6px 0" }}>
                          +{stageContacts.length - 12} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
