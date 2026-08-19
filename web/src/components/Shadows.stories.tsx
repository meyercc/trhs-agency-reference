import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useRef, useState } from 'react';

const meta: Meta = {
  title: 'Atoms/Shadows',
};
export default meta;
type Story = StoryObj;

const LEVELS = [
  { token: '--shadow-lv-1', name: 'Level 1', use: 'Resting cards, list rows' },
  { token: '--shadow-lv-2', name: 'Level 2', use: 'Tooltips, value popups' },
  { token: '--shadow-lv-3', name: 'Level 3', use: 'Panels, dropdowns' },
  { token: '--shadow-lv-4', name: 'Level 4', use: 'Modals, device dialogs' },
];

function ShadowCard({ token, name, use }: (typeof LEVELS)[number]) {
  const ref = useRef<HTMLDivElement>(null);
  const [resolved, setResolved] = useState('');
  // Read the fully-resolved box-shadow from within the card's themed subtree.
  useEffect(() => {
    if (ref.current) setResolved(getComputedStyle(ref.current).boxShadow);
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        ref={ref}
        style={{
          height: 104,
          borderRadius: 'var(--radius-card)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          boxShadow: `var(${token})`,
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 16,
        }}
      >
        {name}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{token}</code>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-muted)' }}>{use}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, lineHeight: 1.4, color: 'var(--text-subtle)', wordBreak: 'break-word' }}>
          {resolved}
        </span>
      </div>
    </div>
  );
}

function ThemeColumn({ label, themeClass }: { label: string; themeClass?: string }) {
  return (
    <div
      className={themeClass}
      style={{
        background: 'var(--bg-base)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {label}
      </span>
      {LEVELS.map((lvl) => (
        <ShadowCard key={lvl.token} {...lvl} />
      ))}
    </div>
  );
}

/** The elevation scale — four soft shadows for layering UI, shown per theme. */
export const Scale: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ width: 760, maxWidth: '100%' }}>
      <p style={{ marginBottom: 24, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        Elevation rises with the level · {'box-shadow: var(--shadow-lv-N)'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <ThemeColumn label="Dark" themeClass="ds-theme-dark" />
        <ThemeColumn label="Light" themeClass="ds-theme-light" />
      </div>
    </div>
  ),
};
