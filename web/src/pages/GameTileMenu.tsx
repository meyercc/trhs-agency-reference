import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ContextMenu, ContextMenuLabel, ListItem, Separator, Checkbox, Radio, Icon, Input } from '../components';
import type { Game } from '../data/games';
import type { OptimizeState } from '../state/gameOptimize';

export type GamePlatform = 'steam' | 'geforce';
// The state moved to a persisted store (TH-504); the name still resolves here.
export type { OptimizeState };

export interface GameTileMenuProps {
  game: Game;
  /** Bounding rect of the ••• button the menu anchors to. */
  anchor: DOMRect;
  favorite: boolean;
  optimize: OptimizeState;
  platform: GamePlatform;
  onClose: () => void;
  /** Launch the game — `useLaunchGame` (TH-484). Until then this row only closed the menu. */
  onPlay?: () => void;
  /** Ask Who Made This about the game (docs/who-made-this-demo-plan.md); the row shows only when given. */
  onWhoMade?: () => void;
  /** Open the game's detail panel (TH-504) — "Details"; the row shows only when given. */
  onDetails?: () => void;
  /**
   * The collections other than Favorites (which has its own row), each with
   * whether this game is in it — "Add to collection" (TH-505). The group shows
   * only when given.
   */
  collections?: { id: string; name: string; checked: boolean }[];
  onToggleCollection?: (id: string) => void;
  /** A new collection holding this game. */
  onNewCollection?: (name: string) => void;
  onToggleFavorite: () => void;
  onRemove: () => void;
  onSetOptimize: (key: keyof OptimizeState, value: boolean) => void;
  onSetPlatform: (value: GamePlatform) => void;
}

// A radio/checkbox shown for state only — the ListItem row owns the click, so
// the control itself must not intercept it (nor take focus).
function Control({ children }: { children: ReactNode }) {
  return <span className="gtm-ctrl">{children}</span>;
}

/**
 * Per-tile context menu (the ••• on a GameTile) — Play / Favorites / Remove /
 * More Info, an Optimize group (Booster + OMEN AI), and a platform selector.
 * A fixed-position popover anchored to the button; closes on outside click / Esc.
 */
export function GameTileMenu({
  game,
  anchor,
  favorite,
  optimize,
  platform,
  onClose,
  onPlay,
  onWhoMade,
  onDetails,
  collections,
  onToggleCollection,
  onNewCollection,
  onToggleFavorite,
  onRemove,
  onSetOptimize,
  onSetPlatform,
}: GameTileMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Position under the button, right/down; flip up + clamp to stay on-screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const gap = 4;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.left;
    let top = anchor.bottom + gap;
    left = Math.max(8, Math.min(left, vw - width - 8));
    if (top + height > vh - 8) top = Math.max(8, anchor.top - height - gap);
    setPos({ left, top });
  }, [anchor]);

  // Dismiss on outside click / Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const act = (fn?: () => void) => {
    fn?.();
    onClose();
  };

  return (
    <div
      ref={ref}
      className="gtm-pop"
      style={{ position: 'fixed', left: pos?.left ?? anchor.left, top: pos?.top ?? anchor.bottom + 4, visibility: pos ? 'visible' : 'hidden' }}
    >
      <ContextMenu aria-label={`${game.title} options`}>
        <ListItem role="menuitem" leading={<Icon name="play-fill" size={16} />} label="Play" onClick={() => act(onPlay)} />
        <ListItem
          role="menuitem"
          leading={<Icon name={favorite ? 'star-fill' : 'star'} size={16} />}
          label={favorite ? 'Remove from Favorites' : 'Add to Favorites'}
          onClick={() => act(onToggleFavorite)}
        />
        <ListItem role="menuitem" leading={<Icon name="minus" size={16} />} label="Remove from Library" onClick={() => act(onRemove)} />
        {/* "More Info" was a dead row until the detail panel (TH-504). */}
        {onDetails && <ListItem role="menuitem" leading={<Icon name="info" size={16} />} label="Details" onClick={() => act(onDetails)} />}
        {onWhoMade && <ListItem role="menuitem" leading={<Icon name="microphone" size={16} />} label="Who made this?" onClick={() => act(onWhoMade)} />}

        {collections && onToggleCollection && (
          <>
            <Separator />
            <ContextMenuLabel>Collections</ContextMenuLabel>
            {collections.map((c) => (
              <ListItem
                key={c.id}
                role="menuitemcheckbox"
                aria-checked={c.checked}
                leading={<Control><Checkbox checked={c.checked} readOnly tabIndex={-1} /></Control>}
                label={c.name}
                onClick={() => onToggleCollection(c.id)}
              />
            ))}
            {onNewCollection &&
              (naming ? (
                // The name field replaces the row; Enter makes the collection
                // with this game in it, Esc puts the row back.
                <div className="gtm-new">
                  <Input
                    autoFocus
                    aria-label="New collection name"
                    placeholder="Collection name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter' && name.trim()) act(() => onNewCollection(name.trim()));
                      if (e.key === 'Escape') setNaming(false);
                    }}
                  />
                </div>
              ) : (
                <ListItem role="menuitem" leading={<Icon name="add" size={16} />} label="New collection…" onClick={() => setNaming(true)} />
              ))}
          </>
        )}

        <Separator />
        <ContextMenuLabel>Optimize</ContextMenuLabel>
        <ListItem
          role="menuitemcheckbox"
          aria-checked={optimize.booster}
          leading={<Control><Checkbox checked={optimize.booster} readOnly tabIndex={-1} /></Control>}
          label="Booster"
          onClick={() => onSetOptimize('booster', !optimize.booster)}
        />
        <ListItem
          role="menuitemcheckbox"
          aria-checked={optimize.omenAi}
          leading={<Control><Checkbox checked={optimize.omenAi} readOnly tabIndex={-1} /></Control>}
          label="OMEN AI"
          onClick={() => onSetOptimize('omenAi', !optimize.omenAi)}
        />

        <Separator />
        <ContextMenuLabel>Select Platform</ContextMenuLabel>
        <ListItem
          role="menuitemradio"
          aria-checked={platform === 'steam'}
          leading={<Control><Radio checked={platform === 'steam'} readOnly tabIndex={-1} name={`gtm-plat-${game.id}`} /></Control>}
          label={<span className="gtm-plat"><Icon name="platform-steam" size={16} /> Steam</span>}
          onClick={() => onSetPlatform('steam')}
        />
        <ListItem
          role="menuitemradio"
          aria-checked={platform === 'geforce'}
          leading={<Control><Radio checked={platform === 'geforce'} readOnly tabIndex={-1} name={`gtm-plat-${game.id}`} /></Control>}
          label={<span className="gtm-plat"><Icon name="platform-nvidia" size={16} /> GeForce NOW</span>}
          onClick={() => onSetPlatform('geforce')}
        />
      </ContextMenu>
    </div>
  );
}
