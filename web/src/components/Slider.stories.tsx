import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Slider } from './Slider';

const meta: Meta<typeof Slider> = {
  title: 'Atoms/Slider',
  component: Slider,
  args: { min: 0, max: 100, step: 1, defaultValue: 60 },
};
export default meta;

type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  render: (args) => (
    <div style={{ width: 280 }}>
      <Slider {...args} aria-label="Value" />
    </div>
  ),
};

export const Interactive: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [v, setV] = useState(40);
    return (
      <div style={{ width: 280, color: 'var(--text-dim)' }}>
        <Slider value={v} onChange={setV} aria-label="Brightness" />
        <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)' }}>{v}%</div>
      </div>
    );
  },
};
