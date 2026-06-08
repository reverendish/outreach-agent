"use client";
import { useState } from "react";
import Shell from "../../components/Shell";

export default function Campaigns() {
  const [waitDays, setWaitDays] = useState(3);

  return (
    <Shell>
      <div style={{ display: "grid", gap: "24px", maxWidth: "720px" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>Campaigns</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Multi-step outreach sequencer.</p>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "16px" }}>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: "10px", padding: "20px" }}>
              <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--faint)", marginBottom: "8px" }}>Step 1</p>
              <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>Initial Email</p>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Introductory outreach sent to a CRM contact.</p>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ width: "1px", height: "40px", background: "var(--border-2)", margin: "0 auto" }} />
              <p style={{ fontSize: "0.72rem", color: "var(--faint)", margin: "6px 0" }}>{waitDays}d</p>
              <div style={{ width: "1px", height: "40px", background: "var(--border-2)", margin: "0 auto" }} />
            </div>

            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: "10px", padding: "20px" }}>
              <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--faint)", marginBottom: "8px" }}>Step 2</p>
              <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>Follow-up</p>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Secondary message after the wait period.</p>
            </div>
          </div>

          <div style={{ marginTop: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
            <label style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Wait days</label>
            <input
              type="number" min={1} value={waitDays}
              onChange={e => setWaitDays(Number(e.target.value))}
              style={{ width: "80px", padding: "8px 12px", background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: "8px", color: "var(--text)", fontSize: "0.875rem", outline: "none" }}
            />
          </div>
        </div>
      </div>
    </Shell>
  );
}
