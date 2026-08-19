import figma from '@figma/code-connect';
import { Dropdown } from './Dropdown';

/**
 * Figma Code Connect — Dropdown → React <Dropdown>. (Hadouken, cross-library;
 * repoint to the Treehouse node post-migration.)
 *
 * Our Dropdown is options-driven: the trigger shows the selected option and the
 * menu renders from `options`. So the Figma Label/State (Default/Hover/Open/
 * Disabled) don't bind to props — this is a representative usage snippet.
 */
figma.connect(
  Dropdown,
  'https://www.figma.com/design/l4GUYJJCfRPLWX7WeFICsV/Hadouken-Design-System?node-id=8146-363084',
  {
    example: () => (
      <Dropdown
        aria-label="Sort"
        options={[
          { label: 'Recently Played', value: 'recent' },
          { label: 'A–Z', value: 'az' },
          { label: 'Most Played', value: 'most' },
        ]}
      />
    ),
  },
);
