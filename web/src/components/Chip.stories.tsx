import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Chip } from './Chip';
import { Icon } from './Icon';

const Star = () => <Icon name="star" size="sm" />;
const OmenAi = () => <Icon name="ai" size="sm" />;

const meta: Meta<typeof Chip> = {
  title: 'Atoms/Chip',
  component: Chip,
  args: { children: 'Label' },
  argTypes: { selected: { control: 'boolean' }, disabled: { control: 'boolean' } },
};
export default meta;

type Story = StoryObj<typeof Chip>;

export const Default: Story = {};
export const Selected: Story = { args: { selected: true } };
export const WithIcon: Story = { args: { icon: <Star />, children: 'Favorites' } };
export const IconOnly: Story = { args: { iconOnly: true, icon: <Star />, selected: true, 'aria-label': 'Favorites' } };
export const Disabled: Story = { args: { disabled: true } };

/** Selectable filters above a library — single selection. */
export const Filters: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const filters = [
      { id: 'all', label: 'All' },
      { id: 'favorites', label: 'Favorites', icon: <Star /> },
      { id: 'omen-ai', label: 'OMEN AI', icon: <OmenAi /> },
    ];
    const [active, setActive] = useState('all');
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        {filters.map((f) => (
          <Chip key={f.id} icon={f.icon} selected={active === f.id} onClick={() => setActive(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>
    );
  },
};
