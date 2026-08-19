import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from './Textarea';

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';

const meta: Meta<typeof Textarea> = {
  title: 'Molecules/Textarea',
  component: Textarea,
  args: {
    placeholder: 'Text Area',
    rows: 6,
  },
  argTypes: {
    error: { control: 'text' },
    rows: { control: { type: 'number', min: 2, max: 16 } },
  },
};
export default meta;

type Story = StoryObj<typeof Textarea>;

/** Empty field with a placeholder. */
export const Default: Story = {
  args: { style: { width: 430 } },
};

/** Filled and scrolling — the custom pill scrollbar appears on overflow. */
export const Filled: Story = {
  parameters: { controls: { disable: true } },
  render: () => <Textarea defaultValue={LOREM + ' ' + LOREM} rows={8} style={{ width: 430 }} />,
};

/** Default, filled, error, and disabled. */
export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gap: 20, width: 430 }}>
      <Textarea placeholder="Text Area" rows={3} />
      <Textarea defaultValue="Lorem ipsum dolor sit amet." rows={3} />
      <Textarea defaultValue="Lorem ipsum dolor sit amet." rows={3} error="That value isn't allowed." />
      <Textarea defaultValue="Lorem ipsum dolor sit amet." rows={3} disabled />
    </div>
  ),
};
