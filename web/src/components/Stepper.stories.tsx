import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Stepper } from './Stepper';

const meta: Meta<typeof Stepper> = {
  title: 'Atoms/Stepper',
  component: Stepper,
  parameters: {
    docs: {
      description: {
        component:
          'A numeric field with stacked step buttons (`.ds-stepper`). Shows the formatted value ' +
          'with its unit; focus exposes the bare number for typing, Enter or blur commits, and the ' +
          'arrow keys step in place. `step` may be a function of the current value for non-linear ' +
          'scales such as frequency.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof Stepper>;

function Live(props: Omit<React.ComponentProps<typeof Stepper>, 'value' | 'onChange'> & { initial: number }) {
  const { initial, ...rest } = props;
  const [v, setV] = useState(initial);
  return <Stepper {...rest} value={v} onChange={setV} />;
}

/** Gain in dB: a fixed half-step, signed formatting. */
export const Gain: Story = {
  render: () => (
    <Live
      initial={0}
      min={-12}
      max={12}
      step={0.5}
      precision={1}
      format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
      aria-label="Gain"
    />
  ),
};

/** Frequency: the step follows the scale, and typed "2.5k" is understood. */
export const Frequency: Story = {
  render: () => (
    <Live
      initial={1000}
      min={20}
      max={20000}
      step={(v) => (v < 100 ? 1 : v < 1000 ? 10 : 100)}
      precision={0}
      format={(v) => (v >= 1000 ? `${+(v / 1000).toFixed(2)} kHz` : `${v} Hz`)}
      parse={(t) => {
        const m = /^\s*([\d.]+)\s*(k)?/i.exec(t);
        return m ? Number(m[1]) * (m[2] ? 1000 : 1) : null;
      }}
      aria-label="Frequency"
    />
  ),
};

/** Q: small steps on a bounded range. */
export const Q: Story = {
  render: () => <Live initial={0.5} min={0.1} max={10} step={0.05} precision={2} format={(v) => v.toFixed(2)} aria-label="Q" />,
};

export const Disabled: Story = {
  render: () => <Live initial={6} disabled format={(v) => `${v.toFixed(1)} dB`} aria-label="Gain" />,
};
