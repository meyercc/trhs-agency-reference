import figma from '@figma/code-connect';
import { Slider } from './Slider';

/**
 * Figma Code Connect — "Slider" set → React <Slider>.
 *
 * The Figma component nests Track + Slider Handle (+ a Value Popup) as design
 * primitives. In code those are CSS pseudo-elements on a native range input
 * (`::-webkit-slider-thumb` / `-runnable-track`), so there's nothing standalone
 * to map — we connect the whole set to <Slider>.
 *
 * Mapped Figma props:
 *   - Variant (0%–100% fill) → defaultValue (0–100, our default min/max)
 *   - State=Disabled         → disabled
 * State=Active, the handle's Popup, and the Value Popup text are runtime/visual
 * states with no <Slider> prop (the value readout is composed by consumers).
 *
 * Sibling sliders (Vertical / Color / Balance / Vu) are separate Figma
 * components → each gets its own *.figma.tsx once we have their links.
 */
figma.connect(
  Slider,
  'https://www.figma.com/design/eD0UJtTacYOlS6V7k3Aegf/Treehouse-Component-Library?node-id=5759-5814',
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
      <Slider min={0} max={100} defaultValue={value} disabled={disabled} onChange={() => {}} />
    ),
  },
);
