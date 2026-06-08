"use client";
import { ReactNode } from "react";

interface Props {
  title: string;
  tag: string;
  description: string;
  children: ReactNode;
}

export default function ToolShell({ title, tag, description, children }: Props) {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: "80px" }}>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        padding: "0 40px", height: "60px", display: "flex", alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(10,10,10,0.9)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #1f1f1f",
      }}>
        <a href="https://ishsitotombe.co.uk" style={{ fontWeight: 700, fontSize: "1rem", color: "#e5e5e5", textDecoration: "none" }}>ish.</a>
        <a href="https://ishsitotombe.co.uk" style={{ fontSize: "0.875rem", color: "#888", textDecoration: "none" }}>← Back</a>
      </nav>

      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "60px 24px 100px" }}>
        <div style={{ marginBottom: "48px" }}>
          <div style={{
            display: "inline-block", background: "rgba(110,231,183,0.1)", border: "1px solid #6ee7b7",
            color: "#6ee7b7", fontSize: "0.75rem", padding: "4px 12px", borderRadius: "100px",
            letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: "20px",
          }}>{tag}</div>
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "12px", color: "#e5e5e5" }}>{title}</h1>
          <p style={{ color: "#888", fontSize: "1rem", maxWidth: "520px" }}>{description}</p>
        </div>
        {children}
        <div style={{
          marginTop: "64px", padding: "32px", background: "#111", border: "1px solid #1f1f1f",
          borderRadius: "12px", textAlign: "center" as const,
        }}>
          <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: "16px" }}>
            Want this set up and customised for your business?
          </p>
          <a href="https://ishsitotombe.co.uk/#contact" style={{
            display: "inline-block", background: "#6ee7b7", color: "#000", fontWeight: 700,
            padding: "12px 24px", borderRadius: "8px", textDecoration: "none", fontSize: "0.95rem",
          }}>
            Get in touch
          </a>
        </div>
      </div>
    </div>
  );
}
