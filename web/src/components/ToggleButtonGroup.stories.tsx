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

/**
 * `fullWidth` — the pill spans its container and the options share the width
 * evenly. Use it where the group IS the control for its row (the headset's
 * notification mode, say); the default content width is right where the group
 * sits beside other content and should read as a chip.
 */
export const FullWidth: Story = {
  render: () => {
    const [v, setV] = useState('voice');
    return (
      <div style={{ width: 360 }}>
        <ToggleButtonGroup
          fullWidth
          aria-label="Notifications"
          value={v}
          onChange={setV}
          options={[
            { label: 'Voice', value: 'voice' },
            { label: 'Tone', value: 'tone' },
            { label: 'None', value: 'none' },
          ]}
        />
      </div>
    );
  },
};

/** Icon options, with or without their labels. Icon-only options carry the label as their accessible name. */
export const WithIcons: Story = {
  args: {
    value: 'grid',
    options: [
      { label: 'Grid', value: 'grid', icon: 'grid' },
      { label: 'List', value: 'list', icon: 'details' },
    ],
    'aria-label': 'Layout',
  },
};
export const IconOnly: Story = {
  args: {
    value: 'grid',
    iconOnly: true,
    options: [
      { label: 'Grid', value: 'grid', icon: 'grid' },
      { label: 'List', value: 'list', icon: 'details' },
    ],
    'aria-label': 'Layout',
  },
};
