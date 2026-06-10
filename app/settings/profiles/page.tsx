"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Shell from "../../../components/Shell";
import { db, getSettings, saveSettings } from "../../../src/db";
import type { Profile } from "../../../src/types";

export default function ProfilesSettings() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const { activeProfileId } = getSettings();
    setActiveId(activeProfileId);
    db.profiles.toArray().then(setProfiles);
  }, []);

  const setActive = (id: string) => {
    setActiveId(id);
    saveSettings({ activeProfileId: id });
  };

  const deleteProfile = async (id: string) => {
    if (profiles.length <= 1) return; // can't delete last profile
    setDeleting(id);
    await db.profiles.delete(id);
    const updated = profiles.filter((p) => p.id !== id);
    setProfiles(updated);
    if (activeId === id) {
      const next = updated[0];
      setActiveId(next?.id ?? null);
      saveSettings({ activeProfileId: next?.id ?? null });
    }
    setDeleting(null);
  };

  const TONE_LABELS: Record<Profile["emailTone"], string> = {
    professional: "Professional",
    conversational: "Conversational",
    direct: "Direct",
    consultative: "Consultative",
  };

  const LENGTH_LABELS: Record<Profile["emailLength"], string> = {
    short: "Short (3–5 sentences)",
    medium: "Medium (2–3 paragraphs)",
    long: "Long (4+ paragraphs)",
  };

  return (
    <Shell>
      <div style={{ maxWidth: 640 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Profiles</h1>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
              Each profile has its own company context, email style, and style memory.
            </p>
          </div>
          <Link
            href="/settings/profiles/new"
            style={{
              padding: "9px 16px",
              background: "var(--accent)",
              color: "#000",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.875rem",
              fontWeight: 700,
            }}
          >
            + New profile
          </Link>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {profiles.map((p) => (
            <div
              key={p.id}
              style={{
                background: "var(--surface)",
                border: p.id === activeId ? "1px solid var(--accent)" : "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>{p.name}</h2>
                    {p.id === activeId && (
                      <span className="badge badge-green">Active</span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: 10 }}>
                    {p.companyName} · {p.yourName}
                  </p>
                  <p style={{ fontSize: "0.8rem", color: "var(--faint)", marginBottom: 10, lineHeight: 1.6 }}>
                    {p.companyDescription}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="badge badge-grey">{TONE_LABELS[p.emailTone]}</span>
                    <span className="badge badge-grey">{LENGTH_LABELS[p.emailLength]}</span>
                    {p.targetSectors.slice(0, 3).map((s) => (
                      <span key={s} className="badge badge-grey">{s}</span>
                    ))}
                    {p.targetSectors.length > 3 && (
                      <span className="badge badge-grey">+{p.targetSectors.length - 3} more</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {p.id !== activeId && (
                    <button
                      onClick={() => setActive(p.id)}
                      className="btn btn-ghost btn-sm"
                    >
                      Set active
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/settings/profiles/${p.id}`)}
                    className="btn btn-ghost btn-sm"
                  >
                    Edit
                  </button>
                  {profiles.length > 1 && (
                    <button
                      onClick={() => deleteProfile(p.id)}
                      disabled={deleting === p.id}
                      className="btn btn-danger btn-sm"
                    >
                      {deleting === p.id ? "…" : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
