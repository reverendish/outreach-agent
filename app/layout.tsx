import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import { Source_Serif_4 } from 'next/font/google';
import './globals.css';

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: 'Outreach Agent',
  description: 'UK B2B cold outreach, powered by Companies House data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sourceSerif.variable}>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
