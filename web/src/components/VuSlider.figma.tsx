import figma from '@figma/code-connect';
import { VuSlider } from './VuSlider';

/**
 * Figma Code Connect — VU Slider → React <VuSlider>. (Hadouken, cross-library.)
 * Variant (VU Meter - …) → our `variant`; State=Disabled → disabled.
 */
figma.connect(
  VuSlider,
  'https://www.figma.com/design/l4GUYJJCfRPLWX7WeFICsV/Hadouken-Design-System?node-id=13088-31187',
  {
    props: {
      variant: figma.enum('Variant', {
        'VU Meter - Default': 'default',
        'VU Meter - Reference': 'reference',
        'VU Meter - Peak': 'peak',
        'VU Meter - Clipping': 'clipping',
      }),
      disabled: figma.enum('State', { Disabled: true }),
    },
    example: ({ variant, disabled }) => (
      <VuSlider variant={variant} min={0} max={100} defaultValue={50} disabled={disabled} onChange={() => {}} />
    ),
  },
);
