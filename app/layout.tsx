import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Outreach Agent",
  description: "Search any UK company and generate a personalised cold email in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#0a0a0a", color: "#e5e5e5" }}>
        {children}
      </body>
    </html>
  );
}
