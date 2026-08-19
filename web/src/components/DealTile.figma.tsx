import figma from '@figma/code-connect';
import { DealTile } from './DealTile';

/**
 * Figma Code Connect — "Deal Tile" set (node 5759:3324) → React <DealTile>.
 *
 * The set's only component property is State (Default / Focus / Hover).
 * State=Hover is the overlay state (description + CTA) → our `forceGlow`.
 *
 * The image, badge, price, platform glyph, description and CTA are nested
 * instances/text in Figma (not Deal Tile component properties), and our
 * <DealTile> takes them as plain props — so those are representative example
 * values shown in the Dev Mode snippet.
 */
figma.connect(
  DealTile,
  'https://www.figma.com/design/eD0UJtTacYOlS6V7k3Aegf/Treehouse-Component-Library?node-id=5759-3324',
  {
    props: {
      hover: figma.enum('State', { Hover: true }),
    },
    example: ({ hover }) => (
      <DealTile
        image="/assets/deal/xboxgamepass-deal.webp"
        title="PC Game Pass"
        platform="platform-xbox"
        discount="-100%"
        price="Free"
        description="Claim your free month of PC Game Pass today!"
        cta="Claim Here"
        glow
        forceGlow={hover}
        onClick={() => {}}
      />
    ),
  },
);
