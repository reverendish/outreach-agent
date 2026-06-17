"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Shell from "../../../components/Shell";
import * as api from "../../../src/api";
import type { Contact, PipelineStage, Note, EmailDraft } from "../../../src/types";
import { PIPELINE_STAGE_LABELS } from "../../../src/types";

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatDirectorName(rawName: string) {
  const parts = rawName.split(",");
  return parts.length >= 2
    ? `${parts.slice(1).join(" ").trim()} ${parts[0].trim()}`
    : rawName;
}

type Tab = "overview" | "enrichment" | "emails" | "notes";

const STAGE_CLS: Record<PipelineStage, string> = {
  new: "badge-blue", enriched: "badge-blue", draft_ready: "badge-blue",
  review: "badge-amber", contacted: "badge-amber", replied: "badge-amber",
  converted: "badge-green", archived: "badge-grey",
};

export default function ContactCard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState("");
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [stageChanging, setStageChanging] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.contacts.get(id), api.drafts.list(id)])
      .then(([c, d]) => { setContact(c); setDrafts(d); })
      .finally(() => setLoading(false));
  }, [id]);

  const refresh = () => api.contacts.get(id!).then(setContact);

  const toggleStar = async () => {
    if (!contact) return;
    const updated = await api.contacts.patch(id!, { starred: !contact.starred });
    setContact(updated);
  };

  const changeStage = async (status: PipelineStage) => {
    if (!contact) return;
    setStageChanging(true);
    try {
      const updated = await api.contacts.patch(id!, { status, updatedAt: new Date().toISOString() });
      setContact(updated);
    } finally {
      setStageChanging(false);
    }
  };

  const runEnrich = async () => {
    if (!contact) return;
    setEnriching(true);
    setEnrichError("");
    try {
      const data = await api.enrich.run({
        companyNumber: contact.ch?.companyNumber ?? "",
        companyName: contact.ch?.companyName ?? "",
        website: contact.enrichment?.website?.url ?? undefined,
      });
      const now = new Date().toISOString();
      const updated = await api.contacts.patch(id!, {
        enrichment: data.enrichment as Contact["enrichment"],
        lastEnrichedAt: now,
        status: contact.status === "new" ? "enriched" : contact.status,
        updatedAt: now,
      });
      setContact(updated);
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
      id: crypto.randomUUID(),
      text: newNote.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const notes = [note, ...contact.notes];
    const updated = await api.contacts.patch(id!, { notes });
    setContact(updated);
    setNewNote("");
    setSavingNote(false);
  };

  const deleteNote = async (noteId: string) => {
    if (!contact) return;
    const notes = contact.notes.filter(n => n.id !== noteId);
    const updated = await api.contacts.patch(id!, { notes });
    setContact(updated);
  };

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

  const activeDirectors = (contact.directors ?? []).filter(d => !d.resignedOn);

  return (
    <Shell>
      <div style={{ maxWidth: 860 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => router.push("/contacts")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.82rem", marginBottom: 16 }}>
            ← Contacts
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text)" }}>
                  {toTitleCase(contact.ch?.companyName ?? "Unknown company")}
                </h1>
                <span className={`badge ${STAGE_CLS[contact.status]}`}>{PIPELINE_STAGE_LABELS[contact.status]}</span>
                <button onClick={toggleStar} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: contact.starred ? "var(--accent)" : "var(--faint)" }}>
                  {contact.starred ? "★" : "☆"}
                </button>
              </div>
              {contact.ch?.companyNumber && (
                <p style={{ fontSize: "0.78rem", color: "var(--faint)", fontFamily: "var(--font-mono)" }}>
                  CH: {contact.ch.companyNumber}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={runEnrich} disabled={enriching} className="btn btn-ghost">
                {enriching ? <><span className="spinner" /> Enriching</> : "⟳ Enrich"}
              </button>
              <button onClick={() => router.push(`/compose?contactId=${id}`)} className="btn btn-primary">
                + New email
              </button>
            </div>
          </div>
          {enrichError && <p style={{ marginTop: 8, fontSize: "0.82rem", color: "var(--status-red)" }}>{enrichError}</p>}
        </div>

        {/* Stage selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
          {(["new", "enriched", "draft_ready", "contacted", "replied", "converted", "archived"] as PipelineStage[]).map(s => (
            <button key={s} onClick={() => changeStage(s)} disabled={stageChanging} style={{ padding: "5px 12px", borderRadius: 20, fontSize: "0.78rem", fontWeight: contact.status === s ? 600 : 400, border: contact.status === s ? "1px solid var(--accent)" : "1px solid var(--border-2)", background: contact.status === s ? "var(--accent-dim)" : "transparent", color: contact.status === s ? "var(--accent)" : "var(--muted)", cursor: "pointer", opacity: stageChanging ? 0.5 : 1 }}>
              {PIPELINE_STAGE_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          {(["overview", "enrichment", "emails", "notes"] as Tab[]).map(t => (
            <button key={t} className={`tab-item${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === "emails" && drafts.length > 0 && <span className="badge badge-grey" style={{ marginLeft: 6, padding: "1px 6px" }}>{drafts.length}</span>}
              {t === "notes" && contact.notes.length > 0 && <span className="badge badge-grey" style={{ marginLeft: 6, padding: "1px 6px" }}>{contact.notes.length}</span>}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === "overview" && (
          <div style={{ display: "grid", gap: 20 }}>
            {contact.ch && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Companies House</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
                  <Kv label="Type" value={contact.ch.companyType.replace(/-/g, " ")} />
                  <Kv label="Status" value={contact.ch.status} />
                  <Kv label="Incorporated" value={contact.ch.incorporationDate ? new Date(contact.ch.incorporationDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"} />
                  <Kv label="SIC" value={contact.ch.sicDescriptions?.[0] ?? contact.ch.sicCodes?.[0] ?? "—"} />
                  <div>
                    <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Address</p>
                    <p style={{ fontSize: "0.875rem", color: "var(--text)", lineHeight: 1.6 }}>
                      {[contact.ch.registeredAddress?.addressLine1, contact.ch.registeredAddress?.locality, contact.ch.registeredAddress?.postalCode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeDirectors.length > 0 && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Directors</h2>
                <div style={{ display: "grid", gap: 10 }}>
                  {activeDirectors.map(d => (
                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-2)", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{formatDirectorName(d.name)}</p>
                        <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{d.role} · Appointed {d.appointedOn ? new Date(d.appointedOn).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"}</p>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {d.email && (
                          <a href={`mailto:${d.email}`} style={{ fontSize: "0.8rem", color: "var(--accent)" }}>
                            {d.email}
                            {d.emailConfidence && <span style={{ marginLeft: 4, fontSize: "0.68rem", color: "var(--faint)" }}>({d.emailConfidence})</span>}
                          </a>
                        )}
                        {d.linkedinUrl && (
                          <a href={d.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.8rem", color: "var(--status-blue)" }}>LinkedIn ↗</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {contact.enrichment && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Enrichment summary</h2>
                  <button onClick={() => setTab("enrichment")} className="btn btn-ghost btn-sm">Full detail →</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                  {contact.enrichment.gbp?.reviewRating && <Kv label="GBP rating" value={`${contact.enrichment.gbp.reviewRating}/5 (${contact.enrichment.gbp.reviewCount} reviews)`} />}
                  {contact.enrichment.website?.url && <Kv label="Website" value={contact.enrichment.website.isActive ? "Active" : "Inactive"} />}
                  {contact.enrichment.companySize?.employeeEstimate && <Kv label="Employees" value={contact.enrichment.companySize.employeeEstimate} />}
                  <Kv label="Confidence" value={`${contact.enrichment.confidenceScore}%`} />
                </div>
                {contact.enrichment.painPoints && contact.enrichment.painPoints.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Pain points (AI)</p>
                    <ul style={{ paddingLeft: 0, listStyle: "none", display: "grid", gap: 4 }}>
                      {contact.enrichment.painPoints.map((pp, i) => (
                        <li key={i} style={{ fontSize: "0.82rem", color: "var(--muted)", display: "flex", gap: 8 }}>
                          <span style={{ color: "var(--faint)", flexShrink: 0 }}>•</span> {pp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {contact.enrichment.whyContactNow && (
                  <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--accent-dim)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-2)" }}>
                    <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Why now</p>
                    <p style={{ fontSize: "0.82rem", color: "var(--text)" }}>{contact.enrichment.whyContactNow}</p>
                  </div>
                )}
              </div>
            )}

            {contact.notes.length > 0 && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Recent note</h2>
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

        {/* Enrichment tab */}
        {tab === "enrichment" && (
          <div style={{ display: "grid", gap: 16 }}>
            {!contact.enrichment ? (
              <div className="card" style={{ padding: 48, textAlign: "center" }}>
                <p style={{ color: "var(--muted)", marginBottom: 16 }}>No enrichment data yet.</p>
                <button onClick={runEnrich} disabled={enriching} className="btn btn-primary">
                  {enriching ? <><span className="spinner" /> Enriching…</> : "⟳ Enrich this contact"}
                </button>
              </div>
            ) : (
              <>
                {contact.enrichment.website && (
                  <EnrichSection title="Website">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                      <Kv label="URL" value={contact.enrichment.website.url ?? "Not found"} />
                      <Kv label="Status" value={contact.enrichment.website.isActive ? "Active" : "Inactive"} />
                      {contact.enrichment.website.title && <Kv label="Title" value={contact.enrichment.website.title} />}
                      {contact.enrichment.website.mobileScore && <Kv label="Mobile" value={contact.enrichment.website.mobileScore} />}
                    </div>
                    {contact.enrichment.website.techStack && contact.enrichment.website.techStack.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", marginBottom: 6 }}>Tech stack</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {contact.enrichment.website.techStack.map(t => <span key={t} className="badge badge-grey">{t}</span>)}
                        </div>
                      </div>
                    )}
                  </EnrichSection>
                )}

                {contact.enrichment.gbp && (
                  <EnrichSection title="Google Business Profile">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                      {contact.enrichment.gbp.reviewRating && <Kv label="Rating" value={`${contact.enrichment.gbp.reviewRating}/5 (${contact.enrichment.gbp.reviewCount} reviews)`} />}
                      {contact.enrichment.gbp.category && <Kv label="Category" value={contact.enrichment.gbp.category} />}
                      {contact.enrichment.gbp.phone && <Kv label="Phone" value={contact.enrichment.gbp.phone} />}
                    </div>
                  </EnrichSection>
                )}

                {contact.enrichment.filings && (
                  <EnrichSection title="Company health">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                      <Kv label="Last confirmation" value={contact.enrichment.filings.lastConfirmationStatement ?? "Unknown"} />
                      <Kv label="Overdue" value={contact.enrichment.filings.confirmationStatementOverdue ? "Yes" : "No"} />
                      <Kv label="Active charges" value={`${contact.enrichment.filings.activeCharges}`} />
                      <Kv label="Dormant" value={contact.enrichment.filings.dormantFlag ? "Yes" : "No"} />
                    </div>
                  </EnrichSection>
                )}

                {contact.enrichment.painPoints && contact.enrichment.painPoints.length > 0 && (
                  <EnrichSection title="Opportunities (AI)">
                    <ul style={{ listStyle: "none", paddingLeft: 0, display: "grid", gap: 6 }}>
                      {contact.enrichment.painPoints.map((p, i) => (
                        <li key={i} style={{ display: "flex", gap: 8, fontSize: "0.875rem", color: "var(--text)" }}>
                          <span style={{ color: "var(--accent)", flexShrink: 0 }}>→</span> {p}
                        </li>
                      ))}
                    </ul>
                    {contact.enrichment.whyContactNow && (
                      <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--accent-dim)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-2)" }}>
                        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Why now</p>
                        <p style={{ fontSize: "0.82rem", color: "var(--text)" }}>{contact.enrichment.whyContactNow}</p>
                      </div>
                    )}
                    <p style={{ fontSize: "0.72rem", color: "var(--faint)", marginTop: 10 }}>AI-synthesised from enrichment data</p>
                  </EnrichSection>
                )}

                <div style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                  <p style={{ fontSize: "0.72rem", color: "var(--faint)" }}>
                    Enriched {contact.lastEnrichedAt ? new Date(contact.lastEnrichedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"} ·
                    Confidence: {contact.enrichment.confidenceScore}% ·
                    Sources: {contact.enrichment.sourcesUsed.join(", ")}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Emails tab */}
        {tab === "emails" && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <button onClick={() => router.push(`/compose?contactId=${id}`)} className="btn btn-primary btn-sm">
                + Generate email
              </button>
            </div>
            {drafts.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: "center" }}>
                <p style={{ color: "var(--muted)" }}>No emails yet for this contact.</p>
              </div>
            ) : (
              drafts.map(d => (
                <div key={d.id} className="card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{d.subject}</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span className={`badge ${d.status === "sent" ? "badge-green" : d.status === "approved" ? "badge-amber" : "badge-grey"}`}>{d.status}</span>
                        {d.isFollowup && <span className="badge badge-blue">Follow-up #{d.followupNumber}</span>}
                        <span style={{ fontSize: "0.72rem", color: "var(--faint)", alignSelf: "center" }}>
                          {d.createdAt ? new Date(d.createdAt).toLocaleDateString("en-GB") : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  <pre style={{ fontFamily: "var(--font)", fontSize: "0.82rem", color: "var(--muted)", whiteSpace: "pre-wrap", lineHeight: 1.7, background: "var(--surface-2)", padding: "14px 16px", borderRadius: "var(--radius-sm)" }}>
                    {d.body}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}

        {/* Notes tab */}
        {tab === "notes" && (
          <div style={{ display: "grid", gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note…"
                rows={3}
                style={{ width: "100%", resize: "vertical", marginBottom: 10 }}
              />
              <button onClick={addNote} disabled={!newNote.trim() || savingNote} className="btn btn-primary btn-sm">
                {savingNote ? "Saving…" : "Add note"}
              </button>
            </div>
            {contact.notes.length === 0 ? (
              <p style={{ color: "var(--faint)", fontSize: "0.875rem", textAlign: "center", padding: 24 }}>No notes yet.</p>
            ) : (
              contact.notes.map(n => (
                <div key={n.id} className="card" style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <p style={{ fontSize: "0.875rem", color: "var(--text)", lineHeight: 1.7, flex: 1 }}>{n.text}</p>
                    <button onClick={() => deleteNote(n.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--faint)", fontSize: "0.875rem", flexShrink: 0 }}>×</button>
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "var(--faint)", marginTop: 8 }}>
                    {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
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

function EnrichSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>{title}</h3>
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
