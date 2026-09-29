import type { Meta, StoryObj } from '@storybook/react';
import { VerticalSlider } from './VerticalSlider';

const meta: Meta<typeof VerticalSlider> = {
  title: 'Molecules/VerticalSlider',
  component: VerticalSlider,
  args: { min: 0, max: 100, defaultValue: 50, length: 204 },
  argTypes: {
    length: { control: { type: 'number', min: 80, max: 320 } },
    showValue: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<typeof VerticalSlider>;

/** Drag (or focus + arrows) to see the value popup. */
export const Default: Story = {};

/** A range of levels, value popups shown. */
export const Levels: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end' }}>
      {[0, 25, 50, 75, 100].map((val) => (
        <VerticalSlider key={val} defaultValue={val} showValue />
      ))}
    </div>
  ),
};

/**
 * Bipolar rail (`center`): zero is the middle, the fill grows out from the
 * notch toward the handle, and the sign carries meaning. The vertical twin of
 * `BalanceSlider` — this is the shape an equalizer band wants, where a rail
 * filled from the floor would make a flat 0 dB band read as half-loud.
 */
export const Centered: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end' }}>
      {[-12, -6, 0, 6, 12].map((val) => (
        <VerticalSlider
          key={val}
          center
          min={-12}
          max={12}
          defaultValue={val}
          showValue
          formatValue={(v) => `${v > 0 ? '+' : ''}${v} dB`}
        />
      ))}
    </div>
  ),
};

/** A compact EQ bank — the Simple Equalizer's band rails. */
export const Equalizer: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const bands = [4, -3, 0, 2, -6, 0, 5, 8];
    return (
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end' }}>
        {bands.map((val, i) => (
          <VerticalSlider
            key={i}
            center
            min={-12}
            max={12}
            defaultValue={val}
            length={160}
            formatValue={(v) => `${v > 0 ? '+' : ''}${v} dB`}
          />
        ))}
      </div>
    );
  },
};

/** Disabled. */
export const Disabled: Story = {
  parameters: { controls: { disable: true } },
  render: () => <VerticalSlider defaultValue={40} disabled />,
};
