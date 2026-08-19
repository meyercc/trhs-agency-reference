import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { BalanceSlider } from './BalanceSlider';

const meta: Meta<typeof BalanceSlider> = {
  title: 'Molecules/BalanceSlider',
  component: BalanceSlider,
  args: { min: 0, max: 100, defaultValue: 50 },
  argTypes: {
    showValue: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 260 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof BalanceSlider>;

/** Drag (or focus + arrow keys) to see the value popup. */
export const Default: Story = {};

/** The three reference positions, popup forced open. */
export const Positions: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gap: 36, width: 260 }}>
      <BalanceSlider defaultValue={0} showValue />
      <BalanceSlider defaultValue={50} showValue />
      <BalanceSlider defaultValue={100} showValue />
    </div>
  ),
};

/** Disabled. */
export const Disabled: Story = {
  parameters: { controls: { disable: true } },
  render: () => <BalanceSlider defaultValue={30} disabled />,
};

/** Labelled L / R balance with a live readout. */
export const AudioBalance: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [v, setV] = useState(50);
    const offset = v - 50;
    const readout = offset === 0 ? 'Center' : offset < 0 ? `L ${-offset}` : `R ${offset}`;
    return (
      <div style={{ width: 260, display: 'grid', gap: 6 }}>
        <BalanceSlider
          value={v}
          onChange={setV}
          formatValue={(val) => {
            const o = val - 50;
            return o === 0 ? 'C' : o < 0 ? `L${-o}` : `R${o}`;
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', font: '12px var(--font-mono)', color: 'var(--text-muted)' }}>
          <span>L</span>
          <span>{readout}</span>
          <span>R</span>
        </div>
      </div>
    );
  },
};
