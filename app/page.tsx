"use client";
import { useEffect, useState } from "react";
import Shell from "../components/Shell";

interface Contact { id: string; status: string; emailsSent?: number; }

const STATUSES = ["Cold", "Contacted", "Replied", "Interested", "Closed"];

export default function Dashboard() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sentToday, setSentToday] = useState(0);

  useEffect(() => {
    const c = JSON.parse(localStorage.getItem("contacts") || "[]");
    setContacts(c);
    const emails = JSON.parse(localStorage.getItem("emails") || "[]");
    const today = new Date().toDateString();
    setSentToday(emails.filter((e: { sentAt: string }) => new Date(e.sentAt).toDateString() === today).length);
  }, []);

  const byStatus = STATUSES.map(s => ({ status: s, count: contacts.filter(c => c.status === s).length }));
  const interested = contacts.filter(c => c.status === "Interested").length;

  const statCards = [
    { label: "Total Contacts", value: contacts.length },
    { label: "Emails Sent Today", value: sentToday },
    { label: "Interested", value: interested },
    { label: "Replied", value: contacts.filter(c => c.status === "Replied").length },
  ];

  return (
    <Shell>
      <div style={{ display: "grid", gap: "24px" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>Dashboard</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)" }}>Overview of your outreach activity.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px" }}>
          {statCards.map(s => (
            <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "20px" }}>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "10px" }}>{s.label}</p>
              <p style={{ fontSize: "2rem", fontWeight: 700, color: "var(--text)" }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "24px" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", marginBottom: "16px" }}>Pipeline</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px" }}>
            {byStatus.map(s => (
              <div key={s.status} style={{ background: "var(--surface-2)", borderRadius: "8px", padding: "16px" }}>
                <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "8px" }}>{s.status}</p>
                <p style={{ fontSize: "1.5rem", fontWeight: 700, color: s.count > 0 ? "var(--accent)" : "var(--faint)" }}>{s.count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
