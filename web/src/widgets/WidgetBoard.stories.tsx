import type { Meta, StoryObj } from '@storybook/react';
import { withAppProviders } from '../../.storybook/AppProviders';
import { WidgetBoard } from './WidgetBoard';

const meta: Meta<typeof WidgetBoard> = {
  title: 'Organisms/Widget Board',
  component: WidgetBoard,
  decorators: [withAppProviders],
  parameters: {
    docs: {
      description: {
        component:
          'The dashboard’s widget board: 6-column grid, drag a widget by its header to reorder ' +
          '(spring-animated, `framer-motion` layout), drag the corner handle to resize, remove ' +
          'with the corner ×, and add from the catalog picker. The layout persists to ' +
          '`localStorage` (`board-layout`), so edits made here survive a reload — module-gated ' +
          'widgets and disconnected devices are hidden, not deleted. The `spring` prop picks the ' +
          'reorder animation feel.',
      },
    },
  },
  argTypes: {
    spring: { control: 'inline-radio', options: ['snappy', 'smooth', 'bouncy'] },
  },
  args: { spring: 'snappy' },
};
export default meta;

type Story = StoryObj<typeof WidgetBoard>;

export const Default: Story = {
  render: (args) => (
    <div style={{ padding: 'var(--gutter)', maxWidth: 1000, margin: '0 auto' }}>
      <WidgetBoard {...args} />
    </div>
  ),
};
