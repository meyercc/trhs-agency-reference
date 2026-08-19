import figma from '@figma/code-connect';
import { VerticalSlider } from './VerticalSlider';

/**
 * Figma Code Connect — Vertical Slider → React <VerticalSlider>. (Hadouken,
 * cross-library.) Track + Handle + Value Popup are design primitives (CSS), not
 * mapped. Variant (0%–100%) → defaultValue; State=Disabled → disabled.
 */
figma.connect(
  VerticalSlider,
  'https://www.figma.com/design/l4GUYJJCfRPLWX7WeFICsV/Hadouken-Design-System?node-id=13088-31201',
  {
    props: {
      value: figma.enum('Variant', {
        '0%': 0,
        '10%': 10,
        '20%': 20,
        '30%': 30,
        '40%': 40,
        '50%': 50,
        '60%': 60,
        '70%': 70,
        '80%': 80,
        '90%': 90,
        '100%': 100,
      }),
      disabled: figma.enum('State', { Disabled: true }),
    },
    example: ({ value, disabled }) => (
      <VerticalSlider min={0} max={100} defaultValue={value} disabled={disabled} onChange={() => {}} />
    ),
  },
);
