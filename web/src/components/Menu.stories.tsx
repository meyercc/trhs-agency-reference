import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Menu, type MenuItem, type MenuOrientation } from './Menu';
import { Icon } from './Icon';

const NAV = [
  { id: 'home', label: 'Dashboard', icon: <Icon name="home" /> },
  { id: 'play', label: 'Play', icon: <Icon name="play" /> },
  { id: 'perform', label: 'Perform', icon: <Icon name="performance" /> },
  { id: 'personalize', label: 'Personalize', icon: <Icon name="profile" /> },
  { id: 'shop', label: 'Shop', icon: <Icon name="shop" /> },
];

function Demo({
  orientation,
  hideLabels,
  hideIcons,
  tooltips,
}: {
  orientation: MenuOrientation;
  hideLabels?: boolean;
  hideIcons?: boolean;
  tooltips?: boolean;
}) {
  const [active, setActive] = useState('home');
  const items: MenuItem[] = NAV.map((n) => ({ ...n, active: active === n.id, onClick: () => setActive(n.id) }));
  return (
    <Menu
      items={items}
      orientation={orientation}
      hideLabels={hideLabels}
      hideIcons={hideIcons}
      tooltips={tooltips}
      aria-label="Demo nav"
    />
  );
}

const meta: Meta<typeof Menu> = {
  title: 'Organisms/Menu',
  component: Menu,
  argTypes: {
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
    hideLabels: { control: 'boolean' },
    hideIcons: { control: 'boolean' },
    // Tooltips repeat the label, so they only render while labels are hidden —
    // flip hideLabels on to see them.
    tooltips: { control: 'boolean' },
  },
  args: { orientation: 'horizontal', hideLabels: false, hideIcons: false, tooltips: true },
};
export default meta;

type Story = StoryObj<typeof Menu>;

/** Playground — flip `hideLabels` / `hideIcons` in the controls panel.
 *  `tooltips` only takes effect while labels are hidden (icon-only nav). */
export const Playground: Story = {
  render: (args) => (
    <Demo orientation={args.orientation ?? 'horizontal'} hideLabels={args.hideLabels} hideIcons={args.hideIcons} tooltips={args.tooltips} />
  ),
};

/** Horizontal = the floating centered pill (top navigation). */
export const Horizontal: Story = {
  parameters: { controls: { disable: true } },
  render: () => <Demo orientation="horizontal" />,
};

/** Vertical = the floating left-aligned list (side navigation). */
export const Vertical: Story = {
  parameters: { controls: { disable: true } },
  render: () => <Demo orientation="vertical" />,
};

/**
 * Icon-only — `hideLabels` hides the text for a compact nav. The label is kept
 * as each item's accessible name (`aria-label`) + native tooltip, so the nav
 * stays usable by screen readers and on hover.
 */
export const IconOnly: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gap: 40, justifyItems: 'center' }}>
      <Demo orientation="horizontal" hideLabels />
      <Demo orientation="vertical" hideLabels />
    </div>
  ),
};

/** Text-only — `hideIcons` drops the leading glyphs. */
export const TextOnly: Story = {
  parameters: { controls: { disable: true } },
  render: () => <Demo orientation="horizontal" hideIcons />,
};

export const BothVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gap: 40, justifyItems: 'center' }}>
      <Demo orientation="horizontal" />
      <Demo orientation="vertical" />
    </div>
  ),
};
