import figma from '@figma/code-connect';
import { ToggleButtonGroup } from './ToggleButtonGroup';

/**
 * Figma Code Connect — "Toggle Button Group" → React <ToggleButtonGroup>. (Hadouken,
 * cross-library.)
 *
 * Our ToggleButtonGroup is data-driven (an `options` array), so the Figma Variant/Control
 * counts don't bind to props — this shows a representative usage snippet.
 */
figma.connect(
  ToggleButtonGroup,
  'https://www.figma.com/design/l4GUYJJCfRPLWX7WeFICsV/Hadouken-Design-System?node-id=17800-91307',
  {
    example: () => (
      <ToggleButtonGroup
        aria-label="View"
        value="all"
        onChange={() => {}}
        options={[
          { label: 'All', value: 'all' },
          { label: 'Favorites', value: 'favorites' },
        ]}
      />
    ),
  },
);
