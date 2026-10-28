import type { Preview } from '@storybook/react';
import { themes } from '@storybook/theming';
// Stories render against the REAL design system. Hadouken primitives load
// first, as in main.tsx — tokens.css references them (e.g. the default accent).
import '../../shared/tokens.hadouken.css';
import '../../shared/tokens.css';
import '../../shared/components.css';
import { BP } from '../src/app/breakpoints';

/** One preset per step of the scale (tokens.css, Breakpoints), at a width inside it. */
const STEP_VIEWPORTS = {
  compact: { name: 'Compact (phone)', styles: { width: '390px', height: '844px' }, type: 'mobile' as const },
  medium: { name: `Medium (${BP.medium}+)`, styles: { width: '820px', height: '1180px' }, type: 'tablet' as const },
  expanded: { name: `Expanded (${BP.expanded}+)`, styles: { width: '1280px', height: '800px' }, type: 'desktop' as const },
  wide: { name: `Wide (${BP.wide}+)`, styles: { width: '1920px', height: '1080px' }, type: 'desktop' as const },
  ultra: { name: `Ultra (${BP.ultra}+)`, styles: { width: '2560px', height: '1440px' }, type: 'desktop' as const },
};

const preview: Preview = {
  parameters: {
    // The global decorator owns the canvas + centering, so render every story
    // full-bleed (no per-layout padding). Stories should NOT set their own
    // `layout` — it would re-introduce the padding/white border.
    layout: 'fullscreen',
    // The viewport toolbar offers the five steps; the canvas is a `page`
    // container (decorator below), so a page story's container rules follow.
    viewport: { viewports: STEP_VIEWPORTS },
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
            // The page container (shell.css `.shell-scroll`): page CSS queries
            // `@container page`, so the canvas answers for it here and the
            // viewport toolbar drives those rules too.
            containerType: 'inline-size',
            containerName: 'page',
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
