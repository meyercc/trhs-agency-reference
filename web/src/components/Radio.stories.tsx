import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Radio } from './Radio';

const meta: Meta<typeof Radio> = {
  title: 'Atoms/Radio',
  component: Radio,
  args: { label: 'Label', name: 'demo' },
  argTypes: {
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<typeof Radio>;

export const Off: Story = { args: { defaultChecked: false } };
export const On: Story = { args: { defaultChecked: true } };
export const Disabled: Story = { args: { defaultChecked: true, disabled: true } };

/** A grouped set — same `name`, single selection. */
export const Group: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [value, setValue] = useState('balanced');
    const opts = [
      { value: 'eco', label: 'Eco' },
      { value: 'balanced', label: 'Balanced' },
      { value: 'performance', label: 'Performance' },
    ];
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {opts.map((o) => (
          <Radio
            key={o.value}
            name="power"
            label={o.label}
            value={o.value}
            checked={value === o.value}
            onChange={() => setValue(o.value)}
          />
        ))}
      </div>
    );
  },
};

// Off / On × Default / Disabled.
export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, max-content)', gap: '16px 40px', alignItems: 'center' }}>
      <Radio name="m1" label="Off" />
      <Radio name="m2" label="Off · disabled" disabled />
      <Radio name="m3" label="On" defaultChecked />
      <Radio name="m4" label="On · disabled" defaultChecked disabled />
    </div>
  ),
};
