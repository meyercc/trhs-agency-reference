import figma from '@figma/code-connect';
import { Button } from './Button';

/**
 * Figma Code Connect — Button → React <Button>. (Hadouken, cross-library;
 * repoint to the Treehouse node post-migration.)
 *
 * Label → children; Type Primary/Secondary → our accent/default variant;
 * State=Disabled → disabled. (Variant=Icon/Split/Floating + Show Icon aren't
 * modeled — those are the icon-button treatment, a separate code concern.)
 */
figma.connect(
  Button,
  'https://www.figma.com/design/l4GUYJJCfRPLWX7WeFICsV/Hadouken-Design-System?node-id=106-16950',
  {
    props: {
      label: figma.string('Label'),
      variant: figma.enum('Type', { Primary: 'accent', Secondary: 'default' }),
      disabled: figma.enum('State', { Disabled: true }),
    },
    example: ({ label, variant, disabled }) => (
      <Button variant={variant} disabled={disabled}>
        {label}
      </Button>
    ),
  },
);
