import figma from '@figma/code-connect';
import { Toggle } from './Toggle';

/**
 * Figma Code Connect — Toggle → React <Toggle>.
 *
 * ⚠️ TEMP SOURCE: connected to the **Hadouken Design System** file
 * (l4GUYJJCfRPLWX7WeFICsV, node 109:3133) during migration. After the Treehouse
 * toggle is updated to the Hadouken style, repoint this URL at the Treehouse
 * Toggle node, `figma connect publish`, then
 * `figma connect unpublish --node <this hadouken url>`. The code component stays
 * the anchor — only the URL changes.
 *
 * Mapped props: Variant (On/Off) → checked; State=Disabled → disabled.
 * State=Default/Focus are runtime/visual states with no <Toggle> prop.
 */
figma.connect(
  Toggle,
  'https://www.figma.com/design/l4GUYJJCfRPLWX7WeFICsV/Hadouken-Design-System?node-id=109-3133',
  {
    props: {
      checked: figma.enum('Variant', { On: true, Off: false }),
      disabled: figma.enum('State', { Disabled: true }),
    },
    example: ({ checked, disabled }) => <Toggle checked={checked} disabled={disabled} onChange={() => {}} />,
  },
);
