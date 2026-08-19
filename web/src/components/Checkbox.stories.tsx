import type { Meta, StoryObj } from '@storybook/react';
import { Checkbox } from './Checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'Atoms/Checkbox',
  component: Checkbox,
  args: { label: 'Label' },
  argTypes: {
    checked: { control: 'boolean' },
    indeterminate: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Off: Story = { args: { defaultChecked: false } };
export const On: Story = { args: { defaultChecked: true } };
export const Indeterminate: Story = { args: { indeterminate: true } };
export const Disabled: Story = { args: { defaultChecked: true, disabled: true } };
export const NoLabel: Story = { args: { label: undefined, defaultChecked: true } };

// The Hadouken state matrix: Off / On / Indeterminate × Default / Disabled.
export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, max-content)', gap: '16px 40px', alignItems: 'center' }}>
      <Checkbox label="Off" />
      <Checkbox label="Off · disabled" disabled />
      <Checkbox label="On" defaultChecked />
      <Checkbox label="On · disabled" defaultChecked disabled />
      <Checkbox label="Indeterminate" indeterminate />
      <Checkbox label="Indeterminate · disabled" indeterminate disabled />
    </div>
  ),
};
