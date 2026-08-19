import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Atoms/Badge',
  component: Badge,
  args: { children: 'Badge' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'notification', 'count', 'deal', 'new', 'sale', 'coming', 'free', 'omen-ai', 'status'],
    },
    tone: { control: 'inline-radio', options: ['neutral', 'positive', 'warn', 'info', 'danger'] },
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;

// The three Hadouken badge types.
export const Notification: Story = { args: { variant: 'notification', children: '999+' } };
export const Count: Story = { args: { variant: 'count', children: '999+' } };
export const Deal: Story = { args: { variant: 'deal', children: '−100%' } };

export const Default: Story = {};
export const New: Story = { args: { variant: 'new', children: 'New' } };
export const Sale: Story = { args: { variant: 'sale', children: 'Sale' } };
export const Coming: Story = { args: { variant: 'coming', children: 'Coming Soon' } };
export const Free: Story = { args: { variant: 'free', children: 'Free' } };
export const OmenAI: Story = { args: { variant: 'omen-ai', children: 'OMEN AI' } };
export const StatusPositive: Story = { args: { variant: 'status', tone: 'positive', children: 'Connected' } };
export const StatusDanger: Story = { args: { variant: 'status', tone: 'danger', children: 'Error' } };

export const Types: Story = {
  name: 'All — Hadouken types',
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <Badge variant="notification">999+</Badge>
      <Badge variant="count">999+</Badge>
      <Badge variant="deal">−100%</Badge>
    </div>
  ),
};

export const Marketing: Story = {
  name: 'All — marketing',
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Badge variant="new">New</Badge>
      <Badge variant="sale">Sale</Badge>
      <Badge variant="coming">Coming Soon</Badge>
      <Badge variant="free">Free</Badge>
      <Badge variant="omen-ai">OMEN AI</Badge>
    </div>
  ),
};

export const Statuses: Story = {
  name: 'All — status',
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Badge variant="status">Neutral</Badge>
      <Badge variant="status" tone="positive">Positive</Badge>
      <Badge variant="status" tone="warn">Warning</Badge>
      <Badge variant="status" tone="info">Info</Badge>
      <Badge variant="status" tone="danger">Danger</Badge>
    </div>
  ),
};
