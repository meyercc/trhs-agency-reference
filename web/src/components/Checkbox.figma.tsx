import figma from '@figma/code-connect';
import { Checkbox } from './Checkbox';

/**
 * Figma Code Connect → React <Checkbox>.
 *
 * ⚠️ Cross-library: points at the **Hadouken Design System** (l4GUYJJCfRPLWX7WeFICsV,
 * node 109:12909) during migration. Repoint at the Treehouse node once it lands,
 * then `unpublish --node <hadouken url>`.
 *
 * Variant On → checked; Variant Indeterminate → indeterminate; State=Disabled →
 * disabled. (Focus / the redundant State=On are runtime/visual states.)
 */
figma.connect(
  Checkbox,
  'https://www.figma.com/design/l4GUYJJCfRPLWX7WeFICsV/Hadouken-Design-System?node-id=109-12909',
  {
    props: {
      checked: figma.enum('Variant', { On: true, Off: false, Indeterminate: false }),
      indeterminate: figma.enum('Variant', { Indeterminate: true }),
      disabled: figma.enum('State', { Disabled: true }),
    },
    example: ({ checked, indeterminate, disabled }) => (
      <Checkbox checked={checked} indeterminate={indeterminate} disabled={disabled} onChange={() => {}} />
    ),
  },
);
