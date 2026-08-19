import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Swatch, RAINBOW } from './Swatch';

const meta: Meta<typeof Swatch> = {
  title: 'Atoms/Swatch',
  component: Swatch,
  args: {
    color: 'var(--accent-red)',
    size: 24,
    selected: false,
  },
  argTypes: {
    color: { control: 'text' },
    selected: { control: 'boolean' },
    size: { control: { type: 'number', min: 16, max: 48 } },
  },
};
export default meta;

type Story = StoryObj<typeof Swatch>;

const R = 'var(--accent-red)';
const O = 'var(--accent-orange)';
const Y = 'var(--accent-yellow)';

/** A single colour chip. */
export const Default: Story = {};

/** Every variant, unselected (left) and selected (right). */
export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: 24, placeItems: 'center start' }}>
      <Swatch color={R} label="1 colour" />
      <Swatch color={R} label="1 colour, selected" selected />

      <Swatch colors={[R, O]} label="2 colours" />
      <Swatch colors={[R, O]} label="2 colours, selected" selected />

      <Swatch colors={[R, O, Y]} label="3 colours" />
      <Swatch colors={[R, O, Y]} label="3 colours, selected" selected />

      <Swatch gradient={RAINBOW} width={78} label="gradient" />
      <Swatch gradient={RAINBOW} width={78} label="gradient, selected" selected />

      <Swatch color="var(--accent-green)" width={135} label="parent" />
      <Swatch color="var(--accent-green)" width={135} label="parent, selected" selected />
    </div>
  ),
};

/** Click to select — single-selection palette. */
export const Palette: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const palette = ['red', 'orange', 'yellow', 'green', 'cyan', 'indigo', 'purple'];
    const [active, setActive] = useState('green');
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        {palette.map((name) => (
          <Swatch
            key={name}
            color={`var(--accent-${name})`}
            label={name}
            selected={active === name}
            onClick={() => setActive(name)}
          />
        ))}
      </div>
    );
  },
};
