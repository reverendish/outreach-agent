"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Shell from "../../../components/Shell";
import { db } from "../../../src/db";
import type {
  Campaign,
  Contact,
  Sequence,
  Profile,
  EntityCategory,
} from "../../../src/types";

const STATUS_COLORS: Record<Campaign["status"], string> = {
  draft: "badge-grey",
  active: "badge-green",
  paused: "badge-amber",
  completed: "badge-blue",
};

const TYPE_LABELS: Record<Campaign["type"], string> = {
  initial_outreach: "Initial outreach",
  follow_up_sequence: "Follow-up sequence",
  re_engagement: "Re-engagement",
  partnership_outreach: "Partnership outreach",
  sector_campaign: "Sector campaign",
};

const ENTITY_COLORS: Record<EntityCategory, string> = {
  corporate: "badge-blue",
  flagged: "badge-amber",
  unregistered: "badge-grey",
};

const STAGE_COLORS: Record<string, string> = {
  new: "badge-grey",
  enriched: "badge-blue",
  contacted: "badge-amber",
  replied: "badge-green",
  converted: "badge-green",
  archived: "badge-grey",
};

type ActiveTab = "contacts" | "settings";

export default function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ActiveTab>("contacts");
  const [showAddContacts, setShowAddContacts] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<Campaign["status"] | null>(null);

  const load = async () => {
    const camp = await db.campaigns.get(id);
    if (!camp) { setLoading(false); return; }
    setCampaign(camp);

    const [campContacts, seq, prof, allC] = await Promise.all([
      camp.contactIds.length > 0
        ? db.contacts.where("id").anyOf(camp.contactIds).toArray()
        : Promise.resolve([]),
      camp.sequenceId ? db.sequences.get(camp.sequenceId) : Promise.resolve(undefined),
      db.profiles.get(camp.profileId),
      db.contacts.toArray(),
    ]);

    setContacts(campContacts);
    if (seq) setSequence(seq);
    if (prof) setProfile(prof);
    setAllContacts(allC);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const updateStatus = async (newStatus: Campaign["status"]) => {
    if (!campaign) return;
    setSaving(true);
    const updated = { ...campaign, status: newStatus, updatedAt: new Date().toISOString() };
    await db.campaigns.put(updated);
    setCampaign(updated);
    setSaving(false);
    setConfirmStatus(null);
  };

  const addContacts = async () => {
    if (!campaign || selected.size === 0) return;
    setSaving(true);
    const merged = campaign.contactIds.concat(Array.from(selected));
    const newIds = merged.filter((v, i) => merged.indexOf(v) === i);
    const updated: Campaign = {
      ...campaign,
      contactIds: newIds,
      stats: { ...campaign.stats, total: newIds.length },
      updatedAt: new Date().toISOString(),
    };
    await db.campaigns.put(updated);
    setCampaign(updated);
    setSelected(new Set());
    setShowAddContacts(false);
    setSaving(false);
    await load();
  };

  const removeContact = async (contactId: string) => {
    if (!campaign) return;
    const newIds = campaign.contactIds.filter(c => c !== contactId);
    const updated: Campaign = {
      ...campaign,
      contactIds: newIds,
      stats: { ...campaign.stats, total: newIds.length },
      updatedAt: new Date().toISOString(),
    };
    await db.campaigns.put(updated);
    setCampaign(updated);
    setContacts(prev => prev.filter(c => c.id !== contactId));
  };

  const availableContacts = allContacts.filter(
    c =>
      !campaign?.contactIds.includes(c.id) &&
      (c.ch?.companyName.toLowerCase().includes(search.toLowerCase()) ||
        !search)
  );

  const flaggedCount = contacts.filter(c => c.ch?.entityCategory === "flagged").length;
  const unregisteredCount = contacts.filter(c => c.ch?.entityCategory === "unregistered").length;

  if (loading) {
    return (
      <Shell>
        <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
          <div className="spinner" />
        </div>
      </Shell>
    );
  }

  if (!campaign) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: 64 }}>
          <p style={{ color: "var(--muted)" }}>Campaign not found.</p>
          <button onClick={() => router.push("/campaigns")} className="btn btn-ghost" style={{ marginTop: 12 }}>
            ← Back
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ maxWidth: 800 }}>
        {/* Back */}
        <button onClick={() => router.push("/campaigns")} className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
          ← Campaigns
        </button>

        {/* Campaign header */}
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text)" }}>{campaign.name}</h1>
                <span className={`badge ${STATUS_COLORS[campaign.status]}`}>{campaign.status}</span>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: "0.78rem", color: "var(--muted)" }}>
                <span>{TYPE_LABELS[campaign.type]}</span>
                {profile && <span>Profile: {profile.name}</span>}
                {sequence && <span>Sequence: {sequence.name}</span>}
              </div>
            </div>

            {/* Status controls */}
            <div style={{ display: "flex", gap: 8 }}>
              {campaign.status === "draft" && (
                <button
                  onClick={() => setConfirmStatus("active")}
                  disabled={campaign.contactIds.length === 0}
                  className="btn btn-primary btn-sm"
                  title={campaign.contactIds.length === 0 ? "Add contacts first" : "Activate campaign"}
                >
                  Activate
                </button>
              )}
              {campaign.status === "active" && (
                <button onClick={() => setConfirmStatus("paused")} className="btn btn-ghost btn-sm">
                  Pause
                </button>
              )}
              {campaign.status === "paused" && (
                <button onClick={() => setConfirmStatus("active")} className="btn btn-primary btn-sm">
                  Resume
                </button>
              )}
              {(campaign.status === "active" || campaign.status === "paused") && (
                <button onClick={() => setConfirmStatus("completed")} className="btn btn-ghost btn-sm">
                  Mark complete
                </button>
              )}
            </div>
          </div>

          {/* Confirm status change */}
          {confirmStatus && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--surface-2)", borderRadius: "var(--radius)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: "0.82rem", color: "var(--text)" }}>
                Set status to <strong>{confirmStatus}</strong>?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => updateStatus(confirmStatus)} disabled={saving} className="btn btn-primary btn-sm">
                  Confirm
                </button>
                <button onClick={() => setConfirmStatus(null)} className="btn btn-ghost btn-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
            {[
              { label: "Total", value: campaign.stats.total },
              { label: "Sent", value: campaign.stats.sent },
              { label: "Replied", value: campaign.stats.replied },
              { label: "Opted out", value: campaign.stats.optedOut },
              { label: "Converted", value: campaign.stats.converted },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: "0.68rem", color: "var(--faint)", marginTop: 3 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Entity gating warnings */}
        {flaggedCount > 0 && (
          <div style={{ padding: "10px 16px", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: "var(--radius)", marginBottom: 12, fontSize: "0.82rem", color: "var(--text)" }}>
            ⚠️ <strong>{flaggedCount} flagged</strong> contact{flaggedCount !== 1 ? "s" : ""} (charity/society). Manual review required before sending.
          </div>
        )}
        {unregisteredCount > 0 && (
          <div style={{ padding: "10px 16px", background: "rgba(156,163,175,0.08)", border: "1px solid rgba(156,163,175,0.2)", borderRadius: "var(--radius)", marginBottom: 12, fontSize: "0.82rem", color: "var(--text)" }}>
            ⚠️ <strong>{unregisteredCount} unregistered</strong> contact{unregisteredCount !== 1 ? "s" : ""}. No CH data available — enrichment may be limited.
          </div>
        )}

        {/* LI Assessment */}
        {!campaign.liAssessmentCompleted && (
          <div style={{ padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)" }}>Legitimate Interest Assessment pending</p>
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>Required before activating this campaign for UK GDPR compliance.</p>
            </div>
            <button className="btn btn-ghost btn-sm">Generate LIA →</button>
          </div>
        )}

        {/* Tabs */}
        <div className="tab-bar" style={{ marginBottom: 20 }}>
          <button
            onClick={() => setTab("contacts")}
            className={`tab-item${tab === "contacts" ? " active" : ""}`}
          >
            Contacts ({contacts.length})
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`tab-item${tab === "settings" ? " active" : ""}`}
          >
            Settings
          </button>
        </div>

        {/* Contacts tab */}
        {tab === "contacts" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                {contacts.length} contact{contacts.length !== 1 ? "s" : ""} in this campaign
              </p>
              <button onClick={() => setShowAddContacts(s => !s)} className="btn btn-ghost btn-sm">
                {showAddContacts ? "Cancel" : "+ Add contacts"}
              </button>
            </div>

            {/* Add contacts panel */}
            {showAddContacts && (
              <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: 12 }}>
                  Select contacts to add
                </p>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search contacts…"
                  style={{ width: "100%", marginBottom: 12 }}
                />
                <div style={{ maxHeight: 280, overflowY: "auto", display: "grid", gap: 6 }}>
                  {availableContacts.length === 0 ? (
                    <p style={{ color: "var(--faint)", fontSize: "0.82rem", padding: "12px 0" }}>
                      No contacts available to add.
                    </p>
                  ) : (
                    availableContacts.map(c => (
                      <label
                        key={c.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          background: selected.has(c.id) ? "var(--accent-soft)" : "var(--surface-2)",
                          border: `1px solid ${selected.has(c.id) ? "var(--accent)" : "var(--border)"}`,
                          borderRadius: "var(--radius)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={e => {
                            const s = new Set(selected);
                            e.target.checked ? s.add(c.id) : s.delete(c.id);
                            setSelected(s);
                          }}
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                            {c.ch?.companyName ?? "Unknown"}
                          </p>
                          <p style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                            {c.ch?.entityCategory ?? "—"} · {c.status}
                          </p>
                        </div>
                        {c.ch?.entityCategory && (
                          <span className={`badge ${ENTITY_COLORS[c.ch.entityCategory]}`}>
                            {c.ch.entityCategory}
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>
                {selected.size > 0 && (
                  <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button onClick={() => setSelected(new Set())} className="btn btn-ghost btn-sm">
                      Clear selection
                    </button>
                    <button onClick={addContacts} disabled={saving} className="btn btn-primary btn-sm">
                      Add {selected.size} contact{selected.size !== 1 ? "s" : ""} →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Contacts table */}
            {contacts.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: "center" }}>
                <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: 8 }}>No contacts in this campaign yet.</p>
                <p style={{ fontSize: "0.78rem", color: "var(--faint)" }}>
                  Use the &ldquo;Add contacts&rdquo; button above to enrol contacts.
                </p>
              </div>
            ) : (
              <div className="card" style={{ overflow: "hidden", padding: 0 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                      {["Company", "Entity", "Stage", "Sequence status", ""].map(h => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 16px",
                            textAlign: "left",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "var(--faint)",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(c => (
                      <tr
                        key={c.id}
                        style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                        onClick={() => router.push(`/contact/${c.id}`)}
                      >
                        <td style={{ padding: "12px 16px", fontSize: "0.875rem", color: "var(--text)", fontWeight: 500 }}>
                          {c.ch?.companyName ?? "Unknown"}
                          {c.ch?.companyNumber && (
                            <span style={{ display: "block", fontSize: "0.72rem", color: "var(--faint)", fontFamily: "var(--font-mono)" }}>
                              {c.ch.companyNumber}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {c.ch?.entityCategory ? (
                            <span className={`badge ${ENTITY_COLORS[c.ch.entityCategory]}`}>
                              {c.ch.entityCategory}
                            </span>
                          ) : (
                            <span style={{ color: "var(--faint)", fontSize: "0.78rem" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span className={`badge ${STAGE_COLORS[c.status] ?? "badge-grey"}`}>
                            {c.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {c.sequenceState ? (
                            <span className={`badge ${
                              c.sequenceState.status === "active" ? "badge-green" :
                              c.sequenceState.status === "manual_review" ? "badge-amber" :
                              c.sequenceState.status === "paused" ? "badge-grey" :
                              "badge-blue"
                            }`}>
                              {c.sequenceState.status.replace("_", " ")}
                              {c.sequenceState.status === "active" && ` · step ${c.sequenceState.currentStepNumber}`}
                            </span>
                          ) : (
                            <span style={{ color: "var(--faint)", fontSize: "0.78rem" }}>Not enrolled</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px" }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => removeContact(c.id)}
                            className="btn btn-ghost btn-sm"
                            style={{ color: "var(--status-red)" }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Settings tab */}
        {tab === "settings" && (
          <div className="card" style={{ padding: 24 }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--faint)", marginBottom: 16 }}>
              Campaign settings
            </p>
            {[
              { label: "Campaign ID", value: campaign.id, mono: true },
              { label: "Type", value: TYPE_LABELS[campaign.type] },
              { label: "Profile", value: profile?.name ?? campaign.profileId },
              { label: "Sequence", value: sequence?.name ?? (campaign.sequenceId || "—") },
              { label: "Default email mode", value: campaign.defaultEmailMode.replace(/_/g, " ") },
              { label: "Default email length", value: campaign.defaultEmailLength },
              { label: "Created", value: new Date(campaign.createdAt).toLocaleDateString("en-GB") },
              { label: "Updated", value: new Date(campaign.updatedAt).toLocaleDateString("en-GB") },
            ].map(row => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                  fontSize: "0.875rem",
                }}
              >
                <span style={{ color: "var(--muted)" }}>{row.label}</span>
                <span
                  style={{
                    color: "var(--text)",
                    fontWeight: 500,
                    fontFamily: row.mono ? "var(--font-mono)" : undefined,
                    fontSize: row.mono ? "0.78rem" : undefined,
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}

            <div style={{ marginTop: 20 }}>
              <button
                onClick={async () => {
                  if (confirm("Delete this campaign? This cannot be undone.")) {
                    await db.campaigns.delete(campaign.id);
                    router.push("/campaigns");
                  }
                }}
                className="btn btn-danger btn-sm"
              >
                Delete campaign
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
