import type { Meta, StoryObj } from '@storybook/react';
import { Price } from './Price';

const meta: Meta<typeof Price> = {
  title: 'Atoms/Price',
  component: Price,
  parameters: {
    docs: {
      source: { type: 'code' },
      description: {
        component:
          'A price, or a sale price beside the struck-through original. The `.ds-card-prices` pair the Shop card ' +
          'already draws, as a component — so the Deals widget and a composed card’s deals block use the same pair ' +
          'rather than hand-rolling the green and the strike (TH-450). `now` is green only when `was` is given.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof Price>;

export const Plain: Story = { args: { now: '$59.99' } };
export const Free: Story = { args: { now: 'Free' } };
export const OnSale: Story = { args: { now: '$10.49', was: '$59.99' } };
