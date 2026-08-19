import type { Meta, StoryObj } from '@storybook/react';
import { VuSlider, type VuVariant } from './VuSlider';

const meta: Meta<typeof VuSlider> = {
  title: 'Molecules/VuSlider',
  component: VuSlider,
  args: { min: 0, max: 100, defaultValue: 50, variant: 'default' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'reference', 'peak', 'clipping'] },
    showValue: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof VuSlider>;

/** Drag (or focus + arrows) to see the value popup. */
export const Default: Story = {};

/** The four meter colourings. */
export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const variants: VuVariant[] = ['default', 'reference', 'peak', 'clipping'];
    return (
      <div style={{ display: 'grid', gap: 28, width: 280 }}>
        {variants.map((variant) => (
          <VuSlider key={variant} variant={variant} defaultValue={60} />
        ))}
      </div>
    );
  },
};

/** Active (popup shown) across the variants. */
export const Active: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const variants: VuVariant[] = ['default', 'reference', 'peak', 'clipping'];
    return (
      <div style={{ display: 'grid', gap: 40, width: 280 }}>
        {variants.map((variant) => (
          <VuSlider key={variant} variant={variant} defaultValue={50} showValue />
        ))}
      </div>
    );
  },
};

/** Disabled. */
export const Disabled: Story = {
  parameters: { controls: { disable: true } },
  render: () => <VuSlider variant="clipping" defaultValue={70} disabled />,
};
