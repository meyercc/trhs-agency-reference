import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ListBox } from './ListBox';
import { ListItem } from './ListItem';
import { Separator } from './Separator';

const meta: Meta<typeof ListBox> = {
  title: 'Molecules/ListBox',
  component: ListBox,
  decorators: [(Story) => <div style={{ width: 260 }}>{Story()}</div>],
};
export default meta;

type Story = StoryObj<typeof ListBox>;

/** Static list — rows fill the box; states: default / selected / disabled. */
export const Default: Story = {
  render: () => (
    <ListBox aria-label="Example">
      <ListItem label="Text" />
      <ListItem label="Text" selected />
      <ListItem label="Text" disabled />
      <ListItem label="Text" disabled />
    </ListBox>
  ),
};

/** Scrollable — capped height scrolls when the rows overflow. */
export const Scrollable: Story = {
  render: () => (
    <ListBox aria-label="Scrollable" maxHeight={160}>
      {Array.from({ length: 12 }, (_, i) => (
        <ListItem key={i} label={`Item ${i + 1}`} selected={i === 1} disabled={i === 2 || i === 3} />
      ))}
    </ListBox>
  ),
};

/** Grouped with a Separator between row groups. */
export const WithDivider: Story = {
  render: () => (
    <ListBox aria-label="Grouped" maxHeight={260}>
      <ListItem label="Text" />
      <ListItem label="Text" selected />
      <ListItem label="Text" disabled />
      <ListItem label="Text" disabled />
      <Separator />
      <ListItem label="Text" />
      <ListItem label="Text" />
      <ListItem label="Text" />
      <ListItem label="Text" />
    </ListBox>
  ),
};

/** Single-selection, keyboard-free demo. */
export const Selectable: Story = {
  render: () => {
    const items = ['Gaming', 'Work', 'Silent', 'Movie', 'Streaming', 'Quiet'];
    const [sel, setSel] = useState('Gaming');
    return (
      <ListBox aria-label="Profiles" maxHeight={160}>
        {items.map((label) => (
          <ListItem key={label} label={label} selected={sel === label} onClick={() => setSel(label)} />
        ))}
      </ListBox>
    );
  },
};
