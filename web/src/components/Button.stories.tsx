import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  args: { children: 'Button' },
  argTypes: {
    variant: { control: 'select', options: ['default', 'accent', 'ghost'] },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
    onImage: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {};
export const Accent: Story = { args: { variant: 'accent' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Small: Story = { args: { variant: 'accent', size: 'sm' } };
export const Disabled: Story = { args: { variant: 'accent', disabled: true } };
/** `block` fills the container — a stacked action group such as a modal rail's foot. */
export const Block: Story = {
  args: { variant: 'accent', block: true, children: 'Export All Profiles' },
  render: (args) => (
    // Story scaffolding, not product UI: the wrapper stands in for the container
    // (a modal rail) that a block button fills.
    <div style={{ width: 240, display: 'grid', gap: 'var(--gutter-xs)' }}>
      <Button {...args} />
      <Button {...args} variant="default">Import Profiles</Button>
    </div>
  ),
};

/**
 * For CTAs sitting on artwork — carousel slides, hero overlays. The art behind
 * them is dark in *both* themes, so `onImage` holds the dark treatment instead
 * of following the page. Without it a light-theme page paints near-black label
 * text onto a dark photo. Toggle the Storybook theme to see the difference:
 * the plain Default button below flips, the On Image one does not.
 */
export const OnImage: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: 'flex',
        gap: 'var(--gutter-xs)',
        alignItems: 'center',
        padding: 'var(--gutter)',
        borderRadius: 'var(--radius)',
        // Stands in for slide artwork. Heavy black alpha, so it reads dark on
        // either theme's page — which is the whole point of the variant.
        background: 'linear-gradient(120deg, var(--ksg-b90), var(--ksg-b65))',
      }}
    >
      <Button variant="accent">Try It Now</Button>
      <Button onImage>Learn More</Button>
      <Button>Default (follows the theme)</Button>
    </div>
  ),
};

export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button>Default</Button>
      <Button variant="accent">Accent</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="accent" size="sm">Small</Button>
      <Button variant="accent" disabled>Disabled</Button>
      <Button onImage>On Image</Button>
    </div>
  ),
};
