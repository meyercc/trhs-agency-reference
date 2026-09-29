import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ListItem } from './ListItem';
import { ListBox, ListGroup } from './ListBox';
import { Separator } from './Separator';
import { Icon, type IconName } from './Icon';

export interface DropdownOption {
  label: string;
  value: string;
  /** Leading glyph — on the row, and on the trigger while this option is selected. */
  icon?: IconName;
  /** Trailing slot on the row (a status word, a count). Never the only carrier of state. */
  trailing?: ReactNode;
  disabled?: boolean;
}

/** A run of options under a muted heading. */
export interface DropdownGroup {
  label: string;
  options: DropdownOption[];
}

/** One action row under a rule at the foot of the menu — "Add new preset". */
export interface DropdownFooter {
  label: string;
  icon?: IconName;
  onSelect: () => void;
}

export interface DropdownProps {
  options?: DropdownOption[];
  /** Grouped options; each group renders under a `ListGroup` heading. Wins over `options`. */
  groups?: DropdownGroup[];
  /** Controlled selected value. */
  value?: string;
  /** Uncontrolled initial value (defaults to the first option). */
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  /** Open the menu above the trigger — for a trigger that sits near the bottom of its surface. */
  openUp?: boolean;
  /**
   * An action at the foot of the menu, under a separator: a row that does
   * something (opens an editor) rather than picks a value. It joins the
   * keyboard order but never becomes the selected option.
   */
  footer?: DropdownFooter;
  /** Cap on the menu's height before it scrolls. Defaults to the component's `--ds-dropdown-max-h`. */
  maxHeight?: number | string;
  className?: string;
  'aria-label'?: string;
}

const ROW_SELECTOR = '.ds-dropdown-pop .ds-list-item:not(.disabled)';

/**
 * Thin wrapper over the design system's `.ds-dropdown` (trigger + listbox menu).
 * Self-contained open/select state; closes on outside click.
 *
 * Keyboard: the trigger opens on ArrowDown/ArrowUp (and Enter/Space, as a
 * button); inside the list ArrowUp/Down move, Home/End jump, Enter/Space
 * pick, Escape and Tab close. Escape is consumed here — a dropdown open inside
 * a modal must not dismiss the modal on the same press. Only the selected row
 * is a tab stop (roving tabindex), so Tab leaves the menu rather than walking
 * every option.
 *
 * Avalonia: a ComboBox ControlTheme — the toggle-button trigger over a Popup
 * holding a ListBox; grouped options via GroupStyle headers.
 */
export function Dropdown({
  options,
  groups,
  value,
  defaultValue,
  onChange,
  disabled,
  openUp,
  footer,
  maxHeight = 'var(--ds-dropdown-max-h)',
  className,
  'aria-label': ariaLabel,
}: DropdownProps) {
  const flat = groups ? groups.flatMap((g) => g.options) : options ?? [];
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string | undefined>(defaultValue ?? flat[0]?.value);
  const selected = isControlled ? value : internal;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const rows = useCallback(
    () => Array.from(ref.current?.querySelectorAll<HTMLElement>(ROW_SELECTOR) ?? []),
    [],
  );

  // Open lands focus on the row you are already on, so the list starts where
  // the eye is; a click anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const list = rows();
    (list.find((r) => r.getAttribute('aria-selected') === 'true') ?? list[0])?.focus();
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    // Escape closes the menu wherever focus happens to be (a walker or a
    // pointer user who clicked off the rows) and is consumed here, so an
    // enclosing modal does not close on the same press. Captured, so it runs
    // before a document-level Escape handler on the host.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, rows]);

  const current = flat.find((o) => o.value === selected) ?? flat[0];

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  function pick(v: string) {
    if (!isControlled) setInternal(v);
    onChange?.(v);
    close(true);
  }

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close(false);
    }
  };

  const onRowKeyDown = (e: React.KeyboardEvent, act: () => void) => {
    const list = rows();
    const i = list.indexOf(e.currentTarget as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      list[(i + d + list.length) % list.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      act();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  const renderRow = (o: DropdownOption) => (
    <ListItem
      key={o.value}
      label={o.label}
      leading={o.icon ? <Icon name={o.icon} size="md" aria-hidden /> : undefined}
      trailing={o.trailing}
      selected={o.value === selected}
      disabled={o.disabled}
      tabIndex={o.value === selected && !o.disabled ? 0 : -1}
      onClick={() => pick(o.value)}
      onKeyDown={(e) => onRowKeyDown(e, () => pick(o.value))}
    />
  );

  const runFooter = () => {
    close(true);
    footer?.onSelect();
  };

  const classes = [
    'ds-dropdown',
    open ? 'open' : '',
    openUp ? 'open-up' : '',
    disabled ? 'disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        className="ds-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        {current?.icon && (
          <span className="ds-dropdown-leading" aria-hidden="true">
            <Icon name={current.icon} size="md" />
          </span>
        )}
        <span className="ds-dropdown-label">{current?.label}</span>
        <span className="ds-dropdown-chevron" aria-hidden="true">
          <Icon name="chevron-down" size={12} />
        </span>
      </button>
      <ListBox className="ds-dropdown-pop" aria-label={ariaLabel} maxHeight={maxHeight}>
        {groups
          ? groups.map((g) => (
              <ListGroup key={g.label} label={g.label}>
                {g.options.map(renderRow)}
              </ListGroup>
            ))
          : flat.map(renderRow)}
        {footer && (
          <>
            <Separator />
            <ListItem
              className="ds-dropdown-footer"
              label={footer.label}
              leading={footer.icon ? <Icon name={footer.icon} size="sm" aria-hidden /> : undefined}
              tabIndex={-1}
              onClick={runFooter}
              onKeyDown={(e) => onRowKeyDown(e, runFooter)}
            />
          </>
        )}
      </ListBox>
    </div>
  );
}
