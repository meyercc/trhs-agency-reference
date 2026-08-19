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

/** A compact EQ-style bank. */
export const Equalizer: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const bands = [30, 55, 70, 60, 45, 50, 65, 80];
    return (
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end' }}>
        {bands.map((val, i) => (
          <VerticalSlider key={i} defaultValue={val} length={160} />
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
