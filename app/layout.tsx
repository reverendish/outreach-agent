import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Outreach Agent",
  description: "CRM and outreach automation for UK businesses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
