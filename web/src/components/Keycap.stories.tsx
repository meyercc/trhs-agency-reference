import type { Meta, StoryObj } from '@storybook/react';
import { Keycap } from './Keycap';

const meta: Meta<typeof Keycap> = {
  title: 'Atoms/Keycap',
  component: Keycap,
  args: { label: 'Q' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['key', 'hit'] },
    dim: { control: 'boolean' },
    selected: { control: 'boolean' },
    assigned: { control: 'boolean' },
    dropTarget: { control: 'boolean' },
    picked: { control: 'boolean' },
  },
  parameters: {
    docs: {
      description: {
        component:
          'The Figma "Key Overlay" — the control over one cap of a keyboard render. Avalonia: a ToggleButton ControlTheme on a Canvas over the render.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof Keycap>;

// A keycap fills the box its board gives it — one 1u cap here.
const oneCap: Story['decorators'] = [
  (Story) => (
    <div style={{ width: 'calc(var(--control-height) * 1.75)', height: 'calc(var(--control-height) * 1.75)', display: 'grid' }}>
      <Story />
    </div>
  ),
];

export const Default: Story = { decorators: oneCap };
/** A glyph legend — the arrows, and FN functions drawn as icons. */
export const Glyph: Story = { decorators: oneCap, args: { label: undefined, icon: 'chevron-up', 'aria-label': 'Up arrow' } };
/** FN layer, no function on this key. */
export const Dim: Story = { decorators: oneCap, args: { dim: true } };
/** The active key, waiting for an assignment. */
export const Selected: Story = { decorators: oneCap, args: { selected: true } };
/** Active and carrying a remap — the accent wash. */
export const Assigned: Story = { decorators: oneCap, args: { selected: true, assigned: true, label: 'MOUS L' } };
/** A palette chip is being dragged over it. */
export const DropTarget: Story = { decorators: oneCap, args: { dropTarget: true } };
/** Lights tab: an invisible pick target until hovered; picked draws the white ring. */
export const HitPicked: Story = { decorators: oneCap, args: { variant: 'hit', picked: true, label: undefined, 'aria-label': 'Q' } };

export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  decorators: [
    (Story) => (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, calc(var(--control-height) * 1.75))',
          gridAutoRows: 'calc(var(--control-height) * 1.75)',
          gap: 'var(--gutter-xxxs)',
        }}
      >
        <Story />
      </div>
    ),
  ],
  render: () => (
    <>
      <Keycap label="Q" />
      <Keycap icon="chevron-up" aria-label="Up arrow" />
      <Keycap label="W" dim />
      <Keycap label="E" selected />
      <Keycap label="MOUS L" aria-label="R, assigned MOUS L" selected assigned />
      <Keycap label="T" dropTarget />
      <Keycap variant="hit" aria-label="Y" picked />
    </>
  ),
};
