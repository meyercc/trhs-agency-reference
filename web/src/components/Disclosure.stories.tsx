import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';
import { Disclosure } from './Disclosure';
import { Icon } from './Icon';
import { Ng3Spec } from './Ng3Section';

const FACTS = [
  { label: 'Genre', value: 'Action RPG' },
  { label: 'Release date', value: 'Feb 25, 2022' },
  { label: 'Developer', value: 'FromSoftware' },
  { label: 'Publisher', value: 'Bandai Namco' },
];

const meta: Meta<typeof Disclosure> = {
  title: 'Molecules/Disclosure',
  component: Disclosure,
  args: { title: 'Info', children: <Ng3Spec items={FACTS} /> },
  argTypes: {
    defaultOpen: { control: 'boolean' },
    density: { control: 'inline-radio', options: ['default', 'compact'] },
    open: { control: false },
  },
  parameters: {
    docs: {
      description: {
        component:
          'A collapsible section over `.ds-settings-group` — the Booster modal’s groups and the game panel’s Info. Collapsed by default; the header is a keyboard button with `aria-expanded`. Avalonia: an Expander with the settings-group ControlTheme.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof Disclosure>;

/** Collapsed by default — the game panel's Info section. */
export const Collapsed: Story = {};

/** Open from the start. */
export const Open: Story = { args: { defaultOpen: true } };

/** With a description, an icon tile and a badge before the chevron. */
export const Detailed: Story = {
  args: {
    title: 'Startup apps',
    description: 'Four apps start with Windows',
    icon: <Icon name="performance" size={13} />,
    meta: <Badge variant="count">4</Badge>,
    defaultOpen: true,
  },
};

/** Compact density — a narrow column such as the game detail panel. */
export const Compact: Story = {
  args: { density: 'compact', defaultOpen: true },
  decorators: [(Story) => <div style={{ width: 232 }}><Story /></div>],
};

/** All states side by side. */
export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gutter-sm)', width: 360 }}>
      <Disclosure title="Collapsed">
        <Ng3Spec items={FACTS} />
      </Disclosure>
      <Disclosure title="Open" defaultOpen>
        <Ng3Spec items={FACTS} />
      </Disclosure>
      <Disclosure title="Detailed" description="With a description and a badge" icon={<Icon name="ai" size={13} />} meta={<Badge variant="count">4</Badge>} defaultOpen>
        <Ng3Spec items={FACTS} />
      </Disclosure>
    </div>
  ),
};
