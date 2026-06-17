"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Shell from "../../components/Shell";
import * as api from "../../src/api";
import type { Contact } from "../../src/types";

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

type Step = "setup" | "review" | "sent";

function ComposeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const preselectedContactId = params.get("contactId");

  const [step, setStep] = useState<Step>("setup");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);

  const [contactId, setContactId] = useState(preselectedContactId || "");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [isFollowup, setIsFollowup] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);

  useEffect(() => {
    api.contacts.list()
      .then(setContacts)
      .finally(() => setLoadingContacts(false));
  }, []);

  const selectedContact = contacts.find(c => c.id === contactId) ?? null;
  const primaryDirector = selectedContact?.directors?.find(d => !d.resignedOn) ?? selectedContact?.directors?.[0];

  const handleGenerate = async () => {
    if (!selectedContact) return;
    setGenerating(true);
    setGenError("");
    try {
      const result = await api.generate.draft({
        contact: selectedContact,
        enrichment: selectedContact.enrichment,
        isFollowup,
        followupNumber: isFollowup ? 1 : 0,
      });

      setSubject(result.subject || "");
      setBody(result.body || "");

      const draft = await api.drafts.create({
        contactId: selectedContact.id,
        subject: result.subject || "",
        body: result.body || "",
        status: "draft" as const,
        isFollowup,
        followupNumber: isFollowup ? 1 : 0,
        provider: null,
        sentAt: null,
      });
      setSavedDraftId(draft.id);

      await api.contacts.patch(selectedContact.id, { status: "draft_ready", latestDraftId: draft.id });

      setStep("review");
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!selectedContact || !recipientEmail || !savedDraftId) return;
    setSending(true);
    setSendError("");
    try {
      // Save any edits to the draft first
      await api.drafts.patch(savedDraftId, { subject, body });
      await api.send.email({
        draftId: savedDraftId,
        recipientEmail,
        recipientName: primaryDirector?.name ?? "",
      });
      setStep("sent");
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (savedDraftId) await api.drafts.patch(savedDraftId, { subject, body });
    router.push(selectedContact ? `/contact/${selectedContact.id}` : "/contacts");
  };

  if (step === "sent") {
    return (
      <Shell>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", paddingTop: 80 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>✓</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Email sent</h1>
          <p style={{ color: "var(--muted)", marginBottom: 32 }}>
            {selectedContact ? toTitleCase(selectedContact.ch?.companyName ?? "") : "Contact"} has been contacted.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => { setStep("setup"); setSubject(""); setBody(""); setSavedDraftId(null); }} className="btn btn-ghost">
              Compose another
            </button>
            {selectedContact && (
              <button onClick={() => router.push(`/contact/${selectedContact.id}`)} className="btn btn-primary">
                View contact →
              </button>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ maxWidth: 720, display: "grid", gap: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Compose</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Generate and send an outreach email.</p>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {(["setup", "review"] as Array<"setup" | "review">).map((s, i, arr) => (
            <span key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: "0.78rem", fontWeight: step === s ? 700 : 400, color: step === s ? "var(--accent)" : "var(--faint)", padding: "4px 10px", background: step === s ? "var(--accent-dim)" : "transparent", borderRadius: 20 }}>
                {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
              {i < arr.length - 1 && <span style={{ color: "var(--faint)", fontSize: "0.72rem" }}>→</span>}
            </span>
          ))}
        </div>

        {/* Setup step */}
        {step === "setup" && (
          <div className="card" style={{ padding: 28, display: "grid", gap: 18 }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>Contact</label>
              <select value={contactId} onChange={e => setContactId(e.target.value)} style={{ width: "100%" }} disabled={loadingContacts}>
                <option value="">{loadingContacts ? "Loading…" : "Select a contact"}</option>
                {contacts
                  .filter(c => c.status !== "archived")
                  .sort((a, b) => (a.ch?.companyName ?? "").localeCompare(b.ch?.companyName ?? ""))
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {toTitleCase(c.ch?.companyName ?? "Unknown")}
                      {c.directors?.[0] ? ` — ${c.directors[0].name.split(",")[0]}` : ""}
                    </option>
                  ))}
              </select>
            </div>

            {selectedContact && (
              <>
                <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-2)", fontSize: "0.82rem", color: "var(--muted)", display: "grid", gap: 4 }}>
                  {selectedContact.enrichment?.whyContactNow && (
                    <p><strong style={{ color: "var(--accent)" }}>Why now:</strong> {selectedContact.enrichment.whyContactNow}</p>
                  )}
                  {primaryDirector && <p><strong>Director:</strong> {toTitleCase(primaryDirector.name.split(",").reverse().join(" ").trim())}</p>}
                  {!selectedContact.enrichment && (
                    <p style={{ color: "var(--status-amber)" }}>⚠ No enrichment data — consider enriching first for better emails.</p>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>Recipient email</label>
                  <input type="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="director@company.co.uk" style={{ width: "100%" }} />
                  {primaryDirector?.email && (
                    <button onClick={() => setRecipientEmail(primaryDirector.email!)} style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      Use {primaryDirector.email}
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" id="followup" checked={isFollowup} onChange={e => setIsFollowup(e.target.checked)} />
                  <label htmlFor="followup" style={{ fontSize: "0.82rem", color: "var(--muted)", cursor: "pointer" }}>
                    This is a follow-up email
                  </label>
                </div>
              </>
            )}

            {genError && <p style={{ fontSize: "0.82rem", color: "var(--status-red)" }}>{genError}</p>}

            <button onClick={handleGenerate} disabled={!selectedContact || !recipientEmail || generating} className="btn btn-primary">
              {generating ? <><span className="spinner" /> Generating…</> : "Generate email →"}
            </button>
          </div>
        )}

        {/* Review step */}
        {step === "review" && (
          <div style={{ display: "grid", gap: 16 }}>
            <div className="card" style={{ padding: 24, display: "grid", gap: 14 }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>Subject</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} style={{ width: "100%" }} />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>Body</label>
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={12} style={{ width: "100%", resize: "vertical", fontFamily: "var(--font)", lineHeight: 1.7 }} />
              </div>
              <div style={{ padding: "10px 14px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", fontSize: "0.78rem", color: "var(--muted)" }}>
                Sending to: <strong style={{ color: "var(--text)" }}>{recipientEmail}</strong>
              </div>
            </div>

            {sendError && <p style={{ fontSize: "0.82rem", color: "var(--status-red)" }}>{sendError}</p>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep("setup")} className="btn btn-ghost">← Back</button>
              <button onClick={handleSaveDraft} className="btn btn-ghost">Save draft</button>
              <button onClick={handleSend} disabled={sending} className="btn btn-primary" style={{ marginLeft: "auto" }}>
                {sending ? <><span className="spinner" /> Sending…</> : "Send email ✓"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

export default function Compose() {
  return (
    <Suspense>
      <ComposeInner />
    </Suspense>
  );
}
