'use client';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const initial = saved || 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      style={{
        background: 'transparent',
        border: '1px solid var(--border-2)',
        borderRadius: 'var(--radius)',
        padding: '6px 10px',
        cursor: 'pointer',
        color: 'var(--muted)',
        fontSize: '0.8rem',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.04em',
        transition: 'color 0.2s, border-color 0.2s',
        lineHeight: 1,
      }}
    >
      {theme === 'dark' ? '◑ light' : '◑ dark'}
    </button>
  );
}
