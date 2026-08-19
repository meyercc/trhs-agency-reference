import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Atoms/Typography',
};
export default meta;
type Story = StoryObj;

const SAMPLE = 'The quick brown fox';

interface TypeStyle {
  name: string;
  cls: string;
  specs: string;
}

// The Hadouken type ramp. Brand styles use RBNo3.1 (--font-mono); UI styles
// use the platform UI font (--font-display: Segoe UI · SF Pro).
const RAMP: TypeStyle[] = [
  { name: 'Title 1', cls: 'ds-text-title-1', specs: 'RBNo3.1 Bold · 32/40' },
  { name: 'Title 1 · Caps', cls: 'ds-text-title-1 caps', specs: 'RBNo3.1 Bold · 32/40 · +0.4 · UPPER' },
  { name: 'Title 2', cls: 'ds-text-title-2', specs: 'RBNo3.1 Bold · 24/32' },
  { name: 'Title 2 · Caps', cls: 'ds-text-title-2 caps', specs: 'RBNo3.1 Bold · 24/32 · +0.4 · UPPER' },
  { name: 'Title 3', cls: 'ds-text-title-3', specs: 'RBNo3.1 Bold · 20/26' },
  { name: 'Title 3 · Caps', cls: 'ds-text-title-3 caps', specs: 'RBNo3.1 Bold · 20/26 · +0.4 · UPPER' },
  { name: 'Headline', cls: 'ds-text-headline', specs: 'RBNo3.1 Medium · 16/22' },
  { name: 'Headline · Caps', cls: 'ds-text-headline caps', specs: 'RBNo3.1 Medium · 16/22 · +0.4 · UPPER' },
  { name: 'Overline / Label', cls: 'ds-text-overline', specs: 'RBNo3.1 Medium · 14/19 · +0.4 · UPPER' },
  { name: 'Label', cls: 'ds-text-label', specs: 'UI · 14/19 · Regular' },
  { name: 'Label · Strong', cls: 'ds-text-label strong', specs: 'UI · 14/19 · Semibold' },
  { name: 'Body', cls: 'ds-text-body', specs: 'UI · 14/20 · Regular' },
  { name: 'Subheadline', cls: 'ds-text-subheadline', specs: 'RBNo3.1 Medium · 12/16' },
  { name: 'Subheadline · Caps', cls: 'ds-text-subheadline caps', specs: 'RBNo3.1 Medium · 12/16 · +0.4 · UPPER' },
  { name: 'Caption', cls: 'ds-text-caption', specs: 'UI · 10/14 · Regular' },
  { name: 'Caption · Strong', cls: 'ds-text-caption strong', specs: 'UI · 10/14 · Semibold' },
];

const metaText: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  lineHeight: 1.4,
  color: 'var(--text-muted)',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

export const TypeRamp: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ width: 760, maxWidth: '100%', color: 'var(--text-primary)' }}>
      {RAMP.map((t) => (
        <div
          key={t.name}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'baseline',
            gap: 24,
            padding: '14px 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className={t.cls} style={{ minWidth: 0, whiteSpace: 'nowrap' }}>
            {SAMPLE}
          </div>
          <div style={metaText}>
            <div style={{ color: 'var(--text-dim)' }}>{t.name}</div>
            <div>{t.specs}</div>
          </div>
        </div>
      ))}
    </div>
  ),
};
