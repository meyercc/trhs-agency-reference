import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip, type TooltipPlacement } from './Tooltip';
import { Button } from './Button';

const meta: Meta<typeof Tooltip> = {
  title: 'Molecules/Tooltip',
  component: Tooltip,
  args: {
    content: 'This description will explain something complicated to the user if written correctly ;-)',
    placement: 'top',
  },
  argTypes: {
    placement: { control: 'inline-radio', options: ['top', 'bottom', 'left', 'right'] },
    open: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<typeof Tooltip>;

/** Hover or focus the trigger. */
export const Default: Story = {
  render: (args) => (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 160 }}>
      <Tooltip {...args}>
        <Button>Hover me</Button>
      </Tooltip>
    </div>
  ),
};

/** The four placements (forced open). */
export const Placements: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const cells: TooltipPlacement[] = ['top', 'bottom', 'left', 'right'];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, padding: 60, placeItems: 'center' }}>
        {cells.map((p) => (
          <Tooltip key={p} placement={p} open content={`Tooltip · ${p}`}>
            <Button variant="ghost">{p}</Button>
          </Tooltip>
        ))}
      </div>
    );
  },
};
