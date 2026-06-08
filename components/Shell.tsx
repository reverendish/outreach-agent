"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const NAV = [
  { href: "/",          label: "Dashboard" },
  { href: "/crm",       label: "CRM" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/settings",  label: "Settings" },
];

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <aside style={{
        width: "220px", flexShrink: 0, background: "var(--surface)",
        borderRight: "1px solid var(--border)", padding: "28px 16px",
        display: "flex", flexDirection: "column", gap: "32px",
      }}>
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--faint)", marginBottom: "6px" }}>
            Outreach Agent
          </p>
          <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>CRM</p>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {NAV.map(n => {
            const active = path === n.href;
            return (
              <Link key={n.href} href={n.href} style={{
                display: "block", padding: "9px 12px", borderRadius: "8px",
                fontSize: "0.875rem", fontWeight: active ? 600 : 400,
                color: active ? "var(--accent)" : "var(--muted)",
                background: active ? "var(--accent-dim)" : "transparent",
                textDecoration: "none", transition: "all 0.15s",
              }}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ marginTop: "auto" }}>
          <a href="https://ishsitotombe.co.uk" style={{ fontSize: "0.78rem", color: "var(--faint)", textDecoration: "none" }}>
            ish.
          </a>
        </div>
      </aside>
      <main style={{ flex: 1, padding: "32px", overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
