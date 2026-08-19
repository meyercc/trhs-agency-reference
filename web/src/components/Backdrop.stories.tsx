import type { Meta, StoryObj } from '@storybook/react';
import { Backdrop } from './Backdrop';

const meta: Meta<typeof Backdrop> = {
  title: 'Atoms/Backdrop',
  component: Backdrop,
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'heavy', 'plain'] },
  },
};
export default meta;

type Story = StoryObj<typeof Backdrop>;

// Sample content behind the scrim so the blur is visible.
const Behind = () => (
  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', gap: 12 }}>
    <div style={{ width: 320, height: 200, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))' }} />
  </div>
);

export const Default: Story = {
  render: (args) => (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Behind />
      <Backdrop {...args}>
        <div className="ds-text-title-2" style={{ color: 'var(--text-primary)' }}>
          Backdrop
        </div>
      </Backdrop>
    </div>
  ),
};

export const Heavy: Story = { ...Default, args: { variant: 'heavy' } };
export const Plain: Story = { ...Default, args: { variant: 'plain' } };
