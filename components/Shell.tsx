"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { db, getSettings, saveSettings } from "../src/db";
import type { Profile } from "../src/types";

const NAV = [
  { href: "/",           label: "Dashboard" },
  { href: "/contacts",   label: "Contacts"  },
  { href: "/campaigns",  label: "Campaigns" },
  { href: "/sequences",  label: "Sequences" },
  { href: "/settings",   label: "Settings"  },
];

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const { activeProfileId, onboardingComplete } = getSettings();
    if (!onboardingComplete) {
      router.push("/onboarding");
      return;
    }
    db.profiles.toArray().then((all) => {
      setProfiles(all);
      const active = all.find((p) => p.id === activeProfileId) ?? all[0] ?? null;
      setActiveProfile(active);
      if (active && active.id !== activeProfileId) {
        saveSettings({ activeProfileId: active.id });
      }
    });
  }, [router]);

  const switchProfile = (p: Profile) => {
    setActiveProfile(p);
    saveSettings({ activeProfileId: p.id });
    setDropdownOpen(false);
  };

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "20px 12px",
        gap: 6,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}>
        {/* Profile badge + dropdown */}
        <div style={{ marginBottom: 10, position: "relative" }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              background: "var(--surface-2)",
              border: "1px solid var(--border-2)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 28, height: 28,
              borderRadius: "50%",
              background: "var(--accent-dim)",
              border: "1px solid rgba(245,166,35,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)",
              flexShrink: 0,
            }}>
              {activeProfile?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div style={{ flex: 1, textAlign: "left", overflow: "hidden" }}>
              <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeProfile?.name ?? "No profile"}
              </p>
              <p style={{ fontSize: "0.68rem", color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeProfile?.companyName ?? "Set up a profile"}
              </p>
            </div>
            <span style={{ color: "var(--faint)", fontSize: "0.6rem" }}>
              {dropdownOpen ? "▲" : "▼"}
            </span>
          </button>

          {/* Profile dropdown */}
          {dropdownOpen && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0, right: 0,
              background: "var(--surface-2)",
              border: "1px solid var(--border-2)",
              borderRadius: "var(--radius-sm)",
              zIndex: 100,
              overflow: "hidden",
              boxShadow: "var(--shadow-lg)",
            }}>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => switchProfile(p)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "9px 12px",
                    background: p.id === activeProfile?.id ? "var(--accent-dim)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    color: p.id === activeProfile?.id ? "var(--accent)" : "var(--text)",
                    fontWeight: p.id === activeProfile?.id ? 600 : 400,
                  }}
                >
                  {p.name}
                  <span style={{ display: "block", fontSize: "0.7rem", color: "var(--muted)", fontWeight: 400 }}>
                    {p.companyName}
                  </span>
                </button>
              ))}
              <div style={{ borderTop: "1px solid var(--border)", padding: "6px 8px" }}>
                <Link
                  href="/settings/profiles/new"
                  onClick={() => setDropdownOpen(false)}
                  style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", padding: "4px 4px" }}
                >
                  + New profile
                </Link>
              </div>
            </div>
          )}
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
            ish.
          </a>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: 32, overflowY: "auto", minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
