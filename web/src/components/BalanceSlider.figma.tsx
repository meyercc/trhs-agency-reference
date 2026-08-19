import figma from '@figma/code-connect';
import { BalanceSlider } from './BalanceSlider';

/**
 * Figma Code Connect — Balance sliders → React <BalanceSlider>. (Hadouken,
 * cross-library.) Two Figma components both map to our one centre-fill
 * BalanceSlider (centre = 50 on a 0–100 range); the Variant chooses the position.
 * State=Disabled → disabled. (Track/Handle/Value Popup are CSS primitives.)
 */

// Centered Balance Slider — Left … Right.
figma.connect(
  BalanceSlider,
  'https://www.figma.com/design/l4GUYJJCfRPLWX7WeFICsV/Hadouken-Design-System?node-id=14367-24092',
  {
    props: {
      value: figma.enum('Variant', {
        'Left Balance': 0,
        'Mid Left Balance': 25,
        'Mid Balance': 50,
        'Mid Right Balance': 75,
        'Right Balance': 100,
      }),
      disabled: figma.enum('State', { Disabled: true }),
    },
    example: ({ value, disabled }) => (
      <BalanceSlider min={0} max={100} defaultValue={value} disabled={disabled} onChange={() => {}} />
    ),
  },
);

// Balance Slider — Low / Mid / High.
figma.connect(
  BalanceSlider,
  'https://www.figma.com/design/l4GUYJJCfRPLWX7WeFICsV/Hadouken-Design-System?node-id=13088-17546',
  {
    props: {
      value: figma.enum('Variant', { Low: 0, Mid: 50, High: 100 }),
      disabled: figma.enum('State', { Disabled: true }),
    },
    example: ({ value, disabled }) => (
      <BalanceSlider min={0} max={100} defaultValue={value} disabled={disabled} onChange={() => {}} />
    ),
  },
);
