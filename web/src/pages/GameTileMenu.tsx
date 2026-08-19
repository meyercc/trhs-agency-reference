import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ContextMenu, ContextMenuLabel, ListItem, Separator, Checkbox, Radio, Icon } from '../components';
import type { Game } from '../data/games';

export type GamePlatform = 'steam' | 'geforce';
export interface OptimizeState {
  booster: boolean;
  omenAi: boolean;
}

export interface GameTileMenuProps {
  game: Game;
  /** Bounding rect of the ••• button the menu anchors to. */
  anchor: DOMRect;
  favorite: boolean;
  optimize: OptimizeState;
  platform: GamePlatform;
  onClose: () => void;
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
        <ListItem role="menuitem" leading={<Icon name="play-fill" size={16} />} label="Play" onClick={() => act()} />
        <ListItem
          role="menuitem"
          leading={<Icon name={favorite ? 'star-fill' : 'star'} size={16} />}
          label={favorite ? 'Remove from Favorites' : 'Add to Favorites'}
          onClick={() => act(onToggleFavorite)}
        />
        <ListItem role="menuitem" leading={<Icon name="minus" size={16} />} label="Remove from Library" onClick={() => act(onRemove)} />
        <ListItem role="menuitem" label="More Info" onClick={() => act()} />

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
