"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { useSession, signOut } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/",          label: "Dashboard" },
  { href: "/search",    label: "Search"    },
  { href: "/contacts",  label: "Contacts"  },
  { href: "/compose",   label: "Compose"   },
  { href: "/settings",  label: "Settings"  },
];

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

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
        {/* User badge */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "var(--surface-2)",
          border: "1px solid var(--border-2)",
          borderRadius: "var(--radius-sm)",
          marginBottom: 10,
        }}>
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt={session.user.name ?? ""}
              style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 28, height: 28,
              borderRadius: "50%",
              background: "var(--accent-dim)",
              border: "1px solid var(--border-2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)",
              flexShrink: 0,
            }}>
              {initials}
            </div>
          )}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {session?.user?.name ?? "Signed in"}
            </p>
            <p style={{ fontSize: "0.68rem", color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {session?.user?.email ?? ""}
            </p>
          </div>
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
        <div style={{
          marginTop: "auto",
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "0.72rem",
              color: "var(--faint)",
              padding: 0,
            }}
          >
            sign out
          </button>
          <ThemeToggle />
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: 32, overflowY: "auto", minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
