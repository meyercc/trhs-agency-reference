import type { Meta, StoryObj } from '@storybook/react';
import { Icon } from './Icon';
import { ICON_NAMES } from './icon-names';

const meta: Meta = {
  title: 'Atoms/Icons',
};
export default meta;
type Story = StoryObj;

/** The full icon set from shared/icons.svg, rendered via <Icon name="…" />. */
export const Gallery: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ width: 880, maxWidth: '100%', color: 'var(--text-primary)' }}>
      <p style={{ marginBottom: 16, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        {ICON_NAMES.length} icons · {'<Icon name="…" />'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 8 }}>
        {ICON_NAMES.map((name) => (
          <div
            key={name}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '14px 6px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <Icon name={name} size="lg" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-word' }}>
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  ),
};
