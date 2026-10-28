import React, { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, IconButton, Tooltip, ContextMenu, ListItem, Separator, type IconName, type TooltipPlacement, type WidgetShellAction } from '../components';
import { useCellActions } from './cellActions';
import { useSettings } from '../state/Settings';
import { useTipSide, roomiestSide } from './tipSide';
import './card-menu.css';

/** One row of a card's ⋮ menu. */
export interface CardMenuItem {
  /** Stable id — also the row's `data-action`, and the panel's `data-view`. */
  id: string;
  icon: IconName;
  label: string;
  /** Run the action. The menu closes first. */
  onSelect?: () => void;
  /** Or swap the menu for this panel, in the same place (the monitor card's
      Customize chooser). The panel closes the way the menu does. */
  panel?: ReactNode;
}

export interface CardMenuProps {
  /** The card's own name: the ⋮ is announced «More options for <name>», so a
      board of ⋮s is not eight identical buttons to a screen reader. */
  name: string;
  /** The card's own rows — what the card holds (its link, Customize). The
      board's rows follow them after a separator, added by the menu itself
      whenever the card sits in a board cell: «Move to the top» (narrow
      screens), then `Remove from Home`, always last. */
  items?: CardMenuItem[];
  /** A hint held open beside the ⋮. On the board the menu decides this itself:
      the first-visit hint goes on the first card at the top of Home only (see
      `TEACH`). Pass one only outside the board (stories). */
  hint?: string;
  /** Every press of the ⋮. */
  onPress?: () => void;
  /** `ghost` (default) on a card's own surface. `default` — the library's
      surfaced icon button — where the corner is artwork (Last Played), on
      which a bare ⋮ disappears. */
  variant?: 'ghost' | 'default';
  /** Open on first render — for stories and docs, which have no pointer. */
  defaultOpen?: boolean;
  /** A title in the same box to line the dots up with (the board passes the
      header title): the ⋮ moves to the middle of its LETTERS, wherever a badge
      or a taller header puts them. Without one it keeps its corner spot. */
  alignTo?: string;
  className?: string;
}

/** `.card-menu-pop` width — the menus open under the ⋮ with their right edges
    aligned, unless that runs them off the window's left edge (the wide Home's
    left side slot, 2026-10-06); then they slide right to keep an 8px margin. */
const POP_W = 236;
const popAt = (r: DOMRect) => ({
  top: r.bottom + 6,
  right: Math.min(window.innerWidth - r.right, window.innerWidth - 8 - POP_W),
});

/**
 * The ⋮ «More options» menu every widget card on Home carries in its top-right
 * corner — one place for everything the card itself can do.
 *
 * Built on the monitor card first (Cindy 2026-10-01, from Chris 1:1 09-29: the
 * `Customize` text link and the board's `×` sat on top of each other, and a
 * press on the card already means «open the window»), then lifted to a
 * component for every card (Treehouse IC meeting 2026-10-06, Chris: «build
 * this as a component level feature … all of the widget cards»). The board
 * draws it on every cell (`WidgetBoard`, `.wb-card-menu`); a card with actions
 * of its own draws its own copy with those rows and the board's steps aside
 * (`card-menu.css`).
 *
 * Library parts only: `IconButton` ghost + the `more` icon, the library
 * `Tooltip` (to the LEFT — the ⋮ is in a corner of a card that clips, so a tip
 * centred below lost «More options» past the card's edge, Cindy 10-02), and
 * `ContextMenu` with `ListItem` rows. `Remove from Home` uses `minus`, the game
 * tile's «Remove from Library» — not `trash`, which in this app is Delete: the
 * device stays connected and the board's + brings the card back. Not red
 * either — the app reds one row, Sign Out (Cindy 10-01). No Size row: the
 * corner drag is the board's, on every card (Cindy 10-02).
 *
 * Portalled to <body>, and only while open — a board cell is a framer-motion
 * element whose transform makes a containing block, so a nested menu would be
 * trapped inside the card. A portal moves the DOM, not the React tree, so
 * presses stop at the menu's edge or they would reach the card's own
 * `onClick` (open the window) and the cell's drag.
 */
