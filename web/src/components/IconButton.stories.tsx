import type { Meta, StoryObj } from '@storybook/react';
import { IconButton } from './IconButton';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

const meta: Meta<typeof IconButton> = {
  title: 'Atoms/IconButton',
  component: IconButton,
  args: { label: 'Module Browser', children: <Icon name="puzzle" size={16} /> },
  argTypes: {
    variant: { control: 'select', options: ['default', 'accent', 'ghost'] },
  },
};
export default meta;

type Story = StoryObj<typeof IconButton>;

/** The secondary surface — 32×32, 16px icon (Figma Button/Secondary icon-only). */
export const Default: Story = {};
export const Accent: Story = {
  args: { label: 'Play', children: <Icon name="play-fill" size={16} /> },
  render: (args) => <IconButton {...args} variant="accent" />,
};
export const Ghost: Story = { args: { variant: 'ghost' } };

/** Icon-only buttons usually pair with a tooltip that repeats the label. */
export const WithTooltip: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: 'var(--gutter)' }}>
      <Tooltip content="Module Browser" placement="bottom" open>
        <IconButton label="Module Browser">
          <Icon name="puzzle" size={16} />
        </IconButton>
      </Tooltip>
    </div>
  ),
};

export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--gutter-tablet)', alignItems: 'center' }}>
      <IconButton label="Module Browser">
        <Icon name="puzzle" size={16} />
      </IconButton>
      <IconButton label="Play" variant="accent">
        <Icon name="play-fill" size={16} />
      </IconButton>
      <IconButton label="Notifications" variant="ghost">
        <Icon name="alert" size={16} />
      </IconButton>
    </div>
  ),
};
