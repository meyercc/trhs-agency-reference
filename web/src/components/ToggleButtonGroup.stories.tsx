import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ToggleButtonGroup } from './ToggleButtonGroup';

const meta: Meta<typeof ToggleButtonGroup> = {
  title: 'Molecules/ToggleButtonGroup',
  component: ToggleButtonGroup,
};
export default meta;

type Story = StoryObj<typeof ToggleButtonGroup>;

export const ThemeMode: Story = {
  render: () => {
    const [v, setV] = useState('dark');
    return (
      <ToggleButtonGroup
        aria-label="Theme"
        value={v}
        onChange={setV}
        options={[
          { label: 'Dark', value: 'dark' },
          { label: 'Light', value: 'light' },
          { label: 'System', value: 'system' },
        ]}
      />
    );
  },
};

export const TwoUp: Story = {
  render: () => {
    const [v, setV] = useState('extend');
    return (
      <ToggleButtonGroup
        aria-label="Display mode"
        value={v}
        onChange={setV}
        options={[
          { label: 'Extend', value: 'extend' },
          { label: 'Mirror', value: 'mirror' },
        ]}
      />
    );
  },
};
