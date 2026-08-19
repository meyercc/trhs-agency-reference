import figma from '@figma/code-connect';
import { Input } from './Input';

/**
 * Figma Code Connect — "Text Fields" → React <Input>. (Hadouken, cross-library.)
 *
 * Variant Standard/Search/DPI/HEX → standard/search/numeric/hex; the field text
 * (Label) → placeholder; State=Disabled → disabled. The other States (Hover,
 * Active, Error, …) are runtime/visual; Error additionally has our `error` prop.
 */
figma.connect(
  Input,
  'https://www.figma.com/design/l4GUYJJCfRPLWX7WeFICsV/Hadouken-Design-System?node-id=172-2201',
  {
    props: {
      variant: figma.enum('Variant', { Standard: 'standard', Search: 'search', DPI: 'numeric', HEX: 'hex' }),
      placeholder: figma.string('Label'),
      disabled: figma.enum('State', { Disabled: true }),
    },
    example: ({ variant, placeholder, disabled }) => (
      <Input variant={variant} placeholder={placeholder} disabled={disabled} />
    ),
  },
);
