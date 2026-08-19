import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ContextMenu, ContextMenuLabel } from './ContextMenu';
import { ListItem } from './ListItem';
import { Separator } from './Separator';
import { Checkbox } from './Checkbox';
import { Radio } from './Radio';
import { Icon } from './Icon';

const meta: Meta<typeof ContextMenu> = {
  title: 'Molecules/ContextMenu',
  component: ContextMenu,
  decorators: [(Story) => <div style={{ width: 248 }}>{Story()}</div>],
};
export default meta;

type Story = StoryObj<typeof ContextMenu>;

const SORTS = [
  { value: 'name', label: 'Name' },
  { value: 'date', label: 'Date modified' },
  { value: 'size', label: 'Size' },
];

/**
 * The ContextMenu primitive with the full range of row types — action items
 * with leading icons, a submenu row (trailing chevron), a plain item, a
 * checkbox group, and a radio group — composed from `ListItem` slots and
 * `Separator` / `ContextMenuLabel`. Intentionally generic content so the story
 * documents the panel itself (see `Organisms/GameTileMenu` for a real, anchored,
 * dismissible menu built on top of it).
 */
export const Default: Story = {
  render: () => {
    const [details, setDetails] = useState(true);
    const [hidden, setHidden] = useState(false);
    const [sort, setSort] = useState('name');
    return (
      <ContextMenu aria-label="Item actions">
        <ListItem role="menuitem" leading={<Icon name="edit" size="sm" />} label="Edit" />
        <ListItem role="menuitem" leading={<Icon name="duplicate" size="sm" />} label="Duplicate" />
        <ListItem role="menuitem" leading={<Icon name="share" size="sm" />} label="Share" trailing={<Icon name="chevron-right" size={12} />} />
        <ListItem role="menuitem" leading={<Icon name="trash" size="sm" />} label="Delete" />
        <ListItem role="menuitem" label="Rename…" />

        <Separator />
        <ContextMenuLabel>View</ContextMenuLabel>
        <ListItem
          role="menuitemcheckbox"
          aria-checked={details}
          leading={<Checkbox checked={details} onChange={() => setDetails((v) => !v)} />}
          label="Show details"
          onClick={() => setDetails((v) => !v)}
        />
        <ListItem
          role="menuitemcheckbox"
          aria-checked={hidden}
          leading={<Checkbox checked={hidden} onChange={() => setHidden((v) => !v)} />}
          label="Show hidden files"
          onClick={() => setHidden((v) => !v)}
        />

        <Separator />
        <ContextMenuLabel>Sort by</ContextMenuLabel>
        {SORTS.map((s) => (
          <ListItem
            key={s.value}
            role="menuitemradio"
            aria-checked={sort === s.value}
            leading={<Radio name="cm-sort" checked={sort === s.value} onChange={() => setSort(s.value)} />}
            label={s.label}
            onClick={() => setSort(s.value)}
          />
        ))}
      </ContextMenu>
    );
  },
};
