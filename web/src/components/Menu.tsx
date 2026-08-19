import React from 'react';
import { NavLink } from 'react-router-dom';

export type MenuOrientation = 'horizontal' | 'vertical';

export interface MenuItem {
  id: string;
  label: string;
  /** Optional leading icon node (e.g. an <svg>). */
  icon?: React.ReactNode;
  /** Route path → renders a <NavLink> with automatic active state. */
  to?: string;
  /** Exact-match for the index route. */
  end?: boolean;
  /** Active state for non-routed (button) items. */
  active?: boolean;
  onClick?: () => void;
}

export interface MenuProps {
  items: MenuItem[];
  /** `horizontal` = floating centered pill (top nav); `vertical` = side list. */
  orientation?: MenuOrientation;
  /** Hide the text label on each item → icon-only navigation. The label is kept
   *  as the item's accessible name (`aria-label`) + native tooltip (`title`). */
  hideLabels?: boolean;
  /** Hide the leading icon on each item → text-only navigation. */
  hideIcons?: boolean;
  /** Show a design-system tooltip (the item's label) below each item on
   *  hover/focus. Only rendered while labels are hidden (icon-only nav) — a
   *  tooltip repeating a visible label is redundant, so with labels showing
   *  this is a no-op. */
  tooltips?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * App navigation menu — one component, two orientations, over the design
 * system's `.ds-menu`. Items with a `to` render routed <NavLink>s (auto active);
 * otherwise they render <button>s driven by `active`.
 *
 * Avalonia: a single ItemsControl with an orientation-swapped panel — a
 * horizontal WrapPanel/StackPanel (pill ControlTheme) vs. a vertical StackPanel
 * (list ControlTheme); items are RadioButton-style nav toggles.
 */
export function Menu({
  items,
  orientation = 'horizontal',
  hideLabels = false,
  hideIcons = false,
  tooltips = false,
  className,
  'aria-label': ariaLabel,
}: MenuProps) {
  // Tooltips carry the item's label, so they only earn their place when the
  // label itself is hidden — otherwise they'd repeat what's already on screen.
  const showTips = tooltips && hideLabels;
  const classes = [
    'ds-menu',
    orientation,
    hideLabels ? 'hide-labels' : '',
    hideIcons ? 'hide-icons' : '',
    showTips ? 'has-tips' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <nav className={classes} aria-label={ariaLabel}>
      {items.map((item) => {
        const inner = (
          <>
            {item.icon && <span className="ds-menu-icon">{item.icon}</span>}
            <span className="ds-menu-label">{item.label}</span>
            {/* Bottom tooltip — the design system's Figma-aligned .ds-tooltip-popup.
                aria-hidden: the item's name already comes from the visible label (or
                aria-label when hidden), so it isn't double-read. */}
            {showTips && (
              <span className="ds-tooltip-popup bottom" aria-hidden="true">
                {item.label}
              </span>
            )}
          </>
        );
        // When the label is hidden it leaves the accessibility tree, so keep the
        // item's name via aria-label. Only fall back to a native `title` when the
        // DS tooltip isn't rendering one (avoids a double tooltip in icon-only nav).
        const nameProps = hideLabels
          ? { 'aria-label': item.label, ...(showTips ? {} : { title: item.label }) }
          : {};
        return item.to ? (
          <NavLink
            key={item.id}
            to={item.to}
            end={item.end}
            className={({ isActive }) => 'ds-menu-item' + (isActive ? ' active' : '')}
            {...nameProps}
          >
            {inner}
          </NavLink>
        ) : (
          <button
            key={item.id}
            type="button"
            className={'ds-menu-item' + (item.active ? ' active' : '')}
            aria-current={item.active ? 'page' : undefined}
            onClick={item.onClick}
            {...nameProps}
          >
            {inner}
          </button>
        );
      })}
    </nav>
  );
}
