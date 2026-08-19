import figma from '@figma/code-connect';
import { Swatch } from './Swatch';

/**
 * Figma Code Connect — Swatch → React <Swatch>. (Hadouken, cross-library.)
 *
 * Selected → selected. The Variant (1/2/3 Swatch-Up · Parent · Gradient) chooses
 * which fill prop you'd use (color / colors / gradient) — shown here as a single
 * colour example; swap to `colors={[…]}` or `gradient={RAINBOW}` as needed.
 */
figma.connect(
  Swatch,
  'https://www.figma.com/design/l4GUYJJCfRPLWX7WeFICsV/Hadouken-Design-System?node-id=114-30568',
  {
    props: {
      selected: figma.enum('Selected', { Yes: true, No: false }),
    },
    example: ({ selected }) => <Swatch color="var(--accent-cyan)" selected={selected} label="Cyan" />,
  },
);
