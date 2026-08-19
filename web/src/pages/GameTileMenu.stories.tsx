import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { GameTile } from '../components';
import { GameTileMenu, type GamePlatform, type OptimizeState } from './GameTileMenu';
import { INSTALLED } from '../data/games';

// A representative game (Valorant, to match the Figma reference).
const GAME = INSTALLED.find((g) => g.id === 'valorant') ?? INSTALLED[0];

/**
 * The per-tile ••• context menu — Play / Favorites / Remove / More Info, an
 * Optimize group (Booster + OMEN AI), and a platform selector. It's a fixed
 * popover anchored to the tile's ••• button, so the story wires up a real
 * GameTile: click the ••• to open it. State is local to the demo.
 */
const meta: Meta<typeof GameTileMenu> = {
  title: 'Organisms/GameTileMenu',
  component: GameTileMenu,
  // The menu positions itself with `position: fixed` from the anchor's
  // viewport rect. Docs-page story blocks sit inside a transformed container,
  // which re-bases fixed positioning and strands the popover off-screen — so
  // render the story as its own iframe there (a real viewport). The canvas
  // page needs none of this.
  parameters: { docs: { story: { inline: false, iframeHeight: 600 } } },
  argTypes: {
    // The rest of the props are driven by the interactive demo below.
    game: { control: false },
    anchor: { control: false },
    favorite: { control: 'boolean' },
    optimize: { control: false },
    platform: { control: 'inline-radio', options: ['steam', 'geforce'] },
  },
  args: { favorite: true, platform: 'steam' },
};
export default meta;

type Story = StoryObj<typeof GameTileMenu>;

function MenuDemo({ favorite: initialFav, platform: initialPlat }: { favorite: boolean; platform: GamePlatform }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [favorite, setFavorite] = useState(initialFav);
  const [optimize, setOptimize] = useState<OptimizeState>({ booster: true, omenAi: !!GAME.omenAi });
  const [platform, setPlatform] = useState<GamePlatform>(initialPlat);
  return (
    <div style={{ width: 160 }}>
      <GameTile
        cover={GAME.art}
        name={GAME.title}
        glow
        platform="platform-steam"
        onMenu={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
        menuOpen={!!anchor}
      />
      {anchor && (
        <GameTileMenu
          game={GAME}
          anchor={anchor}
          favorite={favorite}
          optimize={optimize}
          platform={platform}
          onClose={() => setAnchor(null)}
          onToggleFavorite={() => setFavorite((f) => !f)}
          onRemove={() => setAnchor(null)}
          onSetOptimize={(key, value) => setOptimize((o) => ({ ...o, [key]: value }))}
          onSetPlatform={setPlatform}
        />
      )}
    </div>
  );
}

/** Click the ••• button on the tile to open the menu. */
export const Playground: Story = {
  render: (args) => <MenuDemo favorite={!!args.favorite} platform={(args.platform as GamePlatform) ?? 'steam'} />,
};
