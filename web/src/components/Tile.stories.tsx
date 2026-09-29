import type { Meta, StoryObj } from '@storybook/react';
import { Tile, TileGrid, TileLink } from './Tile';
import { Toggle } from './Toggle';
import { Badge } from './Badge';
import { Button } from './Button';
import { Slider } from './Slider';
import { Icon } from './Icon';

const meta: Meta<typeof Tile> = {
  title: 'Molecules/Tile',
  component: Tile,
  args: {
    title: 'Audio EQ',
    icon: 'eq',
    value: 'FPS',
    reason: 'Set by Gaming mode',
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['s', 'm', 't', 'l', 'full'] },
    state: {
      control: 'select',
      options: ['default', 'context', 'suggested', 'attention', 'overridden', 'unavailable'],
    },
  },
  decorators: [
    (Story) => (
      <TileGrid>
        <Story />
      </TileGrid>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Tile>;

export const Default: Story = { args: { reason: 'Pinned by you' } };
export const Contextual: Story = {
  args: { state: 'context', reasonIcon: 'gaming', controls: <Badge variant="status" tone="info">Gaming</Badge>, actions: <TileLink chevron>Change</TileLink> },
};
export const Suggested: Story = {
  args: {
    size: 'm',
    state: 'suggested',
    icon: 'moon',
    title: 'Switch to Night lighting?',
    value: undefined,
    controls: <Badge variant="status" tone="info">Suggested</Badge>,
    reason: 'Suggested because it’s after sunset',
    reasonIcon: 'sunset',
    children: (
      <>
        Dims keyboard and desk lighting and shifts to warmer colors.
        <span style={{ display: 'flex', gap: 'var(--gutter-xs)' }}>
          <Button variant="accent" size="sm">Switch</Button>
          <Button size="sm">Not now</Button>
        </span>
      </>
    ),
  },
};
export const NeedsAttention: Story = {
  args: { state: 'attention', icon: 'audio-headset', title: 'Cloud III', value: 'Offline', reason: 'Reconnect to change audio', actions: <TileLink>Reconnect</TileLink> },
};
export const Overridden: Story = {
  args: { state: 'overridden', controls: <Badge variant="status">Changed</Badge>, value: 'Music', reason: 'Changed by you · Gaming sets FPS', actions: <TileLink icon="reset">Reset</TileLink> },
};
export const Unavailable: Story = { args: { state: 'unavailable', value: 'Device disconnected', reason: 'No controls until it is back' } };
export const WithControl: Story = {
  args: {
    icon: 'sidetone',
    title: 'Sidetone',
    value: '40%',
    controls: <Toggle aria-label="Sidetone" />,
    reason: 'Pinned by you',
    children: <Slider defaultValue={40} aria-label="Sidetone level" />,
  },
};
/** Text reason — for tiles whose reason is the content itself (a time, a device). */
export const TextReason: Story = { args: { reason: 'Now · Tuesday 9:12 PM' } };

export const Row: Story = {
  args: { row: true, icon: 'lights', title: 'Light Studio', value: 'Scenes · zones', reason: undefined, actions: undefined, onActivate: () => {} },
};

/** Row with media + body: a leading visual, extra content in the middle, actions at the end (the Personalize context strip). */
export const RowWithMedia: Story = {
  args: {
    row: true,
    size: 'full',
    state: 'context',
    media: <Icon name="work" size="lg" />,
    title: 'Meeting in 10 min',
    value: 'Wed 9:50 AM',
    reasonIcon: 'info',
    reason: 'Tiles below are ranked by these signals.',
    children: <span>Teams call 10:00 AM · Cloud III on · Daylight</span>,
    actions: <TileLink icon="undo">Undo</TileLink>,
  },
};

/** Sizes on the real grid: S 1×1, M 2×1, T 1×2, L 2×2, Full. */
/** The tile as the choice: hover like any clickable widget, and the one in use
 *  carries both the accent and the word "Active". */
export const Selectable: Story = {
  render: () => (
    <TileGrid>
      <Tile
        title="Profile"
        selected
        onActivate={() => {}}
        aria-pressed
        controls={<Badge variant="status" tone="positive">Active</Badge>}
        value="Gaming"
        reason="Own desk lighting · overrides 2 app settings"
      />
      <Tile title="Profile" onActivate={() => {}} aria-pressed={false} value="Work" reason="Uses app appearance" />
    </TileGrid>
  ),
};

export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <>
      <Tile size="l" icon="gaming" title="L · 2×2" value="Module" reason="Mode · light scene" />
      <Tile size="t" icon="devices" title="T · 1×2" value="Stacked" reason="Device group" />
      <Tile icon="eq" title="S · 1×1" value="Toggle" reason="On / off · one number" />
      <Tile size="m" icon="moon" title="M · 2×1" value="Inline control" reason="Slider · segmented · suggestion" />
      <Tile size="full" icon="lights" title="Full" value="Expanded in place" reason="Everything the tile can do" />
    </>
  ),
};

/** The six states side by side. */
export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <>
      <Tile icon="lights" title="Lighting" value="Aurora · 60%" reason="Pinned by you" />
      <Tile state="context" icon="lights" title="Lighting" value="Wave · 80%" reason="Set by Gaming mode" reasonIcon="gaming" />
      <Tile state="suggested" icon="lights" title="Lighting" value="Night setup?" reason="Suggested because it’s after sunset" reasonIcon="sunset" />
      <Tile state="attention" icon="lights" title="Lighting" value="Play bar offline" reason="Reconnect" />
      <Tile state="overridden" icon="lights" title="Lighting" value="Solid · 40%" reason="Changed by you · Gaming sets Wave" />
      <Tile state="unavailable" icon="lights" title="Lighting" value="Disconnected" reason="No controls until it is back" />
    </>
  ),
};
