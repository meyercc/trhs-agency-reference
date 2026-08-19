import type { Meta, StoryObj } from '@storybook/react';
import { ModalShell } from './ModalShell';
import { Button } from './Button';

/**
 * `.modal-shell` is a fixed-position overlay (`inset: 108px` against the app
 * viewport), so unframed it escapes the story block and the block renders
 * empty. A transformed ancestor becomes the containing block for
 * `position: fixed`, so this explicitly-sized frame pulls the modal inside
 * the story.
 */
const frame = (Story: React.ComponentType) => (
  <div style={{ transform: 'translateZ(0)', width: 'min(1200px, 92vw)', height: 640 }}>
    <Story />
  </div>
);

const meta: Meta<typeof ModalShell> = {
  title: 'Templates/ModalShell',
  component: ModalShell,
  decorators: [frame],
  args: { open: true },
  argTypes: { onClose: { action: 'closed' } },
  parameters: {
    docs: {
      description: {
        component:
          'The page-level modal template: breadcrumb bar (back + title + close) over a ' +
          '`.modal-body` that is two-column with a `left` hero/sidebar (~300px) or single-column ' +
          'without one. Every routed modal surface composes this shell — see Pages/Module ' +
          'Browser for it filled with real content. Toggle `open` to see the enter/exit ' +
          'transition; in the app the shell stays mounted and `open` drives it.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof ModalShell>;

export const TwoColumn: Story = {
  args: { title: 'OMEN AI' },
  render: (args) => (
    <ModalShell {...args}
      left={
        <div style={{ color: 'var(--text-dim)' }}>
          <h3 style={{ fontFamily: 'var(--font-cond)', color: 'var(--text-primary)', marginTop: 0 }}>OMEN AI</h3>
          <p>Adaptive tuning that learns the best configuration for your machine.</p>
        </div>
      }
    >
      <div style={{ color: 'var(--text-dim)', display: 'grid', gap: 'var(--gutter)' }}>
        <p style={{ margin: 0 }}>Right-side content area (<code>.modal-right</code>) — scrollable.</p>
        <div>
          <Button variant="accent">Primary action</Button>
        </div>
      </div>
    </ModalShell>
  ),
};

export const SingleColumn: Story = {
  args: { title: 'Settings' },
  render: (args) => (
    <ModalShell {...args}>
      <div style={{ color: 'var(--text-dim)' }}>
        <p style={{ marginTop: 0 }}>Single-column modal — no left panel.</p>
      </div>
    </ModalShell>
  ),
};
