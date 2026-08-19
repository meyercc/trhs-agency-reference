import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Ng3Panel } from './Ng3Panel';
import { Icon, type IconName } from './Icon';

const meta: Meta<typeof Ng3Panel> = {
  title: 'Organisms/Ng3Panel',
  component: Ng3Panel,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, margin: '40px auto' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Ng3Panel>;

const TOOLS: IconName[] = ['lights', 'buttons', 'calibration', 'sensor', 'settings'];

function Toolbar({ active = 0 }: { active?: number }) {
  const [sel, setSel] = useState(active);
  return (
    <>
      {TOOLS.map((name, i) => (
        <button
          key={name}
          type="button"
          className={['ds-ng3-tool', i === sel ? 'active' : ''].filter(Boolean).join(' ')}
          aria-label={name}
          aria-pressed={i === sel}
          onClick={() => setSel(i)}
        >
          <Icon name={name} />
        </button>
      ))}
    </>
  );
}

const Actions = (
  <>
    <button type="button" className="ds-ng3-action" aria-label="Duplicate profile">
      <Icon name="duplicate" />
    </button>
    <button type="button" className="ds-ng3-action" aria-label="More">
      <Icon name="more" />
    </button>
  </>
);

/** The trademark panel — tool tab, header, and a content section. */
export const Default: Story = {
  render: () => (
    <Ng3Panel header="Modal Header" tools={<Toolbar />} actions={Actions}>
      <div style={{ minHeight: 220 }} />
    </Ng3Panel>
  ),
};

/** With body content. */
export const WithContent: Story = {
  render: () => (
    <Ng3Panel header="Lighting" tools={<Toolbar active={0} />} actions={Actions}>
      <div style={{ display: 'grid', gap: 12, color: 'var(--text-dim)', font: '14px var(--font-display)' }}>
        <p style={{ margin: 0 }}>Effect, color, and brightness controls would live here.</p>
        <p style={{ margin: 0 }}>The content section fills the remaining panel height.</p>
      </div>
    </Ng3Panel>
  ),
};

/** No tab — just the panel body, for non-NGenuity contexts. */
export const NoTab: Story = {
  render: () => (
    <Ng3Panel header="Settings" actions={Actions}>
      <div style={{ minHeight: 160 }} />
    </Ng3Panel>
  ),
};
