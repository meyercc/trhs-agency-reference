import figma from '@figma/code-connect';
import { Textarea } from './Textarea';

/**
 * Figma Code Connect — "Text Area" → React <Textarea>. (Hadouken, cross-library.)
 *
 * The field text (Text Area) → placeholder; State=Disabled → disabled. The other
 * States (Hover, Active, Error, Overflow) are runtime/visual; Error maps to the
 * `error` prop when you need the error row.
 */
figma.connect(
  Textarea,
  'https://www.figma.com/design/l4GUYJJCfRPLWX7WeFICsV/Hadouken-Design-System?node-id=8144-47957',
  {
    props: {
      placeholder: figma.string('Text Area'),
      disabled: figma.enum('State', { Disabled: true }),
    },
    example: ({ placeholder, disabled }) => <Textarea placeholder={placeholder} disabled={disabled} />,
  },
);
