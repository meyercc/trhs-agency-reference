import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Molecules/Input',
  component: Input,
  args: {
    variant: 'standard',
    placeholder: 'Label',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['standard', 'search', 'numeric', 'hex'] },
    error: { control: 'text' },
    tooltip: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<typeof Input>;

/** Standard field with a trailing help icon that shows a tooltip on hover/focus. */
export const Default: Story = {
  args: {
    tooltip: 'This setting controls how the device responds.',
    style: { width: 320 },
  },
};

/** The four width/content presets. */
export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gap: 20, width: 360 }}>
      <Input variant="standard" placeholder="Label" tooltip="Helpful context goes here." />
      <Input variant="search" placeholder="Search" />
      <div style={{ display: 'flex', gap: 16 }}>
        <Input variant="hex" defaultValue="FFFFFF" trailingIcon="duplicate" trailingLabel="Copy hex" style={{ width: 120 }} />
        <Input variant="numeric" defaultValue="24000" style={{ width: 72 }} />
      </div>
    </div>
  ),
};

/** Default, error, and disabled states. */
export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gap: 20, width: 360 }}>
      <Input placeholder="Label" defaultValue="Filled value" />
      <Input placeholder="Label" defaultValue="Bad value" error="That value isn't allowed." />
      <Input placeholder="Label" defaultValue="Locked" disabled />
    </div>
  ),
};

/** Search with a live clear button. */
export const Search: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [value, setValue] = useState('Halo');
    return (
      <Input
        variant="search"
        placeholder="Search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        trailingIcon={value ? 'close' : undefined}
        trailingLabel="Clear search"
        onTrailingClick={() => setValue('')}
        style={{ width: 320 }}
      />
    );
  },
};

/** HEX field — the copy icon confirms via tooltip. */
export const Hex: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Input variant="hex" defaultValue="0078D7" tooltip="HEX code copied" tooltipIcon="duplicate" trailingLabel="Copy hex" style={{ width: 160 }} />
  ),
};
