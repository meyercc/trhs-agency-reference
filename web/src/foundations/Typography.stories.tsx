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
  { name: 'Title 1', cls: 'ds-text-title-1', specs: 'RBNo3.1 Bold · 32/40 · --type-title-1-*' },
  { name: 'Title 1 · Caps', cls: 'ds-text-title-1 caps', specs: 'RBNo3.1 Bold · 32/40 · +0.4 · UPPER · --type-title-1-*' },
  { name: 'Title 2', cls: 'ds-text-title-2', specs: 'RBNo3.1 Bold · 24/32 · --type-title-2-*' },
  { name: 'Title 2 · Caps', cls: 'ds-text-title-2 caps', specs: 'RBNo3.1 Bold · 24/32 · +0.4 · UPPER · --type-title-2-*' },
  { name: 'Title 3', cls: 'ds-text-title-3', specs: 'RBNo3.1 Bold · 20/26 · --type-title-3-*' },
  { name: 'Title 3 · Caps', cls: 'ds-text-title-3 caps', specs: 'RBNo3.1 Bold · 20/26 · +0.4 · UPPER · --type-title-3-*' },
  { name: 'Title 3 · Caps · Gradient', cls: 'ds-text-title-3 caps gradient', specs: 'RBNo3.1 Bold · 20/26 · --gradient-title · --type-title-3-*' },
  { name: 'Headline', cls: 'ds-text-headline', specs: 'RBNo3.1 Medium · 16/22 · --type-headline-*' },
  { name: 'Headline · Caps', cls: 'ds-text-headline caps', specs: 'RBNo3.1 Medium · 16/22 · +0.4 · UPPER · --type-headline-*' },
  { name: 'Headline · Gradient', cls: 'ds-text-headline gradient', specs: 'RBNo3.1 Medium · 16/22 · --gradient-title · --type-headline-*' },
  { name: 'Overline / Label', cls: 'ds-text-overline', specs: 'RBNo3.1 Medium · 14/19 · +0.4 · UPPER · --type-overline-*' },
  { name: 'Label', cls: 'ds-text-label', specs: 'UI · 14/19 · Regular · --type-label-*' },
  { name: 'Label · Strong', cls: 'ds-text-label strong', specs: 'UI · 14/19 · Semibold · --type-label-*' },
  { name: 'Body', cls: 'ds-text-body', specs: 'UI · 14/20 · Regular · --type-body-*' },
  { name: 'Subheadline', cls: 'ds-text-subheadline', specs: 'RBNo3.1 Medium · 12/16 · --type-subheadline-*' },
  { name: 'Subheadline · Caps', cls: 'ds-text-subheadline caps', specs: 'RBNo3.1 Medium · 12/16 · +0.4 · UPPER · --type-subheadline-*' },
  { name: 'Caption', cls: 'ds-text-caption', specs: 'UI · --text-micro/14 (12/14 in Hadouken) · Regular · --type-caption-*' },
  { name: 'Caption · Strong', cls: 'ds-text-caption strong', specs: 'UI · --text-micro/14 (12/14 in Hadouken) · Semibold · --type-caption-*' },
];

const metaText: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  lineHeight: 1.4,
  color: 'var(--text-muted)',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

// The `.gradient` modifier on its own, in both themes — Hadouken
// "Gradients/Title" (n100→n400 dark, n950→n700 light) via --gradient-title.
export const TitleGradient: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gutter)' }}>
      {(['ds-theme-dark', 'ds-theme-light'] as const).map((theme) => (
        <div
          key={theme}
          className={theme}
          style={{ padding: 'var(--gutter)', background: 'var(--bg-base)', borderRadius: 'var(--radius)' }}
        >
          <div className="ds-text-title-1 caps gradient">Alloy Rise</div>
          <div className="ds-text-title-3 caps gradient">Pulsefire Haste 2</div>
          <div className="ds-text-headline gradient">Cloud Alpha 2</div>
        </div>
      ))}
    </div>
  ),
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
