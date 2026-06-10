"use client";
import Shell from "../../../components/Shell";

export default function CredentialsSettings() {
  return (
    <Shell>
      <div style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Integrations</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.6 }}>
            AI generation and company enrichment run server-side — no API keys required from you.
          </p>
        </div>

        <div className="card" style={{ padding: 24, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>Claude (Bedrock)</p>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Email generation and enrichment synthesis</p>
            </div>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "var(--status-green-dim)", color: "var(--status-green)" }}>
              ● Connected
            </span>
          </div>
          <div style={{ height: 1, background: "var(--border)" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>Companies House API</p>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Company search and director lookup</p>
            </div>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "var(--status-green-dim)", color: "var(--status-green)" }}>
              ● Connected
            </span>
          </div>
          <div style={{ height: 1, background: "var(--border)" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>Brave Search</p>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Web enrichment — website, news, social signals</p>
            </div>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "var(--status-green-dim)", color: "var(--status-green)" }}>
              ● Connected
            </span>
          </div>
        </div>
      </div>
    </Shell>
  );
}