/** The first-visit hint (Todd 09-24 «did you know you could customize this
    card», Cindy 09-28 · 10-01) — on ONE card: the first one at the top of Home,
    whatever kind it is (Cindy 2026-10-09 «홈 페이지 윗쪽에 눈에 잘띄는곳에만»;
    it sat on the monitor card, which can be far down the board). Every card's
    ⋮ is the same now, so the hint teaches the ⋮, not one card's Customize. Held
    until any card's ⋮ has been pressed once; Admin's First-time setup brings
    it back. */
const TEACH = 'Card options are here';

export function CardMenu({ name, items = [], hint, onPress, variant = 'ghost', defaultOpen = false, alignTo, className }: CardMenuProps) {
  const cell = useCellActions();
  const { cardMenuHintSeen, setCardMenuHintSeen } = useSettings();
  // Two groups with a separator between (Treehouse office hour 2026-10-09,
  // Chris: «use some separators … the dashboard controls versus the content
  // options»): what the card holds, then what the board does with the card.
  // The move is a menu row on every width (TH-463, Chris 2026-10-13), and
  // dragging still works too. («Move beside the carousel» / «Move back to the
  // board» were rows here while the carousel had slots, TH-440; the slots went
  // with the board's growth by whole columns, 2026-10-21.)
  const boardRows: CardMenuItem[] = cell
    ? [
        ...(cell.toTop ? [{ id: 'to-top', icon: 'chevron-up' as IconName, label: 'Move to the top', onSelect: cell.toTop }] : []),
        { id: 'remove', icon: 'minus', label: 'Remove from Home', onSelect: cell.remove },
      ]
    : [];
  const rows: CardMenuItem[] = [...items, ...boardRows];
  // `null` = closed · `'menu'` = the rows · a row id = that row's panel.
  const [view, setView] = useState<string | null>(defaultOpen ? 'menu' : null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const b = defaultOpen && wrapRef.current?.querySelector('button');
    if (b) setAnchor(popAt(b.getBoundingClientRect()));
  }, [defaultOpen]);
  // Dots on the title's letters (Cindy 2026-10-08, Light Studio · CPU · Booster):
  // the middle of an uppercase title is baseline − cap height / 2, which is above
  // the middle of its line box, and a badge beside it moves the whole line. Read
  // from the font's own metrics, again whenever the box changes size or a font
  // arrives.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const host = wrap?.parentElement;
    if (!wrap || !host || !alignTo) return;
    const place = () => {
      const t = host.querySelector<HTMLElement>(alignTo);
      const text = t?.firstChild;
      if (!t || !text) return wrap.style.removeProperty('top');
      const cs = getComputedStyle(t);
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return;
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText((t.textContent ?? '').toUpperCase());
      const r = document.createRange();
      r.selectNodeContents(t);
      const line = r.getClientRects()[0];
      if (!line) return;
      const baseline = line.top + (line.height - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
      const mid = baseline - m.actualBoundingBoxAscent / 2;
      const b = wrap.getBoundingClientRect();
      const hostTop = host.getBoundingClientRect().top;
      wrap.style.top = `${Math.round((mid - b.height / 2 - hostTop) * 2) / 2}px`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(host);
    document.fonts?.ready.then(place);
    return () => ro.disconnect();
  }, [alignTo]);
  const popRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  // Both tips open `left` first, but the board puts cards against the window
  // edges too, so the side is picked rather than fixed (`tipSide.ts`):
  // «More options» when the pointer arrives, the hint below.
  const [moreSide, pickMoreSide] = useTipSide('left');
  const [hintSide, setHintSide] = useState<TooltipPlacement>('left');
  // The first-visit hint: on the first card at the top of Home only — the first
  // ⋮ on the page in reading order that is shown (a card's own ⋮ hides the
  // board's copy). Read from the drawn board, every render.
  const [firstOnHome, setFirstOnHome] = useState(false);
  useLayoutEffect(() => {
    if (!cell) return;
    const first = [...document.querySelectorAll('.wb-cell .card-menu')].find((m) => getComputedStyle(m).display !== 'none');
    setFirstOnHome(first === wrapRef.current);
  });
  const shownHint = hint ?? (cell && firstOnHome && !cardMenuHintSeen ? TEACH : undefined);
  const hintOn = !!shownHint && view === null;
  // The hint is held open with no pointer near it, so its side is picked as it
  // lands — and again once the board's cards have flown into place (they spring
  // in on load: picked mid-flight, the top card's hint chose «top» and sat on
  // the carousel's edge, 10-09) and on every resize.
  useEffect(() => {
    if (!hintOn) return;
    const pick = () => {
      const trig = wrapRef.current?.querySelector('button');
      const pop = wrapRef.current?.querySelector<HTMLElement>('.ds-tooltip-popup');
      if (trig && pop) setHintSide(roomiestSide(trig, pop, 'left'));
    };
    pick();
    const later = [setTimeout(pick, 400), setTimeout(pick, 1200)];
    window.addEventListener('resize', pick);
    return () => {
      later.forEach(clearTimeout);
      window.removeEventListener('resize', pick);
    };
  }, [hintOn]);

  const close = (refocus = false) => {
    setView(null);
    if (refocus) wrapRef.current?.querySelector('button')?.focus();
  };

  // Closes like a menu: a press outside or Escape. A scroll does NOT close it —
  // turning a Customize row off shortens the page, and near the bottom the
  // browser pulls the scroll up by itself, which closed the menu under the hand
  // using it (walk-all 2026-09-24). It follows the ⋮ instead, and closes only
  // when the ⋮ has left the screen.
  useEffect(() => {
    if (view === null) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !wrapRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onScroll = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) return close();
      setAnchor(popAt(r));
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [view]);

  if (!rows.length) return null;

  const stopHere = (e: React.SyntheticEvent) => e.stopPropagation();
  // Keys pressed inside the menu stop there (a card behind must not react), so
  // Escape is handled here too — the document listener never sees it once
  // focus is in the menu. Focus goes back to the ⋮, as menus do.
  const keyInMenu = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') close(true);
  };
  const choose = (row: CardMenuItem) => {
    if (row.panel) return setView(row.id);
    close();
    row.onSelect?.();
  };

  const button = (
    <IconButton
      variant={variant}
      label={`More options for ${name}`}
      aria-haspopup="menu"
      aria-expanded={view !== null}
      // While the hint shows, a screen reader hears it with the button's name —
      // the held-open tooltip is not linked to anything, so it was seen and
      // never heard.
      aria-describedby={hintOn ? hintId : undefined}
      onPointerEnter={pickMoreSide}
      onFocus={pickMoreSide}
      onPointerDown={stopHere}
      onClick={(e) => {
        e.stopPropagation();
        setAnchor(popAt(e.currentTarget.getBoundingClientRect()));
        if (cell && !cardMenuHintSeen) setCardMenuHintSeen(true);
        onPress?.();
        setView((v) => (v === null ? 'menu' : null));
      }}
    >
      <Icon name="more" size={16} aria-hidden />
    </IconButton>
  );

  const panelRow = view && view !== 'menu' ? rows.find((r) => r.id === view) : undefined;

  return (
    <span ref={wrapRef} className={['card-menu', className].filter(Boolean).join(' ')}>
      {/* One Tooltip around the ⋮ in every state, so the button is never
          unmounted: it used to be wrapped only while the menu was shut, and
          opening it from the keyboard dropped focus to the page (10-08). Shut =
          the library's icon-button tooltip, its copy the start of the button's
          name (`IconButton` stories `WithTooltip`) · first visit = the held-open
          hint · open = no words (the menu is the answer). */}
      <Tooltip
        placement={hintOn ? hintSide : moreSide}
        className={hintOn ? 'card-menu-hint' : view !== null ? 'card-menu-quiet' : undefined}
        open={hintOn}
        content={hintOn ? shownHint : 'More options'}
      >
        {button}
      </Tooltip>
      {hintOn && (
        <span id={hintId} hidden>
          {shownHint}
        </span>
      )}
      {view !== null &&
        anchor &&
        createPortal(
          <div
            ref={popRef}
            className="card-menu-pop"
            data-view={view}
            style={{ top: anchor.top, right: anchor.right }}
            onClick={stopHere}
            onPointerDown={stopHere}
            onKeyDown={keyInMenu}
          >
            {panelRow ? (
              panelRow.panel
            ) : (
              <ContextMenu aria-label={`More options for ${name}`}>
                {rows.map((row, i) => (
                  <React.Fragment key={row.id}>
                  {i === items.length && i > 0 && <Separator />}
                  <ListItem
                    role="menuitem"
                    data-action={row.id}
                    leading={<Icon name={row.icon} size={16} aria-hidden />}
                    label={row.label}
                    onClick={() => choose(row)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        choose(row);
                      }
                    }}
                  />
                  </React.Fragment>
                ))}
              </ContextMenu>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}

/** Cards whose top-right corner is artwork, not the card's own surface: their ⋮
    takes the library's surfaced icon button, since a bare one vanishes on art. */
const ART_CORNER = new Set(['lastplayed']);

/** The ⋮ the board draws on a cell, by widget id — `WidgetBoard` and the widget
    gallery story both draw it this way. Needs the cell's `CellActionsContext`.
    `open` = the card's header link, handed over by `WidgetShell` through
    `WidgetShellActionSlot` (Cindy 2026-10-08 «코너에 텍스트 있는 것도 More
    Option 안에»): it becomes the menu's first row, in its own words — and the
    header draws no link, so the corner holds the ⋮ alone. The newest cards
    already looked like that (Chris's Nova-composed cards have no header link),
    and half the links went to a page the top menu opens anyway. */
/** Header links that leave Home for another page, by card. Every other header
    link opens a window over Home. Read from the cards' own links
    (`navigate(...)`) — a card that changes where its link goes must change here
    too (asked of Chris: a destination on the action itself). */
const LEAVES_HOME = new Set(['cpu', 'fanspeed', 'thermal', 'storage', 'quicklaunch', 'playnext', 'deals', 'gamepass']);

/**
 * A menu row's icon says what pressing it does to the screen — two icons, one
 * meaning each, the same in every card's ⋮ (Cindy 2026-10-09 «팝업 아이콘이랑 해당
 * 메뉴 아이콘으로 가는거 두가지로 구분해서 패턴 구조»; the CPU card's
 * `Undervolt` read as «a window opens here» and landed on Performance):
 *   · `browser` (a window) — a window opens over this page; you stay on Home
 *   · `shortcut` (↪)       — you leave Home for another page (the app's other ↪s,
 *                            Registry's Figma / SWPD links, also go somewhere else)
 * The other rows keep their own verbs: Customize ✎, the moves ‹ › ⌃ ⌄, Remove −.
 */
export const ROW_ICON = { window: 'browser', page: 'shortcut' } as const satisfies Record<string, IconName>;

export function BoardCardMenu({ id, name, open }: { id: string; name: string; open?: WidgetShellAction | null }) {
  const items: CardMenuItem[] = open
    ? [{ id: 'open', icon: LEAVES_HOME.has(id) ? ROW_ICON.page : ROW_ICON.window, label: open.label.replace(/\s*→\s*$/, ''), onSelect: open.run }]
    : [];
  return <CardMenu name={name} items={items} className="wb-card-menu" variant={ART_CORNER.has(id) ? 'default' : 'ghost'} alignTo=".w-label-text" />;
}
