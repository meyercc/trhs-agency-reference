import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { GradientStops } from './GradientStops';

const meta: Meta<typeof GradientStops> = {
  title: 'Molecules/GradientStops',
  component: GradientStops,
  decorators: [(Story) => <div style={{ width: 'calc(var(--sidebar-w) * 2)' }}>{Story()}</div>],
  parameters: {
    docs: {
      description: {
        component:
          'Figma "Gradient Editor" — a gradient pill with one ring handle per evenly spaced stop. Avalonia: a gradient Border under an ItemsControl of ToggleButtons on a Canvas.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof GradientStops>;

// Product colors — the lighting palette, not UI tokens.
const RAINBOW = ['#e02020', '#fa6400', '#f7b500', '#6dd400', '#0091ff', '#6236ff', '#b620e0'];

/** Seven stops, none being edited. */
export const Default: Story = {
  args: { colors: RAINBOW, label: 'Gradient', onSelect: () => {} },
};

/** The third stop is open in an editor. */
export const ActiveStop: Story = {
  args: { colors: RAINBOW, active: 2, label: 'Gradient', onSelect: () => {} },
};

/** Two stops — the smallest gradient. */
export const TwoStops: Story = {
  args: { colors: ['#e02020', '#0091ff'], label: 'Gradient', onSelect: () => {} },
};

/** Interactive: click a handle to select it, click the bar to insert a stop. */
export const Interactive: Story = {
  render: () => {
    const [colors, setColors] = useState(['#e02020', '#f7b500', '#0091ff']);
    const [active, setActive] = useState<number | null>(null);
    return (
      <GradientStops
        colors={colors}
        active={active}
        label="Gradient"
        onSelect={(i) => setActive((a) => (a === i ? null : i))}
        onInsert={(f) => {
          const at = Math.max(1, Math.min(colors.length - 1, Math.round(f * (colors.length - 1)) || 1));
          setColors([...colors.slice(0, at), '#ffffff', ...colors.slice(at)].slice(0, 7));
        }}
      />
    );
  },
};
