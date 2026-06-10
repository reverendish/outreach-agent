"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Shell from "../../../components/Shell";
import { db, newId, getSettings } from "../../../src/db";
import type { Contact, EntityCategory, PipelineStage, Note, EmailDraft } from "../../../src/types";
import { PIPELINE_STAGE_LABELS, mapEntityCategory } from "../../../src/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ─── Helper components ───────────────────────────────────────────────────────

function EntityBadge({ cat }: { cat: EntityCategory }) {
  if (cat === "corporate") return <span className="badge badge-green">● Corporate</span>;
  if (cat === "flagged")   return <span className="badge badge-amber">⚠ Flagged entity</span>;
  return                          <span className="badge badge-red">○ Unregistered</span>;
}

function StageBadge({ stage }: { stage: PipelineStage }) {
  const cls: Record<PipelineStage, string> = {
    new: "badge-blue", enriched: "badge-blue", contacted: "badge-amber",
    replied: "badge-amber", converted: "badge-green", archived: "badge-grey",
  };
  return <span className={`badge ${cls[stage]}`}>{PIPELINE_STAGE_LABELS[stage]}</span>;
}

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatDirectorName(rawName: string) {
  const parts = rawName.split(",");
  if (parts.length >= 2) {
    return `${parts.slice(1).join(" ").trim()} ${parts[0].trim()}`;
  }
  return rawName;
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "enrichment" | "emails" | "notes";

export default function ContactCard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState("");

  // Emails tab
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);

  // Notes
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Stage change
  const [stageChanging, setStageChanging] = useState(false);

  useEffect(() => {
    if (!id) return;
    db.contacts.get(id).then((c) => {
      setContact(c ?? null);
      setLoading(false);
    });
    db.emailDrafts.where("contactId").equals(id).toArray().then(setDrafts);
  }, [id]);

  const refresh = () => {
    db.contacts.get(id!).then((c) => setContact(c ?? null));
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const toggleStar = async () => {
    if (!contact) return;
    const starred = !contact.starred;
    await db.contacts.update(id!, { starred });
    setContact({ ...contact, starred });
  };

  const changeStage = async (status: PipelineStage) => {
    if (!contact) return;
    setStageChanging(true);
    await db.contacts.update(id!, { status, updatedAt: new Date().toISOString() });
    setContact({ ...contact, status });
    setStageChanging(false);
  };

  const enrich = async () => {
    if (!contact) return;
    setEnriching(true);
    setEnrichError("");
    try {
      const res = await fetch(`${API_URL}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyNumber: contact.ch?.companyNumber,
          companyName: contact.ch?.companyName,
          website: contact.enrichment?.website?.url ?? null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Save snapshot of old enrichment
      const now = new Date().toISOString();
      const update: Partial<Contact> = {
        enrichment: data.enrichment,
        lastEnrichedAt: now,
        status: contact.status === "new" ? "enriched" : contact.status,
        updatedAt: now,
      };
      if (contact.enrichment) {
        update.enrichmentHistory = [
          { snapshotDate: contact.lastEnrichedAt ?? now, enrichment: contact.enrichment, changesSummary: data.changesSummary ?? "" },
          ...contact.enrichmentHistory.slice(0, 9),
        ];
      }
      await db.contacts.update(id!, update);
      refresh();
    } catch (e: unknown) {
      setEnrichError(e instanceof Error ? e.message : "Enrichment failed.");
    } finally {
      setEnriching(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !contact) return;
    setSavingNote(true);
    const note: Note = {
      id: newId(),
      text: newNote.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const notes = [note, ...contact.notes];
    await db.contacts.update(id!, { notes });
    setContact({ ...contact, notes });
    setNewNote("");
    setSavingNote(false);
  };

  const deleteNote = async (noteId: string) => {
    if (!contact) return;
    const notes = contact.notes.filter(n => n.id !== noteId);
    await db.contacts.update(id!, { notes });
    setContact({ ...contact, notes });
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
          <span className="spinner" />
        </div>
      </Shell>
    );
  }

  if (!contact) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: 64 }}>
          <p style={{ color: "var(--muted)" }}>Contact not found.</p>
          <button onClick={() => router.push("/contacts")} className="btn btn-ghost" style={{ marginTop: 16 }}>← Back to contacts</button>
        </div>
      </Shell>
    );
  }

  const entityCat = contact.ch?.entityCategory ?? "unregistered";
  const activeDirectors = contact.directors.filter(d => !d.resignedOn);

  return (
    <Shell>
      <div style={{ maxWidth: 860 }}>
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          {/* Back */}
          <button
            onClick={() => router.push("/contacts")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.82rem", marginBottom: 16 }}
          >
            ← Contacts
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            {/* Title block */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text)" }}>
                  {toTitleCase(contact.ch?.companyName ?? "Unknown company")}
                </h1>
                <EntityBadge cat={entityCat} />
                <StageBadge stage={contact.status} />
                <button
                  onClick={toggleStar}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: contact.starred ? "var(--accent)" : "var(--faint)" }}
                >
                  {contact.starred ? "★" : "☆"}
                </button>
              </div>
              {contact.ch?.companyNumber && (
                <p style={{ fontSize: "0.78rem", color: "var(--faint)", fontFamily: "var(--font-mono)" }}>
                  CH: {contact.ch.companyNumber}
                </p>
              )}
            </div>

            {/* Quick actions */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={enrich}
                disabled={enriching}
                className="btn btn-ghost"
              >
                {enriching ? <><span className="spinner" /> Enriching</> : "⟳ Enrich"}
              </button>
              <button
                onClick={() => { setTab("emails"); /* TODO: trigger new email */ }}
                className="btn btn-primary"
              >
                + New email
              </button>
            </div>
          </div>

          {enrichError && (
            <p style={{ marginTop: 8, fontSize: "0.82rem", color: "var(--status-red)" }}>{enrichError}</p>
          )}
        </div>

        {/* ── Stage selector ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
          {(["new", "enriched", "contacted", "replied", "converted", "archived"] as PipelineStage[]).map(s => (
            <button
              key={s}
              onClick={() => changeStage(s)}
              disabled={stageChanging}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                fontSize: "0.78rem",
                fontWeight: contact.status === s ? 600 : 400,
                border: contact.status === s ? "1px solid var(--accent)" : "1px solid var(--border-2)",
                background: contact.status === s ? "var(--accent-dim)" : "transparent",
                color: contact.status === s ? "var(--accent)" : "var(--muted)",
                cursor: "pointer",
                opacity: stageChanging ? 0.5 : 1,
              }}
            >
              {PIPELINE_STAGE_LABELS[s]}
            </button>
          ))}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="tab-bar">
          {(["overview", "enrichment", "emails", "notes"] as Tab[]).map(t => (
            <button key={t} className={`tab-item${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === "emails" && drafts.length > 0 && (
                <span className="badge badge-grey" style={{ marginLeft: 6, padding: "1px 6px" }}>{drafts.length}</span>
              )}
              {t === "notes" && contact.notes.length > 0 && (
                <span className="badge badge-grey" style={{ marginLeft: 6, padding: "1px 6px" }}>{contact.notes.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: Overview */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {tab === "overview" && (
          <div style={{ display: "grid", gap: 20 }}>
            {/* CH core data */}
            {contact.ch && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
                  Companies House
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
                  {[
                    { label: "Company type", value: contact.ch.companyType.replace(/-/g, " ") },
                    { label: "Status", value: contact.ch.status },
                    { label: "Incorporated", value: contact.ch.incorporationDate ? new Date(contact.ch.incorporationDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—" },
                    { label: "SIC", value: contact.ch.sicDescriptions[0] ?? contact.ch.sicCodes[0] ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</p>
                      <p style={{ fontSize: "0.875rem", color: "var(--text)", textTransform: "capitalize" }}>{value}</p>
                    </div>
                  ))}
                  <div>
                    <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Registered address</p>
                    <p style={{ fontSize: "0.875rem", color: "var(--text)", lineHeight: 1.6 }}>
                      {[contact.ch.registeredAddress.addressLine1, contact.ch.registeredAddress.locality, contact.ch.registeredAddress.postalCode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Directors */}
            {activeDirectors.length > 0 && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
                  Directors
                </h2>
                <div style={{ display: "grid", gap: 10 }}>
                  {activeDirectors.map(d => (
                    <div
                      key={d.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "var(--surface-2)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-2)",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                          {formatDirectorName(d.name)}
                        </p>
                        <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                          {d.role} · Appointed {d.appointedOn ? new Date(d.appointedOn).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {d.email && (
                          <a href={`mailto:${d.email}`} style={{ fontSize: "0.8rem", color: "var(--accent)" }}>
                            {d.email}
                            {d.emailConfidence && (
                              <span style={{ marginLeft: 4, fontSize: "0.68rem", color: "var(--faint)" }}>
                                ({d.emailConfidence})
                              </span>
                            )}
                          </a>
                        )}
                        {d.phone && (
                          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{d.phone}</span>
                        )}
                        {d.linkedinUrl && (
                          <a href={d.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.8rem", color: "var(--status-blue)" }}>
                            LinkedIn ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Enrichment summary (if available) */}
            {contact.enrichment && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Enrichment summary
                  </h2>
                  <button onClick={() => setTab("enrichment")} className="btn btn-ghost btn-sm">
                    Full detail →
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                  {contact.enrichment.gbp?.reviewRating && (
                    <Kv label="GBP rating" value={`${contact.enrichment.gbp.reviewRating}/5 (${contact.enrichment.gbp.reviewCount} reviews)`} />
                  )}
                  {contact.enrichment.website?.url && (
                    <Kv label="Website" value={contact.enrichment.website.isActive ? "Active" : "Inactive"} />
                  )}
                  {contact.enrichment.companySize?.employeeEstimate && (
                    <Kv label="Employees" value={contact.enrichment.companySize.employeeEstimate} />
                  )}
                  {contact.enrichment.news?.overallSentiment && (
                    <Kv label="News sentiment" value={contact.enrichment.news.overallSentiment} />
                  )}
                  {contact.enrichment.activeJobPostings?.count != null && (
                    <Kv label="Job postings" value={`${contact.enrichment.activeJobPostings.count}`} />
                  )}
                  <Kv label="Confidence" value={`${contact.enrichment.confidenceScore}%`} />
                </div>
                {contact.enrichment.painPoints && contact.enrichment.painPoints.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                      Pain points (AI)
                    </p>
                    <ul style={{ paddingLeft: 0, listStyle: "none", display: "grid", gap: 4 }}>
                      {contact.enrichment.painPoints.map((pp, i) => (
                        <li key={i} style={{ fontSize: "0.82rem", color: "var(--muted)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <span style={{ color: "var(--faint)", flexShrink: 0 }}>•</span> {pp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Notes preview */}
            {contact.notes.length > 0 && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Recent note
                  </h2>
                  <button onClick={() => setTab("notes")} className="btn btn-ghost btn-sm">All notes →</button>
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--text)", lineHeight: 1.6 }}>{contact.notes[0].text}</p>
                <p style={{ fontSize: "0.72rem", color: "var(--faint)", marginTop: 6 }}>
                  {new Date(contact.notes[0].createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: Enrichment */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {tab === "enrichment" && (
          <div style={{ display: "grid", gap: 16 }}>
            {!contact.enrichment ? (
              <div className="card" style={{ padding: 48, textAlign: "center" }}>
                <p style={{ color: "var(--muted)", marginBottom: 16 }}>No enrichment data yet.</p>
                <button onClick={enrich} disabled={enriching} className="btn btn-primary">
                  {enriching ? <><span className="spinner" /> Enriching…</> : "⟳ Enrich this contact"}
                </button>
              </div>
            ) : (
              <>
                {/* Website */}
                {contact.enrichment.website && (
                  <EnrichSection title="Website">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                      <Kv label="URL" value={contact.enrichment.website.url ?? "Not found"} />
                      <Kv label="Status" value={contact.enrichment.website.isActive ? "Active" : "Inactive / not found"} />
                      {contact.enrichment.website.title && <Kv label="Title" value={contact.enrichment.website.title} />}
                      {contact.enrichment.website.mobileScore && <Kv label="Mobile" value={contact.enrichment.website.mobileScore} />}
                    </div>
                    {contact.enrichment.website.techStack && contact.enrichment.website.techStack.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", marginBottom: 6 }}>Tech stack</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {contact.enrichment.website.techStack.map(t => (
                            <span key={t} className="badge badge-grey">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </EnrichSection>
                )}

                {/* GBP */}
                {contact.enrichment.gbp && (
                  <EnrichSection title="Google Business Profile">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                      {contact.enrichment.gbp.reviewRating && <Kv label="Rating" value={`${contact.enrichment.gbp.reviewRating}/5 (${contact.enrichment.gbp.reviewCount} reviews)`} />}
                      {contact.enrichment.gbp.category && <Kv label="Category" value={contact.enrichment.gbp.category} />}
                      {contact.enrichment.gbp.phone && <Kv label="Phone" value={contact.enrichment.gbp.phone} />}
                      {contact.enrichment.gbp.isVerified !== null && <Kv label="Verified" value={contact.enrichment.gbp.isVerified ? "Yes" : "No"} />}
                    </div>
                    {contact.enrichment.gbp.recentReviewThemes && contact.enrichment.gbp.recentReviewThemes.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", marginBottom: 6 }}>Review themes</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {contact.enrichment.gbp.recentReviewThemes.map(t => (
                            <span key={t} className="badge badge-grey">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </EnrichSection>
                )}

                {/* Company health */}
                {contact.enrichment.filings && (
                  <EnrichSection title="Company health">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                      <Kv label="Last confirmation statement" value={contact.enrichment.filings.lastConfirmationStatement ?? "Unknown"} />
                      <Kv label="Overdue" value={contact.enrichment.filings.confirmationStatementOverdue ? "Yes" : "No"} />
                      <Kv label="Active charges" value={`${contact.enrichment.filings.activeCharges}`} />
                      <Kv label="Dormant" value={contact.enrichment.filings.dormantFlag ? "Yes" : "No"} />
                    </div>
                    {contact.enrichment.filings.recentDirectorChanges.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", marginBottom: 6 }}>Recent director changes</p>
                        {contact.enrichment.filings.recentDirectorChanges.map((ch, i) => (
                          <p key={i} style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                            {ch.type === "appointment" ? "+" : "−"} {ch.name} ({ch.role}) — {ch.date}
                          </p>
                        ))}
                      </div>
                    )}
                  </EnrichSection>
                )}

                {/* Size & growth */}
                {contact.enrichment.companySize && (
                  <EnrichSection title="Size & growth">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                      {contact.enrichment.companySize.employeeEstimate && <Kv label="Employees" value={contact.enrichment.companySize.employeeEstimate} />}
                      {contact.enrichment.companySize.revenueEstimate && <Kv label="Revenue estimate" value={contact.enrichment.companySize.revenueEstimate} />}
                      {contact.enrichment.companySize.confidence && <Kv label="Confidence" value={contact.enrichment.companySize.confidence} />}
                    </div>
                    {contact.enrichment.activeJobPostings?.count != null && (
                      <div style={{ marginTop: 12 }}>
                        <Kv label="Active job postings" value={`${contact.enrichment.activeJobPostings.count}`} />
                        {contact.enrichment.activeJobPostings.roles && contact.enrichment.activeJobPostings.roles.length > 0 && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                            {contact.enrichment.activeJobPostings.roles.map(r => (
                              <span key={r} className="badge badge-grey">{r}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </EnrichSection>
                )}

                {/* News */}
                {contact.enrichment.news && contact.enrichment.news.articles.length > 0 && (
                  <EnrichSection title="News & press">
                    <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 12 }}>
                      Sentiment: <strong>{contact.enrichment.news.overallSentiment}</strong>
                    </p>
                    {contact.enrichment.news.articles.map((a, i) => (
                      <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < contact.enrichment!.news!.articles.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--accent)", display: "block", marginBottom: 2 }}>
                          {a.headline} ↗
                        </a>
                        <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{a.source} · {a.date}</p>
                      </div>
                    ))}
                  </EnrichSection>
                )}

                {/* Pain points */}
                {contact.enrichment.painPoints && contact.enrichment.painPoints.length > 0 && (
                  <EnrichSection title="Opportunities (AI)">
                    <ul style={{ listStyle: "none", paddingLeft: 0, display: "grid", gap: 6 }}>
                      {contact.enrichment.painPoints.map((p, i) => (
                        <li key={i} style={{ display: "flex", gap: 8, fontSize: "0.875rem", color: "var(--text)" }}>
                          <span style={{ color: "var(--accent)", flexShrink: 0 }}>→</span> {p}
                        </li>
                      ))}
                    </ul>
                    <p style={{ fontSize: "0.72rem", color: "var(--faint)", marginTop: 10 }}>AI-synthesised from enrichment data</p>
                  </EnrichSection>
                )}

                {/* Enrichment meta */}
                <div style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                  <p style={{ fontSize: "0.72rem", color: "var(--faint)" }}>
                    Enriched {contact.lastEnrichedAt ? new Date(contact.lastEnrichedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} ·
                    Confidence: {contact.enrichment.confidenceScore}% ·
                    Sources: {contact.enrichment.sourcesUsed.join(", ")}
                  </p>
                  {contact.enrichmentHistory.length > 0 && (
                    <p style={{ fontSize: "0.72rem", color: "var(--faint)", marginTop: 2 }}>
                      {contact.enrichmentHistory.length} previous snapshot{contact.enrichmentHistory.length !== 1 ? "s" : ""} saved
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: Emails */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {tab === "emails" && (
          <div style={{ display: "grid", gap: 12 }}>
            {drafts.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: "center" }}>
                <p style={{ color: "var(--muted)", marginBottom: 16 }}>No emails yet.</p>
                <button className="btn btn-primary">+ Generate email</button>
              </div>
            ) : (
              drafts.map(d => (
                <div key={d.id} className="card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{d.subject}</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span className={`badge ${d.status === "sent" ? "badge-green" : d.status === "approved" ? "badge-amber" : "badge-grey"}`}>
                          {d.status}
                        </span>
                        <span className="badge badge-ai">AI</span>
                        <span style={{ fontSize: "0.72rem", color: "var(--faint)", alignSelf: "center" }}>
                          {new Date(d.generatedAt).toLocaleDateString("en-GB")}
                        </span>
                      </div>
                    </div>
                    {d.status === "draft" && (
                      <button className="btn btn-ghost btn-sm">Edit & approve</button>
                    )}
                  </div>
                  <pre style={{ fontFamily: "var(--font)", fontSize: "0.82rem", color: "var(--muted)", whiteSpace: "pre-wrap", lineHeight: 1.7, background: "var(--surface-2)", padding: "14px 16px", borderRadius: "var(--radius-sm)" }}>
                    {d.body}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: Notes */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {tab === "notes" && (
          <div style={{ display: "grid", gap: 16 }}>
            {/* Add note */}
            <div className="card" style={{ padding: 20 }}>
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note…"
                rows={3}
                style={{ width: "100%", resize: "vertical", marginBottom: 10 }}
              />
              <button
                onClick={addNote}
                disabled={!newNote.trim() || savingNote}
                className="btn btn-primary btn-sm"
              >
                {savingNote ? "Saving…" : "Add note"}
              </button>
            </div>

            {/* Notes list */}
            {contact.notes.length === 0 ? (
              <p style={{ color: "var(--faint)", fontSize: "0.875rem", textAlign: "center", padding: 24 }}>No notes yet.</p>
            ) : (
              contact.notes.map(n => (
                <div key={n.id} className="card" style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <p style={{ fontSize: "0.875rem", color: "var(--text)", lineHeight: 1.7, flex: 1 }}>{n.text}</p>
                    <button
                      onClick={() => deleteNote(n.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--faint)", fontSize: "0.875rem", flexShrink: 0 }}
                    >
                      ×
                    </button>
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "var(--faint)", marginTop: 8 }}>
                    {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EnrichSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: "0.875rem", color: "var(--text)" }}>{value}</p>
    </div>
  );
}
