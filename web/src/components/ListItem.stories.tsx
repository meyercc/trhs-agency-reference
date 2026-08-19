import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ListItem } from './ListItem';
import { Checkbox } from './Checkbox';
import { Toggle } from './Toggle';
import { Badge } from './Badge';
import { Icon as DsIcon, type IconName } from './Icon';

// ── slot helpers (the kinds of content a list item's slots hold) ─────────────
const Avatar = () => (
  <span
    style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--ksg-b20)', border: '1px solid var(--ksg-w20)', flexShrink: 0 }}
  />
);
const Swatch = ({ color }: { color: string }) => (
  <span style={{ width: 16, height: 16, borderRadius: 'var(--radius-sm)', background: color, border: '1px solid var(--ksg-w20)', flexShrink: 0 }} />
);
const Icon = ({ name }: { name: IconName }) => <DsIcon name={name} size="sm" />;
const Kebab = () => <DsIcon name="more" size={12} />;

// A list-box-like container to preview rows grouped (forthcoming component).
const Box = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      width: 260,
      padding: 'var(--gutter-xxs)',
      display: 'grid',
      gap: 2,
      background: 'var(--ksg-b20)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
    }}
  >
    {children}
  </div>
);

const meta: Meta<typeof ListItem> = {
  title: 'Molecules/ListItem',
  component: ListItem,
  args: { label: 'Label' },
  decorators: [(Story) => <div style={{ width: 260 }}>{Story()}</div>],
};
export default meta;

type Story = StoryObj<typeof ListItem>;

export const Default: Story = { args: { leading: <Avatar /> } };
export const Selected: Story = { args: { leading: <Avatar />, trailing: <Kebab />, selected: true } };
export const Disabled: Story = { args: { leading: <Avatar />, disabled: true } };

/** The leading/trailing slots accept any component. */
export const Slots: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Box>
      <ListItem leading={<Avatar />} label="Avatar" trailing={<Kebab />} />
      <ListItem leading={<Swatch color="var(--accent-cyan)" />} label="Color swatch" />
      <ListItem leading={<Icon name="home" />} label="Icon" />
      <ListItem leading={<Checkbox defaultChecked />} label="Checkbox" />
      <ListItem leading={<Icon name="performance" />} label="With badge" trailing={<Badge variant="new">NEW</Badge>} />
      <ListItem leading={<Icon name="profile" />} label="With toggle" trailing={<Toggle checked={false} aria-label="row toggle" />} />
    </Box>
  ),
};

/** Selectable list — single selection, like a forthcoming list box. */
export const Selectable: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const items = [
      { id: 'gaming', label: 'Gaming', color: 'var(--accent-red)' },
      { id: 'work', label: 'Work', color: 'var(--accent-cyan)' },
      { id: 'silent', label: 'Silent', color: 'var(--accent-green)' },
      { id: 'movie', label: 'Movie', color: 'var(--accent-purple)' },
    ];
    const [sel, setSel] = useState('gaming');
    return (
      <Box>
        {items.map((it) => (
          <ListItem
            key={it.id}
            leading={<Swatch color={it.color} />}
            label={it.label}
            selected={sel === it.id}
            trailing={sel === it.id ? <Kebab /> : undefined}
            onClick={() => setSel(it.id)}
          />
        ))}
      </Box>
    );
  },
};

/** Compact icon-only rows (e.g. a vertical icon rail). */
export const IconOnly: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 4 }}>
      <ListItem iconOnly leading={<Icon name="home" />} selected />
      <ListItem iconOnly leading={<Icon name="performance" />} />
      <ListItem iconOnly leading={<Icon name="profile" />} />
      <ListItem iconOnly leading={<Icon name="shop" />} disabled />
    </div>
  ),
};
