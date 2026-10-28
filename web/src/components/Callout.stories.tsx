import type React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Callout, CalloutLeader, type CalloutProps } from './Callout';

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

// ── Overlay variant ──────────────────────────────────────────────────────
// The Figma "Button Overlay" over a device render, with its CalloutLeader.
// The stage is in design px (120 × 40 boxes); a real hero scales it as one.

const STAGE = { w: 360, h: 120 };

function OverlayStage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {children}
    </div>
  );
}

type OverlayState = Pick<CalloutProps, 'armed' | 'assigned' | 'off' | 'dropTarget'>;

/** One overlay callout and its leader, from a box at the left to a dot at the right. */
function OverlayPair({ value, state, label }: { value: string; state: OverlayState; label: string }) {
  return (
    <OverlayStage>
      <svg viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} aria-hidden="true">
        <CalloutLeader start={[145, 60]} run={60} end={[260, 96]} {...state} />
      </svg>
      <span style={{ position: 'absolute', left: 'var(--gutter)', top: 'calc(50% - var(--callout-overlay-h) / 2)' }}>
        <Callout variant="overlay" value={value} aria-label={label} {...state} />
      </span>
    </OverlayStage>
  );
}

/** Resting overlay: the button's own name. */
export const Overlay: Story = {
  render: () => <OverlayPair value="Mouse Left" label="Mouse Left" state={{}} />,
};

/** Armed: accent stroke on box and line, the label hidden (a Tooltip asks for a key). */
export const OverlayArmed: Story = {
  render: () => <OverlayPair value="Mouse Left" label="Mouse Left, waiting for a key" state={{ armed: true }} />,
};

/** Assigned: the accent wash, the assignment as the label. */
export const OverlayAssigned: Story = {
  render: () => <OverlayPair value="MOUS L 2X" label="Mouse 4, assigned MOUS L 2X" state={{ assigned: true }} />,
};

/** Disabled: the red wash, and the word — never the color alone. */
export const OverlayDisabled: Story = {
  render: () => <OverlayPair value="Disabled" label="Mouse 5, disabled" state={{ off: true }} />,
};

/** A key chip is being dragged over it. */
export const OverlayDropTarget: Story = {
  render: () => <OverlayPair value="Mouse Left" label="Mouse Left" state={{ dropTarget: true }} />,
};
