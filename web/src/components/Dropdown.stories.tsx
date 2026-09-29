import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Dropdown, type DropdownGroup } from './Dropdown';

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

const PROFILES: DropdownGroup[] = [
  { label: 'Software', options: [{ value: 'software', label: 'Focus', icon: 'profile' }] },
  {
    label: 'Onboard',
    options: [
      { value: '0', label: 'Slot 1', icon: 'profile', trailing: 'Running' },
      { value: '1', label: 'Slot 2', icon: 'profile' },
      { value: '2', label: 'Slot 3', icon: 'profile' },
    ],
  },
];

/**
 * Grouped options under muted headings, each row and the trigger carrying a
 * leading glyph. The device canvases' profile selector: the software profile,
 * then the device's onboard slots.
 */
export const Grouped: Story = {
  render: () => {
    const [v, setV] = useState('0');
    return (
      <div style={{ width: 200, minHeight: 260 }}>
        <Dropdown aria-label="Profile" groups={PROFILES} value={v} onChange={setV} />
      </div>
    );
  },
};

/**
 * A footer action under a rule — a row that does something (opens an editor)
 * rather than picks a value. The monitor's mode bar uses it for "Add new preset".
 */
export const WithFooter: Story = {
  name: 'With footer action',
  render: () => {
    const [v, setV] = useState('software');
    const [added, setAdded] = useState(0);
    return (
      <div style={{ width: 200, minHeight: 300 }}>
        <Dropdown
          aria-label="Mode"
          groups={PROFILES}
          value={v}
          onChange={setV}
          footer={{ label: 'Add new preset', icon: 'add-small', onSelect: () => setAdded((n) => n + 1) }}
        />
        <p style={{ marginTop: 'var(--gutter-xs)', font: 'var(--text-caption) var(--font-display)', color: 'var(--text-dim)' }}>
          Footer chosen {added} time{added === 1 ? '' : 's'}
        </p>
      </div>
    );
  },
};

/** Opens above the trigger — for a control near the bottom of its surface. */
export const OpensUp: Story = {
  name: 'Opens up',
  render: () => {
    const [v, setV] = useState('software');
    return (
      <div style={{ width: 200, paddingTop: 260 }}>
        <Dropdown aria-label="Profile" groups={PROFILES} value={v} onChange={setV} openUp />
      </div>
    );
  },
};

/** Disabled — a device that is not here cannot be switched. */
export const Disabled: Story = {
  render: () => (
    <div style={{ width: 200 }}>
      <Dropdown aria-label="Profile" groups={PROFILES} defaultValue="0" disabled />
    </div>
  ),
};
