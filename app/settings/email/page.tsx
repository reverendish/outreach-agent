"use client";
import { useEffect, useState } from "react";
import Shell from "../../../components/Shell";
import { getSettings, saveSettings } from "../../../src/db";

export default function EmailSettings() {
  const [sesFrom, setSesFrom] = useState("");
  const [dailyLimit, setDailyLimit] = useState(50);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = getSettings();
    setSesFrom(s.sesFromAddress);
    setDailyLimit(s.dailySendLimit ?? 50);
  }, []);

  const save = () => {
    saveSettings({ sesFromAddress: sesFrom, dailySendLimit: dailyLimit });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "var(--muted)",
    marginBottom: 6,
  };

  return (
    <Shell>
      <div style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Email sending</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
            Configure AWS SES sending settings.
          </p>
        </div>

        <div className="card" style={{ padding: 24, display: "grid", gap: 20 }}>
          <div>
            <label style={labelStyle}>SES verified sending address</label>
            <input
              type="email"
              value={sesFrom}
              onChange={e => setSesFrom(e.target.value)}
              placeholder="outreach@yourdomain.com"
              style={{ width: "100%" }}
              spellCheck={false}
            />
            <p style={{ marginTop: 6, fontSize: "0.75rem", color: "var(--faint)" }}>
              Must be a verified identity in AWS SES. Emails will be sent from this address.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Daily send limit</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="number"
                min={1}
                max={500}
                value={dailyLimit}
                onChange={e => setDailyLimit(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                style={{ width: 100 }}
              />
              <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>emails per day</span>
            </div>
            <p style={{ marginTop: 6, fontSize: "0.75rem", color: "var(--faint)" }}>
              Hard limit applied before sending. AWS SES sandbox is limited to 200/day; production limits vary.
            </p>
          </div>

          <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>
            <div style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: "var(--radius)", marginBottom: 16, fontSize: "0.78rem", color: "var(--muted)" }}>
              <p style={{ marginBottom: 4, fontWeight: 600, color: "var(--text)" }}>SES setup checklist</p>
              <ul style={{ paddingLeft: 16, display: "grid", gap: 4 }}>
                <li>Verify your sending domain or email address in the AWS SES console</li>
                <li>Request production access if you&apos;re sending to non-verified recipients</li>
                <li>Ensure your IAM user has <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.85em" }}>ses:SendEmail</code> permission</li>
                <li>Set up an SNS topic for bounce/complaint notifications</li>
              </ul>
            </div>
          </div>

          <button onClick={save} className="btn btn-primary" style={{ width: "fit-content" }}>
            {saved ? "Saved ✓" : "Save settings"}
          </button>
        </div>
      </div>
    </Shell>
  );
}
