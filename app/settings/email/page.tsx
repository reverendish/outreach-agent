"use client";
import { useEffect, useState } from "react";
import Shell from "../../../components/Shell";
import * as api from "../../../src/api";
import type { Account } from "../../../src/types";

export default function EmailSettings() {
  const [account, setAccount] = useState<Account | null>(null);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.account.get().then(a => {
      setAccount(a);
      setFromEmail(a.sending?.fromAddress ?? "");
      setFromName(a.sending?.fromName ?? "");
    });
  }, []);

  const save = async () => {
    if (!account) return;
    setSaving(true);
    setError("");
    try {
      await api.account.update({
        sending: { provider: account.sending?.provider ?? "ses", fromAddress: fromEmail, fromName },
      } as Partial<Account>);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: 6,
  };

  return (
    <Shell>
      <div style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Email sending</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Configure your sending identity.</p>
        </div>

        <div className="card" style={{ padding: 24, display: "grid", gap: 20 }}>
          <div>
            <label style={labelStyle}>From name</label>
            <input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Ish Sitotombe" style={{ width: "100%" }} />
          </div>
          <div>
            <label style={labelStyle}>From email (SES verified)</label>
            <input type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="outreach@yourdomain.com" style={{ width: "100%" }} spellCheck={false} />
            <p style={{ marginTop: 6, fontSize: "0.75rem", color: "var(--faint)" }}>
              Must be a verified identity in AWS SES eu-west-1.
            </p>
          </div>
          <div style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: "var(--radius)", fontSize: "0.78rem", color: "var(--muted)" }}>
            <p style={{ marginBottom: 4, fontWeight: 600, color: "var(--text)" }}>SES setup checklist</p>
            <ul style={{ paddingLeft: 16, display: "grid", gap: 4 }}>
              <li>Verify your sending domain in the AWS SES eu-west-1 console</li>
              <li>Request production access for non-verified recipients</li>
              <li>Ensure Lambda IAM role has <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.85em" }}>sesv2:SendEmail</code></li>
              <li>Set up bounce/complaint notifications via SNS</li>
            </ul>
          </div>
          {error && <p style={{ color: "var(--status-red)", fontSize: "0.82rem" }}>{error}</p>}
          <button onClick={save} disabled={saving} className="btn btn-primary" style={{ width: "fit-content" }}>
            {saved ? "Saved ✓" : saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </Shell>
  );
}
