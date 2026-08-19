import { useEffect, useRef, useState } from 'react';
import { ListItem } from './ListItem';
import { ListBox } from './ListBox';
import { Icon } from './Icon';

export interface DropdownOption {
  label: string;
  value: string;
}

export interface DropdownProps {
  options: DropdownOption[];
  /** Controlled selected value. */
  value?: string;
  /** Uncontrolled initial value (defaults to the first option). */
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  'aria-label'?: string;
}

/**
 * Thin wrapper over the design system's `.ds-dropdown` (trigger + listbox menu).
 * Self-contained open/select state; closes on outside click.
 */
export function Dropdown({
  options,
  value,
  defaultValue,
  onChange,
  className,
  'aria-label': ariaLabel,
}: DropdownProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string | undefined>(defaultValue ?? options[0]?.value);
  const selected = isControlled ? value : internal;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = options.find((o) => o.value === selected) ?? options[0];

  function pick(v: string) {
    if (!isControlled) setInternal(v);
    onChange?.(v);
    setOpen(false);
  }

  return (
    <div className={['ds-dropdown', open ? 'open' : '', className].filter(Boolean).join(' ')} ref={ref}>
      <button
        type="button"
        className="ds-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ds-dropdown-label">{current?.label}</span>
        <span className="ds-dropdown-chevron" aria-hidden="true">
          <Icon name="chevron-down" style={{ width: 12, height: 12 }} />
        </span>
      </button>
      <ListBox className="ds-dropdown-pop" aria-label={ariaLabel} maxHeight={240}>
        {options.map((o) => (
          <ListItem key={o.value} label={o.label} selected={o.value === selected} onClick={() => pick(o.value)} />
        ))}
      </ListBox>
    </div>
  );
}
