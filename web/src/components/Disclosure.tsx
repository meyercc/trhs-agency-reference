import React, { useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface DisclosureProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** The header's title. */
  title: ReactNode;
  /** One dim line under the title. */
  description?: ReactNode;
  /** The header's leading tile (an icon on a tinted square). */
  icon?: ReactNode;
  /** Trailing content before the chevron — badges, a count. */
  meta?: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /** Uncontrolled initial state. Collapsed by default. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** `compact` for a narrow column — the game panel; `default` is the editor scale (Booster). */
  density?: 'default' | 'compact';
  children?: ReactNode;
}

/**
 * A collapsible section — thin wrapper over the design system's
 * `.ds-settings-group` (shared/components.css): a header that toggles a body,
 * the chevron turning when open. The header is a button to the keyboard
 * (Enter / Space) and says `aria-expanded`; the body is labelled by it.
 * Controlled (`open` + `onOpenChange`) or uncontrolled (`defaultOpen`).
 *
 * Avalonia: an Expander with the settings-group ControlTheme — the header a
 * ToggleButton, `IsExpanded` bound to `open`.
 */
export function Disclosure({ title, description, icon, meta, open, defaultOpen = false, onOpenChange, density = 'default', className, children, ...rest }: DisclosureProps) {
  const [own, setOwn] = useState(defaultOpen);
  const isOpen = open ?? own;
  const bodyId = useId();
  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setOwn(next);
    onOpenChange?.(next);
  };
  const classes = ['ds-settings-group', isOpen ? 'expanded' : '', density === 'compact' ? 'compact' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      <div
        className="ds-settings-group-header"
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
      >
        {icon != null && <div className="ds-settings-group-icon">{icon}</div>}
        <div className="ds-settings-group-titles">
          <div className="ds-settings-group-title">{title}</div>
          {description != null && <div className="ds-settings-group-desc">{description}</div>}
        </div>
        {meta != null && <div className="ds-settings-group-meta">{meta}</div>}
        <Icon name="chevron-right" className="ds-settings-group-chevron" aria-hidden />
      </div>
      <div className="ds-settings-group-items" id={bodyId} role="region">
        {children}
      </div>
    </div>
  );
}
