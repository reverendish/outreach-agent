import Link from 'next/link';

// Public self-service signup has been closed — this app is single-user.
// New accounts are no longer created through this page.
export default function SignupPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '48px 40px', maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <a href="https://ishsitotombe.co.uk" style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', textDecoration: 'none', display: 'block', marginBottom: 32 }}>
          ish
        </a>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          Sign-up is closed
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 24 }}>
          This is a private tool. New accounts aren&apos;t available.
        </p>
        <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem' }}>
          Sign in
        </Link>
      </div>
    </div>
  );
}
