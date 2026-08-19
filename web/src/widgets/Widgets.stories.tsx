import type { Meta, StoryObj } from '@storybook/react';
import { withAppProviders } from '../../.storybook/AppProviders';
import { CATALOG, RENDERERS } from './catalog';
import './board.css';
import './widgets.css';

const meta: Meta = {
  title: 'Organisms/Widget Gallery',
  decorators: [withAppProviders],
  parameters: {
    docs: {
      description: {
        component:
          'Every widget in the board catalog (`widgets/catalog.tsx`), rendered from the same ' +
          '`CATALOG` + `RENDERERS` registry the board and the add-widget picker use, at its ' +
          'default board size on the real 6-column board grid. New widgets appear here the ' +
          'moment they are registered — nothing is hand-picked. Grouped by the catalog’s own ' +
          'categories; module-gated widgets are shown regardless of module state (this is the ' +
          'catalog, not the board).',
      },
    },
  },
};
export default meta;

type Story = StoryObj;

const CATS = [...new Set(CATALOG.map((m) => m.cat))];

export const Gallery: Story = {
  render: () => (
    <div style={{ width: 'min(1080px, 100%)', display: 'grid', gap: 'var(--gutter-lg)' }}>
      {CATS.map((cat) => (
        <section key={cat} style={{ display: 'grid', gap: 'var(--gutter-sm)' }}>
          <div className="wg-sub">{cat}</div>
          <div className="wb-grid">
            {CATALOG.filter((m) => m.cat === cat).map((m) => (
              <div key={m.id} className="wb-cell" style={{ gridColumn: `span ${m.span}`, gridRow: `span ${m.rows}` }}>
                {RENDERERS[m.id]()}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};
