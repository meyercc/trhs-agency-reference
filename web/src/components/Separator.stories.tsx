import type { Meta, StoryObj } from '@storybook/react';
import { Separator } from './Separator';

const meta: Meta<typeof Separator> = {
  title: 'Atoms/Separator',
  component: Separator,
  argTypes: {
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
  },
};
export default meta;

type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div style={{ width: 256 }}>
      <Separator />
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'stretch', height: 24, gap: 12, color: 'var(--text-dim)' }}>
      <span>A</span>
      <Separator orientation="vertical" />
      <span>B</span>
      <Separator orientation="vertical" />
      <span>C</span>
    </div>
  ),
};
