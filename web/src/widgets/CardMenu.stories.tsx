import type { Meta, StoryObj } from '@storybook/react';
import { useState, type ReactNode } from 'react';
import { withAppProviders } from '../../.storybook/AppProviders';
import { Button, ContextMenu, Icon, ListItem, Toggle, WidgetShell } from '../components';
import { CellActionsContext } from './cellActions';
import { CardMenu } from './CardMenu';
import './board.css';
import './device-card.css';

const meta: Meta<typeof CardMenu> = {
  title: 'Organisms/Card Menu',
  component: CardMenu,
  decorators: [withAppProviders],
  parameters: {
    docs: {
      description: {
        component:
          'The ⋮ «More options» menu every widget card on Home carries in its top-right corner — ' +
          'one place for everything the card itself can do. Library parts only: `IconButton` ghost ' +
          '+ `more`, the library `Tooltip` (opens to the left — the ⋮ sits in a corner of a card that ' +
          'clips), `ContextMenu` with `ListItem` rows. `Remove from Home` is added last by the menu ' +
          'itself whenever the card sits in a board cell; a card passes its own rows above it ' +
          '(`items`), and a row can swap the menu for a panel in the same place (the monitor card’s ' +
          'Customize chooser). The board draws one on every cell; a card that draws its own makes ' +
          'the board’s step aside. Replaced the board’s hover-only corner ×.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof CardMenu>;

/** A card in a board cell — the menu needs the cell's `CellActionsContext` for Remove.
    `header` = a `WidgetShell` card (its link stays clear of the ⋮) · `device` = a
    header-less card like the device cards · `art` = a card whose corner is artwork. */
function Cell({ children, face = 'header', toTop }: { children: ReactNode; face?: 'header' | 'device' | 'art'; toTop?: boolean }) {
  const [gone, setGone] = useState(false);
  if (gone)
    return (
      <Button onClick={() => setGone(false)}>Card removed — put it back</Button>
    );
  return (
    <div className="wb-cell" style={{ width: 360, height: 180 }}>
      <CellActionsContext.Provider value={{ span: 3, rows: 1, remove: () => setGone(true), toTop: toTop ? () => {} : undefined }}>
        {face === 'art' ? (
          <div className="w" style={{ height: '100%', padding: 0, background: 'linear-gradient(135deg, #f5e03b 0%, #e0186c 55%, #4a0d2a 100%)' }} />
        ) : face === 'device' ? (
          <div className="w" style={{ height: '100%', justifyContent: 'flex-end' }}>
            <div className="devw-title">Treehouse 32</div>
            <div className="devw-sub">Monitor</div>
          </div>
        ) : (
          <WidgetShell title="Fan Speed" action={{ label: 'Fan Control', onClick: () => {} }} style={{ height: '100%' }} />
        )}
        {children}
      </CellActionsContext.Provider>
    </div>
  );
}

/** Every plain card: one row, Remove from Home. Hover the ⋮ for its tooltip. */
export const OnACard: Story = {
  render: () => (
    <Cell>
      <CardMenu name="Fan Speed" className="wb-card-menu" />
    </Cell>
  ),
};

/** Open — the menu under the ⋮, right edges aligned. */
export const Open: Story = {
  render: () => (
    <Cell>
      <CardMenu name="Fan Speed" className="wb-card-menu" defaultOpen />
    </Cell>
  ),
};

/** A header link's row, both kinds: a window opens over this page (`browser`),
    or you leave for another page (`shortcut` ↪) — one icon per meaning. */
export const RowIcons: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 220 }}>
      <Cell>
        <CardMenu name="Active Profile" className="wb-card-menu" defaultOpen items={[{ id: 'open', icon: 'browser', label: 'Manage', onSelect: () => {} }]} />
      </Cell>
      <Cell>
        <CardMenu name="CPU" className="wb-card-menu" defaultOpen items={[{ id: 'open', icon: 'shortcut', label: 'Undervolt', onSelect: () => {} }]} />
      </Cell>
    </div>
  ),
};

/** Two groups, a separator between: what the card holds (its link) · what the
    board does with the card (Move to the top on a narrow screen, Remove). */
export const Groups: Story = {
  render: () => (
    <Cell toTop>
      <CardMenu name="CPU" className="wb-card-menu" defaultOpen items={[{ id: 'open', icon: 'shortcut', label: 'Undervolt', onSelect: () => {} }]} />
    </Cell>
  ),
};

/** A card with its own rows above Remove — and a row that swaps in a panel
    (the monitor card's Customize chooser, here two rows of it). */
export const WithCardActions: Story = {
  render: () => {
    function Demo() {
      const [rows, setRows] = useState({ profile: true, brightness: true });
      const chooser = (
        <ContextMenu aria-label="Customize Treehouse 32">
          {(
            [
              ['profile', 'Profile', 'profile'],
              ['brightness', 'Brightness', 'brightness'],
            ] as const
          ).map(([k, label, icon]) => (
            <ListItem
              key={k}
              role="menuitemcheckbox"
              aria-checked={rows[k]}
              leading={<Icon name={icon} size={16} aria-hidden />}
              label={label}
              trailing={<Toggle checked={rows[k]} onChange={() => setRows((r) => ({ ...r, [k]: !r[k] }))} aria-label={label} />}
            />
          ))}
        </ContextMenu>
      );
      return (
        <Cell face="device">
          <CardMenu
            name="Treehouse 32"
            className="wb-card-menu"
            items={[{ id: 'customize', icon: 'edit', label: 'Customize', panel: chooser }]}
          />
        </Cell>
      );
    }
    return <Demo />;
  },
};

/** The one-time hint, held open beside the ⋮ until it is pressed (first visit only). */
export const WithHint: Story = {
  render: () => {
    function Demo() {
      const [seen, setSeen] = useState(false);
      return (
        <Cell face="device">
          <CardMenu
            name="Treehouse 32"
            className="wb-card-menu"
            hint={seen ? undefined : 'Customize this card here'}
            onPress={() => setSeen(true)}
          />
        </Cell>
      );
    }
    return <Demo />;
  },
};

/** Where the corner is artwork (Last Played), the ⋮ takes the library's surfaced
    icon button — a bare one disappears on art. */
export const OverArt: Story = {
  render: () => (
    <Cell face="art">
      <CardMenu name="Last Played" className="wb-card-menu" variant="default" />
    </Cell>
  ),
};
