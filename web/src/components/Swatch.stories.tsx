import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import wallpaper from '../../../Assets/wallpapers/purple-dark.webp';
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

/** A single color chip. */
export const Default: Story = {};

/** Every variant, unselected (left) and selected (right). */
export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: 24, placeItems: 'center start' }}>
      <Swatch color={R} label="1 color" />
      <Swatch color={R} label="1 color, selected" selected />

      <Swatch colors={[R, O]} label="2 colors" />
      <Swatch colors={[R, O]} label="2 colors, selected" selected />

      <Swatch colors={[R, O, Y]} label="3 colors" />
      <Swatch colors={[R, O, Y]} label="3 colors, selected" selected />

      <Swatch gradient={RAINBOW} width={78} label="gradient" />
      <Swatch gradient={RAINBOW} width={78} label="gradient, selected" selected />

      <Swatch color="var(--accent-green)" width={135} label="parent" />
      <Swatch color="var(--accent-green)" width={135} label="parent, selected" selected />
    </div>
  ),
};

/**
 * `wide` fills the row instead of taking a fixed measure — the case where a
 * couple of chips share a row that resizes with its panel (the Lights preset
 * editor's two effect colors). Contrast with `width`, which pins a pill to a
 * fixed px value; here the width comes from flex, so the chips stay equal and
 * follow the container. Resize the panel to see them track it.
 */
export const Wide: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [active, setActive] = useState(0);
    return (
      <div style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 'var(--gutter)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gutter)' }}>
          <Swatch wide color={R} label="Color 1" selected={active === 0} onClick={() => setActive(0)} />
          <Swatch wide color={Y} label="Color 2" selected={active === 1} onClick={() => setActive(1)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gutter)' }}>
          <Swatch wide gradient={RAINBOW} label="Gradient, wide" />
        </div>
      </div>
    );
  },
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

/** An image fill — a picture chosen the same way as a color (profile photos). */
export const Image: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--gutter-sm)' }}>
      <Swatch image={wallpaper} label="Purple" selected />
      <Swatch image={wallpaper} label="Purple" />
    </div>
  ),
};
