import type { Meta, StoryObj } from '@storybook/react';
import { Sparkline } from './Sparkline';

const series = (n: number, base: number, swing: number) =>
  Array.from({ length: n }, (_, i) => ({ t: i, v: Math.round(base + Math.sin(i / 7) * swing + ((i * 7919) % 11) - 5) }));

const meta: Meta<typeof Sparkline> = {
  title: 'Molecules/Sparkline',
  component: Sparkline,
  parameters: {
    docs: {
      source: { type: 'code' },
      description: {
        component:
          'A reading over time (TH-454): the `.ds-spark-cell` head with the last two minutes drawn as a line over a faint area. ' +
          'No axes — the number beside the label is the axis that matters. Fed from the vitals stream\u2019s history on a composed card or HUD.',
      },
    },
  },
  decorators: [(Story) => <div style={{ width: 'min(301px, 100%)' }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof Sparkline>;

export const Percent: Story = { args: { label: 'CPU', points: series(120, 48, 18), unit: '%', min: 0, max: 100 } };
export const OwnRange: Story = { args: { label: 'Download', points: series(120, 240, 60), unit: 'Mbps' } };
export const Flat: Story = { args: { label: 'RAM', points: series(120, 61, 0), unit: '%', min: 0, max: 100 } };
