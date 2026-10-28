import type { Meta, StoryObj } from '@storybook/react';
import { Meter } from './Meter';

const meta: Meta<typeof Meter> = {
  title: 'Molecules/Meter',
  component: Meter,
  parameters: {
    docs: {
      source: { type: 'code' },
      description: {
        component:
          'A reading shown as a level (TH-454): the `.ds-spark-cell` label/value head over the `.ds-prog-track` bar. ' +
          'Read-only — it is one of the forms Nova can give a percentage on a composed card; a level the person moves is a `Slider`.',
      },
    },
  },
  decorators: [(Story) => <div style={{ width: 'min(301px, 100%)' }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof Meter>;

export const Percent: Story = { args: { label: 'CPU', value: 54 } };
export const OwnScale: Story = { args: { label: 'CPU temp', value: 71, display: '71', unit: '\u00b0C' } };
export const Full: Story = { args: { label: 'C: used', value: 100 } };
