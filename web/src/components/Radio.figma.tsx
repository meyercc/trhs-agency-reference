import figma from '@figma/code-connect';
import { Radio } from './Radio';

/**
 * Figma Code Connect — "Radio Select" → React <Radio>.
 *
 * ⚠️ Cross-library: points at the **Hadouken Design System** (l4GUYJJCfRPLWX7WeFICsV,
 * node 109:12910) during migration. Repoint at the Treehouse node once it lands,
 * then `unpublish --node <hadouken url>`.
 *
 * Variant On → checked; State=Disabled → disabled. (Focus is a runtime state.)
 */
figma.connect(
  Radio,
  'https://www.figma.com/design/l4GUYJJCfRPLWX7WeFICsV/Hadouken-Design-System?node-id=109-12910',
  {
    props: {
      checked: figma.enum('Variant', { On: true, Off: false }),
      disabled: figma.enum('State', { Disabled: true }),
    },
    example: ({ checked, disabled }) => <Radio checked={checked} disabled={disabled} onChange={() => {}} />,
  },
);
