import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Fab } from './Fab';
import { Icon } from './Icon';

const meta: Meta<typeof Fab> = {
  title: 'Atoms/Fab',
  component: Fab,
  args: {
    label: 'Ask Nova',
    icon: <Icon name="twinkle" size={20} />,
    openIcon: <Icon name="chevron-down" size={20} />,
    open: false,
    busy: false,
    badge: false,
  },
  argTypes: {
    open: { control: 'boolean' },
    busy: { control: 'boolean' },
    badge: { control: 'boolean' },
  },
  parameters: {
    docs: {
      description: {
        component:
          'The floating action button: round, raised, accent-filled, placed by its host over the page. `busy` runs the ring (an accent track, a HyperX-red streak orbiting it); `open` crosses the faces; `badge` is the unread dot. Avalonia: a round Button ControlTheme, the ring an Ellipse with a ConicGradientBrush under a RotateTransform animation.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 'var(--gutter)' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Fab>;

export const Rest: Story = {};
/** The surface it owns is showing: the rest face has turned away for the close face. */
export const Open: Story = { args: { open: true, label: 'Close Nova' } };
/** Thinking: the ring runs, the face breathes. */
export const Busy: Story = { args: { busy: true } };
/** Thinking with its surface open — the ring keeps running around the close face. */
export const BusyOpen: Story = { args: { busy: true, open: true, label: 'Close Nova' } };
/** A reply arrived while closed. The label says so too. */
export const Badge: Story = { args: { badge: true, label: 'Ask Nova — new reply' } };

/** Press it: open and close, and thinking for two seconds after each open. */
export const Interactive: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    return (
      <Fab
        label={open ? 'Close Nova' : 'Ask Nova'}
        icon={<Icon name="twinkle" size={20} />}
        openIcon={<Icon name="chevron-down" size={20} />}
        open={open}
        busy={busy}
        onClick={() => {
          setOpen(!open);
          if (!open) {
            setBusy(true);
            setTimeout(() => setBusy(false), 2000);
          }
        }}
      />
    );
  },
};

export const AllStates: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--gutter)', alignItems: 'center', flexWrap: 'wrap' }}>
      <Fab label="Ask Nova" icon={<Icon name="twinkle" size={20} />} openIcon={<Icon name="chevron-down" size={20} />} />
      <Fab label="Close Nova" icon={<Icon name="twinkle" size={20} />} openIcon={<Icon name="chevron-down" size={20} />} open />
      <Fab label="Ask Nova — thinking" icon={<Icon name="twinkle" size={20} />} openIcon={<Icon name="chevron-down" size={20} />} busy />
      <Fab label="Ask Nova — new reply" icon={<Icon name="twinkle" size={20} />} openIcon={<Icon name="chevron-down" size={20} />} badge />
    </div>
  ),
};
