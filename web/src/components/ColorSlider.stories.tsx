import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ColorSlider } from './ColorSlider';

const meta: Meta<typeof ColorSlider> = {
  title: 'Molecules/ColorSlider',
  component: ColorSlider,
  args: { variant: 'hue', color: 'var(--accent-red)' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['hue', 'lightness', 'opacity'] },
    color: { control: 'color' },
    showValue: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 220 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ColorSlider>;

/** Drag (or focus + arrows) to see the value popup. */
export const Default: Story = {};

/** The three dimensions for one base colour. */
export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gap: 24, width: 220 }}>
      <ColorSlider variant="hue" defaultValue={10} />
      <ColorSlider variant="lightness" color="var(--accent-red)" defaultValue={50} />
      <ColorSlider variant="opacity" color="var(--accent-red)" defaultValue={100} />
    </div>
  ),
};

/** Disabled. */
export const Disabled: Story = {
  parameters: { controls: { disable: true } },
  render: () => <ColorSlider variant="opacity" color="var(--accent-red)" defaultValue={70} disabled />,
};

/** A working H / L / A picker wired to a live swatch. */
export const Picker: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [h, setH] = useState(210);
    const [l, setL] = useState(50);
    const [a, setA] = useState(100);
    const base = `hsl(${h} 90% 50%)`;
    const mixed =
      l <= 50
        ? `color-mix(in srgb, #000, ${base} ${(l / 50) * 100}%)`
        : `color-mix(in srgb, ${base}, #fff ${((l - 50) / 50) * 100}%)`;
    return (
      <div style={{ display: 'grid', gap: 16, width: 220 }}>
        <ColorSlider variant="hue" min={0} max={360} value={h} onChange={setH} />
        <ColorSlider variant="lightness" color={base} value={l} onChange={setL} />
        <ColorSlider variant="opacity" color={base} value={a} onChange={setA} />
        <div
          style={{
            height: 40,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: `linear-gradient(${mixed}, ${mixed}) , repeating-conic-gradient(#bbb 0% 25%, #fff 0% 50%) 0 0 / 16px 16px`,
            opacity: a / 100,
          }}
        />
      </div>
    );
  },
};
