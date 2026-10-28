import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { AngleDial } from './AngleDial';
import { Stepper } from './Stepper';

const meta: Meta<typeof AngleDial> = {
  title: 'Atoms/AngleDial',
  component: AngleDial,
  parameters: {
    docs: {
      description: {
        component:
          'Figma "Angle" — a round control whose indicator points along the angle; drag it, or use the arrow keys. Avalonia: a templated RangeBase (0–360).',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof AngleDial>;

export const Default: Story = { args: { value: 0, onChange: () => {}, 'aria-label': 'Direction angle' } };
export const Diagonal: Story = { args: { value: 45, onChange: () => {}, 'aria-label': 'Direction angle' } };

/** Figma's Angle Control: the dial with a small Stepper for the number. */
export const WithStepper: Story = {
  render: () => {
    const [a, setA] = useState(360);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gutter-xs)' }}>
        <AngleDial value={a % 360} onChange={setA} aria-label="Direction angle" />
        <Stepper size="sm" value={a} min={0} max={360} step={15} precision={0} onChange={setA} aria-label="Direction angle in degrees" />
      </div>
    );
  },
};
