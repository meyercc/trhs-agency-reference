import figma from '@figma/code-connect';
import { ColorSlider } from './ColorSlider';

/**
 * Figma Code Connect — Color Slider → React <ColorSlider>. (Hadouken,
 * cross-library.) Variant (Color Hue/Lightness/Opacity) → our `variant`;
 * State=Disabled → disabled.
 */
figma.connect(
  ColorSlider,
  'https://www.figma.com/design/l4GUYJJCfRPLWX7WeFICsV/Hadouken-Design-System?node-id=13088-31791',
  {
    props: {
      variant: figma.enum('Variant', {
        'Color Hue': 'hue',
        'Color Lightness': 'lightness',
        'Color Opacity': 'opacity',
      }),
      disabled: figma.enum('State', { Disabled: true }),
    },
    example: ({ variant, disabled }) => (
      <ColorSlider variant={variant} min={0} max={100} defaultValue={50} disabled={disabled} onChange={() => {}} />
    ),
  },
);
