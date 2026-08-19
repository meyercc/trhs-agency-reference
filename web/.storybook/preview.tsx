import type { Preview } from '@storybook/react';
import { themes } from '@storybook/theming';
// Stories render against the REAL design system.
import '../../shared/tokens.css';
import '../../shared/components.css';

const preview: Preview = {
  parameters: {
    // The global decorator owns the canvas + centering, so render every story
    // full-bleed (no per-layout padding). Stories should NOT set their own
    // `layout` — it would re-introduce the padding/white border.
    layout: 'fullscreen',
    // The Theme toolbar owns the canvas (via --bg-base), so the backgrounds
    // addon is disabled to avoid conflicting fills.
    backgrounds: { disable: true },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // Sidebar: the Changelog docs page leads, then atomic design
    // (atomicdesign.bradfrost.com): Atoms → Molecules → Organisms →
    // Templates → Pages, components alphabetical within each tier.
    options: {
      storySort: {
        method: 'alphabetical',
        order: ['Changelog', 'Atoms', 'Molecules', 'Organisms', 'Templates', 'Pages'],
      },
    },
    // Code inspector: each story's "Show code" uses the STATIC story source.
    // (`dynamic` serializes the rendered React tree, which stack-overflows on
    // Framer-`Reorder`/`motion` trees and JSX-in-props, and wedges Docs-page
    // navigation — `code` is predictable and crash-free.) Dark docs theme.
    docs: { theme: themes.dark, source: { type: 'code' } },
  },
  // Generate a Docs tab (with per-story "Show code") for every component.
  tags: ['autodocs'],
  // Toolbar toggle to preview every story in either design-system theme.
  globalTypes: {
    theme: {
      description: 'Design system theme',
      defaultValue: 'dark',
      toolbar: {
        title: 'Theme',
        icon: 'contrast',
        items: [
          { value: 'dark', title: 'Dark', icon: 'moon' },
          { value: 'light', title: 'Light', icon: 'sun' },
        ],
        dynamicTitle: true,
      },
    },
  },
  // Render every story on the real canvas; the toolbar theme scopes the tokens
  // via .ds-theme-dark / .ds-theme-light so var(--bg-base) etc. follow along.
  decorators: [
    (Story, context) => {
      // In the Docs tab, story blocks stack vertically — size to content rather
      // than filling the viewport (which would make each block 100vh tall).
      const isDocs = context.viewMode === 'docs';
      return (
        <div
          className={context.globals.theme === 'light' ? 'ds-theme-light' : 'ds-theme-dark'}
          style={{
            boxSizing: 'border-box',
            width: '100%',
            minHeight: isDocs ? 0 : '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: isDocs ? 24 : 32,
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
          }}
        >
          <Story />
        </div>
      );
    },
  ],
};
export default preview;
