"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const NAV = [
  { href: "/search",    label: "Search" },
  { href: "/prospects", label: "Prospects" },
  { href: "/compose",   label: "Compose" },
];

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();

  const isActive = (href: string) => path.startsWith(href);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 200,
        flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 12px",
        gap: 4,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}>
        {/* Wordmark */}
        <div style={{ padding: "0 4px", marginBottom: 28 }}>
          <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--accent)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Outreach
          </p>
          <p style={{ fontSize: "0.68rem", color: "var(--faint)", marginTop: 1 }}>
            ish.
          </p>
        </div>

        {/* Navigation */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  display: "block",
                  padding: "9px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.875rem",
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--accent)" : "var(--muted)",
                  background: active ? "var(--accent-dim)" : "transparent",
                  transition: "all 0.12s",
                }}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <a href="https://ishsitotombe.co.uk" style={{ fontSize: "0.72rem", color: "var(--faint)" }}>
            ishsitotombe.co.uk
          </a>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: "32px 40px", overflowY: "auto", minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
