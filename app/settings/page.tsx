"use client";
import Link from "next/link";
import Shell from "../../components/Shell";

const SETTINGS_SECTIONS = [
  { href: "/settings/account", label: "Account & automation", description: "Sending identity, automation toggles, trust ramp." },
  { href: "/settings/email", label: "Email sending", description: "SES verified address, fallback to Resend." },
  { href: "/settings/suppression", label: "Suppression list", description: "Opted-out addresses. Manual removal only." },
  { href: "/settings/credentials", label: "Integrations", description: "Bedrock, Companies House, Brave Search — all server-side." },
];

export default function Settings() {
  return (
    <Shell>
      <div style={{ maxWidth: 540 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Settings</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Configure your workspace.</p>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {SETTINGS_SECTIONS.map(s => (
            <Link
              key={s.href}
              href={s.href}
              style={{
                display: "block",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "18px 20px",
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{s.description}</p>
                </div>
                <span style={{ color: "var(--faint)", fontSize: "0.9rem" }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}
