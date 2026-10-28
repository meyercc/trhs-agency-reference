import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ContextMenu, ListItem, type MenuItem } from '../components';

/**
 * The nav items that did not fit the bottom bar (AppShell, compact windows,
 * 2026-10-20): a menu above the bar, opened by its "More" tab. The same
 * `MenuItem`s the bar would have drawn — a routed one navigates, a button one
 * runs its own click (Devices opens its panel) — so an item behaves the same
 * wherever the width happens to put it.
 *
 * Built on the DS ContextMenu + ListItem rather than a sheet of its own:
 * the AccountMenu is the same shape, hanging off the top bar.
 *
 * Avalonia: a MenuFlyout on the overflow button of the bottom NavigationBar.
 */
export function NavOverflow({ items, open, onClose }: { items: MenuItem[]; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  // Escape closes; so does a press anywhere outside the bar (the More tab is
  // in the bar, and its own click toggles — closing here too would reopen).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: PointerEvent) => {
      const bar = ref.current?.closest('.shell-bottom-nav');
      if (bar && !bar.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, onClose]);

  // Focus lands on the first row, so a keyboard reaches the hidden tabs the
  // way it reaches the visible ones.
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  if (!open) return null;
  const active = (i: MenuItem) => (i.to ? (i.end ? pathname === i.to : pathname.startsWith(i.to)) : !!i.active);
  const pick = (i: MenuItem) => {
    if (i.to) navigate(i.to);
    else i.onClick?.();
    onClose();
  };
  return (
    <ContextMenu ref={ref} className="shell-nav-more" aria-label="More">
      {items.map((i) => (
        <ListItem
          key={i.id}
          role="menuitem"
          aria-current={active(i) ? 'page' : undefined}
          selected={active(i)}
          leading={i.icon}
          label={i.label}
          onClick={() => pick(i)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              pick(i);
            }
          }}
        />
      ))}
    </ContextMenu>
  );
}
