"use client";
import { useEffect, useState } from "react";
import Shell from "../../../components/Shell";
import * as api from "../../../src/api";
import type { Account } from "../../../src/types";

export default function AccountSettings() {
  const [account, setAccount] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Local form state
  const [displayName, setDisplayName] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [autoEnrich, setAutoEnrich] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [autoSend, setAutoSend] = useState(false);

  useEffect(() => {
    api.account.get().then(a => {
      setAccount(a);
      setDisplayName(a.displayName ?? a.name ?? "");
      setReplyToEmail(a.replyToEmail ?? a.email ?? "");
      setAutoEnrich(a.automation?.autoEnrich ?? false);
      setAutoGenerate(a.automation?.autoGenerate ?? false);
      setAutoSend(a.automation?.autoSend ?? false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.account.update({
        displayName,
        replyToEmail,
        automation: {
          ...account?.automation,
          autoEnrich,
          autoGenerate,
          autoSend,
          autoFollowup: account?.automation?.autoFollowup ?? false,
        },
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

  const trustRamp = account?.manualSendCount ?? 0;
  const autoSendUnlocked = trustRamp >= 5;

  return (
    <Shell>
      <div style={{ maxWidth: 520 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Account & automation</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Your sending identity and automation settings.</p>
        </div>

        {!account ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><span className="spinner" /></div>
        ) : (
          <div style={{ display: "grid", gap: 20 }}>
            {/* Identity */}
            <div className="card" style={{ padding: 24, display: "grid", gap: 16 }}>
              <h2 style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Identity</h2>
              <div>
                <label style={labelStyle}>Display name</label>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ width: "100%" }} />
              </div>
              <div>
                <label style={labelStyle}>Reply-to email</label>
                <input type="email" value={replyToEmail} onChange={e => setReplyToEmail(e.target.value)} style={{ width: "100%" }} />
                <p style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--faint)" }}>Replies will go to this address. Should match your Google account.</p>
              </div>
            </div>

            {/* Automation toggles */}
            <div className="card" style={{ padding: 24, display: "grid", gap: 14 }}>
              <h2 style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Automation</h2>
              <p style={{ fontSize: "0.78rem", color: "var(--faint)", marginTop: -4 }}>
                Start with manual review. Auto-send unlocks after 5 manually approved emails (trust ramp).
              </p>

              {[
                { key: "autoEnrich", label: "Auto-enrich new contacts", description: "Run enrichment when a contact is added", value: autoEnrich, set: setAutoEnrich, locked: false },
                { key: "autoGenerate", label: "Auto-generate draft", description: "Generate draft email after enrichment completes", value: autoGenerate, set: setAutoGenerate, locked: false },
                { key: "autoSend", label: "Auto-send approved drafts", description: `Requires ${autoSendUnlocked ? "✓ " : ""}5 manual sends (${trustRamp}/5 done)`, value: autoSend, set: setAutoSend, locked: !autoSendUnlocked },
              ].map(t => (
                <div key={t.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ opacity: t.locked ? 0.5 : 1 }}>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{t.label}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--faint)" }}>{t.description}</p>
                  </div>
                  <label style={{ position: "relative", display: "inline-block", width: 40, height: 22, flexShrink: 0, marginLeft: 16, opacity: t.locked ? 0.4 : 1 }}>
                    <input
                      type="checkbox"
                      checked={t.value}
                      onChange={e => !t.locked && t.set(e.target.checked)}
                      disabled={t.locked}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: "absolute", cursor: t.locked ? "not-allowed" : "pointer",
                      inset: 0, borderRadius: 11,
                      background: t.value && !t.locked ? "var(--accent)" : "var(--border-2)",
                      transition: "background 0.2s",
                    }}>
                      <span style={{
                        position: "absolute", content: "", width: 16, height: 16,
                        borderRadius: "50%", background: "var(--bg)", top: 3,
                        left: t.value && !t.locked ? 21 : 3,
                        transition: "left 0.2s",
                      }} />
                    </span>
                  </label>
                </div>
              ))}

              {/* Trust ramp display */}
              <div style={{ marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Trust ramp</p>
                  <p style={{ fontSize: "0.72rem", color: autoSendUnlocked ? "var(--status-green)" : "var(--muted)" }}>
                    {autoSendUnlocked ? "Auto-send unlocked ✓" : `${trustRamp} / 5 manual sends`}
                  </p>
                </div>
                <div style={{ height: 6, background: "var(--border-2)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(trustRamp / 5 * 100, 100)}%`, background: autoSendUnlocked ? "var(--status-green)" : "var(--accent)", borderRadius: 3, transition: "width 0.3s" }} />
                </div>
              </div>
            </div>

            {error && <p style={{ color: "var(--status-red)", fontSize: "0.82rem" }}>{error}</p>}
            <button onClick={save} disabled={saving} className="btn btn-primary" style={{ width: "fit-content" }}>
              {saved ? "Saved ✓" : saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
