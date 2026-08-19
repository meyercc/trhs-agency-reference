import type { Meta, StoryObj, Decorator } from '@storybook/react';
import { GameTile } from './GameTile';
import { Badge } from './Badge';
import cyberpunk from '../../../Assets/games/cyberpunk.webp';
import eldenring from '../../../Assets/games/eldenring.webp';
import baldursgate3 from '../../../Assets/games/baldursgate3.webp';
import monsterhunter from '../../../Assets/games/monsterhunterwilds.webp';
import cyberpunkIcon from '../../../Assets/games/icons/cyberpunk-icon.webp';

const meta: Meta<typeof GameTile> = {
  title: 'Organisms/GameTile',
  component: GameTile,
  args: {
    cover: cyberpunk,
    name: 'Cyberpunk 2077',
    glow: true,
    playable: true,
    platform: 'platform-steam',
    size: 'md',
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    name: { control: 'text' },
    glow: { control: 'boolean' },
    playable: { control: 'boolean' },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    platform: { control: 'text' },
    cover: { control: false },
    icon: { control: false },
  },
};
export default meta;

type Story = StoryObj<typeof GameTile>;

// Constrain single-tile (args-based) stories to a realistic tile width.
const w150: Decorator[] = [
  (Story) => (
    <div style={{ width: 150 }}>
      <Story />
    </div>
  ),
];

/** Cover art, hover glow, play overlay, platform icon, and a title label. */
export const Default: Story = {
  args: { onMenu: () => {} },
  decorators: w150,
};

/** The title label is optional — omit `name` for art-only grids. */
export const NoLabel: Story = {
  args: { name: undefined, 'aria-label': 'Cyberpunk 2077' },
  decorators: w150,
};

/** Side-by-side: labelled vs. label-less. */
export const LabelOptional: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <div style={{ width: 140 }}>
        <GameTile cover={eldenring} name="Elden Ring" glow platform="platform-steam" />
      </div>
      <div style={{ width: 140 }}>
        <GameTile cover={eldenring} glow platform="platform-steam" aria-label="Elden Ring" />
      </div>
    </div>
  ),
};

/** A library row of cover tiles. */
export const Library: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {[
        { cover: cyberpunk, name: 'Cyberpunk 2077', platform: 'platform-steam' as const, badge: <Badge variant="omen-ai">OMEN AI</Badge> },
        { cover: eldenring, name: 'Elden Ring', platform: 'platform-steam' as const },
        { cover: baldursgate3, name: "Baldur's Gate 3", platform: 'platform-gog' as const },
        { cover: monsterhunter, name: 'Monster Hunter Wilds', platform: 'platform-steam' as const },
      ].map((g) => (
        <div key={g.name} style={{ width: 132 }}>
          <GameTile cover={g.cover} name={g.name} glow platform={g.platform} badges={g.badge} onMenu={() => {}} />
        </div>
      ))}
    </div>
  ),
};

/** Shop variant: no glow, a discount badge, no platform. */
export const Shop: Story = {
  args: { glow: false, platform: undefined, name: 'Elden Ring', cover: eldenring, badges: <Badge variant="sale">-40%</Badge> },
  decorators: w150,
};

/** Icon-only fallback for apps without cover art. */
export const IconOnly: Story = {
  args: { cover: undefined, icon: cyberpunkIcon, name: 'Cyberpunk (app)', glow: true, platform: undefined },
  decorators: w150,
};

/** States. */
export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {(['Disabled', 'Loading'] as const).map((label) => (
        <div key={label} style={{ width: 132 }}>
          <div style={{ marginBottom: 8, font: '11px var(--font-mono)', color: 'var(--text-muted)' }}>{label}</div>
          <GameTile
            cover={cyberpunk}
            name="Cyberpunk 2077"
            platform="platform-steam"
            disabled={label === 'Disabled'}
            loading={label === 'Loading'}
          />
        </div>
      ))}
    </div>
  ),
};
