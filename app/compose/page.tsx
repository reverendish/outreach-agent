"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Shell from "../../components/Shell";
import { crmApi, generateEmail, sendEmail, type Prospect } from "../lib/api";

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

type Step = "setup" | "generate" | "send";

function ComposeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const preselectedNumber = params.get("company");

  const [step, setStep] = useState<Step>("setup");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loadingProspects, setLoadingProspects] = useState(true);

  // Setup fields
  const [companyNumber, setCompanyNumber] = useState(preselectedNumber || "");
  const [directorName, setDirectorName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [contextNotes, setContextNotes] = useState("");

  // Generated email
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Send state
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    crmApi.list().then(({ prospects: all }) => {
      setProspects(all);
    }).finally(() => setLoadingProspects(false));
  }, []);

  const selectedProspect = prospects.find(p => p.companyNumber === companyNumber) || null;

  async function handleGenerate() {
    if (!selectedProspect) return;
    setGenerating(true);
    setGenError(null);
    try {
      const { result } = await generateEmail({
        name: directorName || "there",
        business: `${toTitleCase(selectedProspect.companyName)}${selectedProspect.chData?.sic ? ` (${selectedProspect.chData.sic})` : ""}`,
        context: contextNotes || "No additional context.",
      });

      // Parse subject + body from result
      const lines = result.trim().split("\n");
      const subjectLine = lines.find(l => l.toLowerCase().startsWith("subject:"));
      setSubject(subjectLine ? subjectLine.replace(/^subject:\s*/i, "").trim() : "Following up");
      setBody(lines.filter(l => !l.toLowerCase().startsWith("subject:")).join("\n").trim());
      setStep("generate");
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!selectedProspect || !recipientEmail) return;
    setSending(true);
    setSendError(null);
    try {
      await sendEmail({
        companyNumber: selectedProspect.companyNumber,
        recipientEmail,
        subject,
        body,
      });
      setSent(true);
      setStep("send");
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  // ── Step: Setup ─────────────────────────────────────────────────────────

  if (step === "setup") {
    return (
      <Shell>
        <div style={{ maxWidth: 600 }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
              Compose Email
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
              Select a prospect, add context, then generate a personalised email.
            </p>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            {/* Company selector */}
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Company *
              </label>
              {loadingProspects ? (
                <p style={{ fontSize: "0.82rem", color: "var(--faint)" }}>Loading prospects…</p>
              ) : (
                <select
                  value={companyNumber}
                  onChange={e => setCompanyNumber(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">Select a company…</option>
                  {prospects
                    .filter(p => p.status !== "archived")
                    .map(p => (
                      <option key={p.companyNumber} value={p.companyNumber}>
                        {toTitleCase(p.companyName)} ({p.companyNumber})
                      </option>
                    ))}
                </select>
              )}
              {selectedProspect && (
                <p style={{ fontSize: "0.72rem", color: "var(--faint)", marginTop: 4 }}>
                  {selectedProspect.chData?.sic || ""} · {selectedProspect.chData?.address || ""}
                </p>
              )}
            </div>

            {/* Director name */}
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Director / contact name
              </label>
              <input
                type="text"
                value={directorName}
                onChange={e => setDirectorName(e.target.value)}
                placeholder="e.g. Sarah, James — leave blank for 'Hi there'"
                style={{ width: "100%" }}
              />
            </div>

            {/* Recipient email */}
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Recipient email *
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                placeholder="director@company.co.uk"
                style={{ width: "100%" }}
              />
            </div>

            {/* Context */}
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Extra context <span style={{ fontWeight: 400, color: "var(--faint)" }}>(optional)</span>
              </label>
              <textarea
                value={contextNotes}
                onChange={e => setContextNotes(e.target.value)}
                placeholder="e.g. Recently moved premises, growing team, runs a café in Colchester…"
                style={{ width: "100%", minHeight: 80, resize: "vertical" }}
              />
            </div>

            {genError && (
              <p style={{ fontSize: "0.875rem", color: "var(--status-red)" }}>{genError}</p>
            )}

            <button
              className="btn btn-primary"
              disabled={!companyNumber || !recipientEmail || generating}
              onClick={handleGenerate}
              style={{ justifyContent: "center" }}
            >
              {generating ? (
                <><span className="spinner" style={{ width: 14, height: 14 }} /> Generating…</>
              ) : "Generate email"}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Step: Review + edit ──────────────────────────────────────────────────

  if (step === "generate") {
    return (
      <Shell>
        <div style={{ maxWidth: 640 }}>
          <div style={{ marginBottom: 24 }}>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => setStep("setup")}>
              ← Back
            </button>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
              Review & Edit
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
              To: <strong>{recipientEmail}</strong> ·{" "}
              {selectedProspect ? toTitleCase(selectedProspect.companyName) : companyNumber}
            </p>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {/* Subject */}
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            {/* Body */}
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                Body
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                style={{ width: "100%", minHeight: 220, resize: "vertical", lineHeight: 1.7, fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}
              />
            </div>

            {sendError && (
              <p style={{ fontSize: "0.875rem", color: "var(--status-red)" }}>{sendError}</p>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn btn-ghost"
                disabled={generating}
                onClick={handleGenerate}
              >
                {generating ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Regenerating…</> : "Regenerate"}
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: "center" }}
                disabled={sending || !subject || !body}
                onClick={handleSend}
              >
                {sending ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Sending…</> : `Send to ${recipientEmail}`}
              </button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Step: Sent ───────────────────────────────────────────────────────────

  return (
    <Shell>
      <div style={{ maxWidth: 520, textAlign: "center", paddingTop: 60 }}>
        <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>✓</div>
        <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
          Email sent
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: 32 }}>
          Sent to {recipientEmail} ·{" "}
          {selectedProspect ? toTitleCase(selectedProspect.companyName) : companyNumber}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button className="btn btn-ghost" onClick={() => router.push("/prospects")}>
            View prospects
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setStep("setup");
              setSubject("");
              setBody("");
              setSent(false);
              setCompanyNumber(preselectedNumber || "");
              setDirectorName("");
              setRecipientEmail("");
              setContextNotes("");
            }}
          >
            Compose another
          </button>
        </div>
      </div>
    </Shell>
  );
}

export default function ComposePage() {
  return (
    <Suspense fallback={<Shell><div style={{ display: "flex", justifyContent: "center", padding: 80 }}><span className="spinner" style={{ width: 24, height: 24 }} /></div></Shell>}>
      <ComposeInner />
    </Suspense>
  );
}
