"use client";
import { useEffect, useState } from "react";
import Shell from "../../components/Shell";

export default function Settings() {
  const [smtpHost, setSmtpHost]       = useState("");
  const [smtpUser, setSmtpUser]       = useState("");
  const [smtpPass, setSmtpPass]       = useState("");
  const [dailyLimit, setDailyLimit]   = useState(50);
  const [saved, setSaved]             = useState(false);

  useEffect(() => {
    const s = JSON.parse(localStorage.getItem("settings") || "{}");
    setSmtpHost(s.smtpHost || "");
    setSmtpUser(s.smtpUser || "");
    setSmtpPass(s.smtpPass || "");
    setDailyLimit(s.dailyLimit || 50);
  }, []);

  const save = () => {
    localStorage.setItem("settings", JSON.stringify({ smtpHost, smtpUser, smtpPass, dailyLimit }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", background: "var(--surface-2)",
    border: "1px solid var(--border-2)", borderRadius: "8px", color: "var(--text)",
    fontSize: "0.875rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  const field = (label: string, value: string, onChange: (v: string) => void, type = "text", note?: string) => (
    <div>
      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "6px" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
      {note && <p style={{ marginTop: "4px", fontSize: "0.75rem", color: "#f59e0b" }}>{note}</p>}
    </div>
  );

  return (
    <Shell>
      <div style={{ display: "grid", gap: "24px", maxWidth: "540px" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>Settings</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Configure SMTP and outreach limits.</p>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "24px", display: "grid", gap: "16px" }}>
          {field("SMTP Host", smtpHost, setSmtpHost, "text", undefined)}
          {field("SMTP Username", smtpUser, setSmtpUser)}
          {field("SMTP Password", smtpPass, setSmtpPass, "password")}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "6px" }}>Daily Email Limit</label>
            <input type="number" min={1} value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))} style={{ ...inputStyle, width: "120px" }} />
            <p style={{ marginTop: "4px", fontSize: "0.75rem", color: "#f59e0b" }}>Keep at 50 or below to protect sender reputation.</p>
          </div>
          <button onClick={save} style={{ padding: "11px 20px", background: "var(--accent)", color: "#000", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer", width: "fit-content" }}>
            {saved ? "Saved ✓" : "Save settings"}
          </button>
        </div>
      </div>
    </Shell>
  );
}
