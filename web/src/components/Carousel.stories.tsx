import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Carousel } from './Carousel';
import { HOME_SLIDES } from '../pages/homeSlides';

const meta: Meta<typeof Carousel> = {
  title: 'Organisms/Carousel',
  component: Carousel,
};
export default meta;

type Story = StoryObj<typeof Carousel>;

// The carousel's slides are all position:absolute, so it has no intrinsic
// width — give the demo container a definite width (the global decorator centers
// content, which would otherwise shrink it to ~0). `overflow-x: clip` keeps the
// 100vw aura from adding a scrollbar.
const frame: CSSProperties = { width: '100%', maxWidth: 1000, overflowX: 'clip' };

/** The home hero — five crossfading slides with the blurred aura glow bleeding
 *  down behind it (the empty space below shows the glow). */
export const HomeHero: Story = {
  render: () => (
    <div style={{ ...frame, minHeight: 560 }}>
      <Carousel slides={HOME_SLIDES} />
      <div style={{ height: 220 }} aria-hidden />
    </div>
  ),
};

/** Same carousel with the aura disabled. */
export const NoAura: Story = {
  render: () => (
    <div style={frame}>
      <Carousel slides={HOME_SLIDES} aura={false} />
    </div>
  ),
};
