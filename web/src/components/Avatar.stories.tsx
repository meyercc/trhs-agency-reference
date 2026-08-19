import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from './Avatar';
// Local sample assets (Figma's asset URLs expire) — an app glyph + a wallpaper.
import appIcon from '../../../Assets/treehouse-icon.png';
import wallpaper from '../../../Assets/wallpapers/purple-dark.webp';

const meta: Meta<typeof Avatar> = {
  title: 'Atoms/Avatar',
  component: Avatar,
  args: { variant: 'empty', size: 24 },
  argTypes: {
    variant: { control: 'inline-radio', options: ['empty', 'wallpaper', 'app', 'custom'] },
    size: { control: { type: 'range', min: 16, max: 96, step: 4 } },
    src: { control: false },
  },
};
export default meta;

type Story = StoryObj<typeof Avatar>;

/** Empty placeholder — the double-ringed circle with no content. */
export const Empty: Story = {};

/** Solid wallpaper-colour fill. */
export const Wallpaper: Story = { args: { variant: 'wallpaper' } };

/** App glyph inset on the surface. */
export const App: Story = { args: { variant: 'app', src: appIcon, alt: 'App' } };

/** Custom photo, cover-filling the circle. */
export const Custom: Story = { args: { variant: 'custom', src: wallpaper, alt: 'Profile' } };

/** All four content variants at the default 24px size. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <Avatar variant="empty" />
      <Avatar variant="wallpaper" />
      <Avatar variant="app" src={appIcon} alt="App" />
      <Avatar variant="custom" src={wallpaper} alt="Profile" />
    </div>
  ),
};

/** The avatar scales via the `size` prop (--avatar-size). */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      {[24, 32, 40, 64].map((s) => (
        <Avatar key={s} variant="custom" src={wallpaper} alt="Profile" size={s} />
      ))}
    </div>
  ),
};
