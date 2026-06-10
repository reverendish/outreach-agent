"use client";
import Link from "next/link";
import Shell from "../../components/Shell";

const SETTINGS_SECTIONS = [
  { href: "/settings/profiles", label: "Profiles", description: "Manage company contexts, email styles and style memory." },
  { href: "/settings/credentials", label: "AWS & API credentials", description: "AWS keys, Bedrock region, Brave Search API key." },
  { href: "/settings/email", label: "Email sending", description: "SES verified sending address and daily sending limits." },
  { href: "/settings/suppression", label: "Suppression list", description: "Contacts who have opted out. Read-only except for manual removal." },
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
