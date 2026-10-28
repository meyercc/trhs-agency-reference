import type { Meta, StoryObj } from '@storybook/react';
import { AdSlot } from './AdSlot';

const meta: Meta<typeof AdSlot> = {
  title: 'Organisms/Ad Slot',
  component: AdSlot,
  parameters: {
    docs: {
      description: {
        component:
          'One advertising unit at its fixed IAB size — a 300×250 tile or a 728×90 banner. ' +
          'Until there is real creative it renders a plain fill captioned with the unit’s size. ' +
          'Placement is the caller’s job and there are three concepts, all **off by default** and ' +
          'chosen from Admin → Testing tools → Advertising: **Bottom Left Tile** (fixed, 12px from ' +
          'the corner, every page), **Bottom Banner** (fixed to the bottom edge, centered, every ' +
          'page, with an optional blurred “Obscure background” strip behind it and the page ' +
          'reserving its height), and **Banner Below Carousel** (in flow on Home only). ' +
          'The dimensions are ad-network units, not design tokens; they are declared once in ' +
          '`ads.css`.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof AdSlot>;

/** The medium rectangle — Bottom Left Tile shows this one. */
export const Tile: Story = {
  args: { size: 'tile' },
};

/** The leaderboard — Bottom Banner and Banner Below Carousel both show this one. */
export const Banner: Story = {
  args: { size: 'banner' },
};
