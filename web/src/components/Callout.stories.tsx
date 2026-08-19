import type { Meta, StoryObj } from '@storybook/react';
import { Callout } from './Callout';

const meta: Meta<typeof Callout> = {
  title: 'Atoms/Callout',
  component: Callout,
  args: { value: 'Mouse Left' },
  // Callouts are absolutely positioned annotations — give them a stage.
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          width: 360,
          height: 120,
          background: 'var(--bg-mid)',
          borderRadius: 'var(--radius)',
        }}
      >
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Callout>;

/** Anchored at its dot; the label extends to the right. */
export const Default: Story = {
  args: { style: { left: '20%', top: '50%' } },
};

/** `flip` mirrors the row for anchors on the right side of an image. */
export const Flipped: Story = {
  args: { flip: true, style: { right: '20%', top: '50%' } },
};

/** Waiting for an assignment (accent outline) — pair with a Tooltip hint. */
export const Armed: Story = {
  args: { armed: true, style: { left: '20%', top: '50%' } },
};

/** Carrying a non-default assignment: kicker = the physical button. */
export const Assigned: Story = {
  args: { assigned: true, title: 'Mouse 4', value: 'MOUS L 2X', style: { left: '20%', top: '50%' } },
};

/** Switched off — visual state only; stays clickable so it can be re-enabled. */
export const Off: Story = {
  args: { off: true, title: 'Mouse 5', value: 'Disabled', style: { left: '20%', top: '50%' } },
};
