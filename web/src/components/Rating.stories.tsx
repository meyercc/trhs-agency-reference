import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Rating } from './Rating';

const meta: Meta<typeof Rating> = {
  title: 'Components/Rating',
  component: Rating,
  args: { value: 4.3 },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 5, step: 0.1 } },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Five stars. Display is a fractional fill — a filled row clipped over an outline row, so a ' +
          'partial star reads by shape, not only color — announced as one image ("4.3 out of 5 stars"). ' +
          'Pass `onChange` and it becomes a radiogroup input with Arrow-key movement (Forge ratings). ' +
          'Avalonia: an ItemsControl of five PathIcons; the input is a single-select ListBox.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof Rating>;

export const Display: Story = {};
export const Small: Story = { args: { size: 'sm', value: 4.7 } };
export const Large: Story = { args: { size: 'lg', value: 3.6 } };

const LABELS = ['Doesn’t work', 'Poor', 'OK', 'Good', 'Excellent'];
export const Input: Story = {
  render: () => {
    const [v, setV] = useState(0);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gutter-xs)' }}>
        <Rating value={v} onChange={setV} label="Your rating" starLabels={LABELS} />
        <span style={{ color: 'var(--text-dim)', fontSize: 'var(--text-caption)' }}>{v ? LABELS[v - 1] : 'Tap a star'}</span>
      </div>
    );
  },
};
export const InputDisabled: Story = { render: () => <Rating value={0} onChange={() => {}} label="Your rating" disabled /> };

export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--gutter-sm)', justifyItems: 'start' }}>
      <Rating value={4.7} size="sm" />
      <Rating value={4.3} />
      <Rating value={2.5} size="lg" />
      <Rating value={4} onChange={() => {}} label="Your rating" />
      <Rating value={0} onChange={() => {}} label="Locked rating" disabled />
    </div>
  ),
};
