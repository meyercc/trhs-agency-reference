import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';
import { Badge } from './Badge';
import gameArt from '../../../Assets/games/counterstrike2.webp';
import cyberArt from '../../../Assets/games/cyberpunk.webp';
import bundleArt from '../../../Assets/shop/mysterystarbundle.webp';

const meta: Meta<typeof Card> = {
  title: 'Molecules/Card',
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Portrait: Story = {
  render: () => (
    <div style={{ width: 200 }}>
      <Card orientation="portrait" art={gameArt} artAlt="Counter-Strike 2" title="Counter-Strike 2" meta="Valve · FPS" price="Free" />
    </div>
  ),
};

export const Sale: Story = {
  render: () => (
    <div style={{ width: 200 }}>
      <Card
        orientation="portrait"
        art={cyberArt}
        artAlt="Cyberpunk 2077"
        title="Cyberpunk 2077"
        meta="CD Projekt Red · RPG"
        price="$29.99"
        origPrice="$59.99"
      />
    </div>
  ),
};

export const Overlay: Story = {
  render: () => (
    <div style={{ width: 240 }}>
      <Card
        orientation="overlay"
        art={bundleArt}
        artAlt="Mystery Star Bundle"
        title="Mystery Star Bundle"
        price="$14.99"
        badge={<Badge variant="sale">−50%</Badge>}
      />
    </div>
  ),
};
