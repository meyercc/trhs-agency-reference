import type { Meta, StoryObj, Decorator } from '@storybook/react';
import { DealTile } from './DealTile';
import gamepass from '../../../Assets/deal/xboxgamepass-deal.webp';
import sonic from '../../../Assets/deal/egs-sonic-franchise-sale-breaker-1920x1080-d7f60634dcb6.jpg';
import deal3 from '../../../Assets/deal/749a4d54-32b4-422a-9b36-6fbdf7420358.jpeg';

const meta: Meta<typeof DealTile> = {
  title: 'Organisms/DealTile',
  component: DealTile,
  args: {
    image: gamepass,
    title: 'PC Game Pass',
    platform: 'platform-xbox',
    discount: '-100%',
    price: 'Free',
    description: 'Claim your free month of PC Game Pass today!',
    cta: 'Claim Here',
    glow: true,
  },
  argTypes: {
    title: { control: 'text' },
    platform: { control: 'text' },
    discount: { control: 'text' },
    price: { control: 'text' },
    description: { control: 'text' },
    cta: { control: 'text' },
    glow: { control: 'boolean' },
    forceGlow: { control: 'boolean' },
    image: { control: false },
  },
};
export default meta;

type Story = StoryObj<typeof DealTile>;

// Absolutely-composited tile → give it a definite width in the story.
const w320: Decorator[] = [
  (Story) => (
    <div style={{ width: 320 }}>
      <Story />
    </div>
  ),
];

export const Default: Story = { decorators: w320 };

// Hover state — overlay + CTA forced on (no pointer needed in the catalog).
export const Hover: Story = { decorators: w320, args: { forceGlow: true } };

// No hover content — just the image + info bar.
export const InfoOnly: Story = {
  decorators: w320,
  args: { description: undefined, cta: null, glow: false },
};

export const Grid: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 320px)', gap: 16 }}>
      <DealTile
        image={gamepass}
        title="PC Game Pass"
        platform="platform-xbox"
        discount="-100%"
        price="Free"
        description="Claim your free month of PC Game Pass today!"
        cta="Claim Here"
        glow
      />
      <DealTile
        image={sonic}
        title="Sonic Franchise Sale"
        platform="platform-epic"
        discount="-75%"
        price="$4.99"
        description="The Sonic franchise sale is on now — up to 75% off."
        cta="View Deal"
        glow
      />
      <DealTile
        image={deal3}
        title="Featured Deal"
        platform="platform-steam"
        discount="-50%"
        price="$29.99"
        description="A featured deal, this week only."
        cta="View Deal"
        glow
      />
    </div>
  ),
};
