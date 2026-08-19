import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Dropdown } from './Dropdown';

const meta: Meta<typeof Dropdown> = {
  title: 'Molecules/Dropdown',
  component: Dropdown,
};
export default meta;

type Story = StoryObj<typeof Dropdown>;

const POLLING = [
  { label: '1000 Hz', value: '1000' },
  { label: '500 Hz', value: '500' },
  { label: '250 Hz', value: '250' },
  { label: '125 Hz', value: '125' },
];

export const Default: Story = {
  render: () => (
    <div style={{ width: 200 }}>
      <Dropdown aria-label="Polling rate" options={POLLING} defaultValue="1000" />
    </div>
  ),
};

export const Open: Story = {
  name: 'Open (interactive)',
  render: () => {
    const [v, setV] = useState('500');
    return (
      <div style={{ width: 200, minHeight: 220 }}>
        <Dropdown aria-label="Polling rate" options={POLLING} value={v} onChange={setV} />
      </div>
    );
  },
};
