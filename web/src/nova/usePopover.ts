import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

/**
 * Open/close state and the dismissal contract for a popover anchored to an
 * icon button — the same recipe AccountMenu and ProfileSwitcher hand-roll,
 * lifted once so Nova's two popovers don't make it a third and fourth copy.
 *
 * - Outside mousedown closes.
 * - Escape closes, and is STOPPED at the wrapper so it never reaches the
 *   document-level listeners that AppShell (Devices flyout), DeviceModalHost
 *   and FeatureModalHost keep live — closing a popover must not also close
 *   the panel behind it (gotcha 5). React's synthetic stopPropagation halts
 *   the native event at the root container, above which those listeners sit.
 * - Focus moves into the panel on open and back to the trigger on close, in
 *   effects after the commit rather than inside the handler (gotcha 6).
 *
 * The caller owns the markup: a `position: relative` wrapper carrying `ref`
 * and `onKeyDown`, a trigger carrying `triggerRef`, and the panel carrying
 * `panelRef` when `open`.
 */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  // Outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Focus in on open; return focus to the trigger on close (post-commit).
  useEffect(() => {
    if (open) {
      const panel = panelRef.current;
      const first = panel?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (first ?? panel)?.focus();
    } else if (wasOpen.current) {
      triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  // Escape, caught at the wrapper so it covers the trigger and the panel.
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Escape' || !open) return;
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
    },
    [open],
  );

  return { open, toggle, close, wrapRef, triggerRef, panelRef, onKeyDown } as const;
}

/** A wrapper ref the way the hook hands it out — for callers typing props. */
export type PopoverWrapRef = RefObject<HTMLDivElement>;

/**
 * A rail that becomes an off-canvas drawer at narrow widths. Same contract as
 * a popover — Escape closes and stops at the panel, focus moves in on open and
 * back to the toggle on close — but the toggle lives in the top bar and the
 * panel in the chat grid, so the caller hands over both refs. Outside clicks
 * are the page's to decide (it owns the scrim).
 */
export function useDrawer() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    if (open) panelRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'Escape' || !open) return;
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
    },
    [open],
  );

  return { open, toggle, close, triggerRef, panelRef, onKeyDown } as const;
}
