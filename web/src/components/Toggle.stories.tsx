import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Toggle } from './Toggle';

const meta: Meta<typeof Toggle> = {
  title: 'Atoms/Toggle',
  component: Toggle,
  argTypes: {
    checked: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<typeof Toggle>;

export const On: Story = { args: { checked: true } };
export const Off: Story = { args: { checked: false } };

export const Disabled: Story = { args: { checked: true, disabled: true } };

export const Interactive: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [on, setOn] = useState(true);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-dim)' }}>
        <Toggle checked={on} onChange={setOn} aria-label="Demo toggle" />
        <span>{on ? 'On' : 'Off'}</span>
      </div>
    );
  },
};

// Off / On × Default / Disabled.
export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, max-content)', gap: '18px 40px', alignItems: 'center', color: 'var(--text-dim)' }}>
      <Toggle checked={false} aria-label="Off" />
      <span>Off</span>
      <Toggle checked aria-label="On" />
      <span>On</span>
      <Toggle checked={false} disabled aria-label="Off disabled" />
      <span>Off · disabled</span>
      <Toggle checked disabled aria-label="On disabled" />
      <span>On · disabled</span>
    </div>
  ),
};
