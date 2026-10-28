import type { ReactNode } from 'react';
import { ContextMenu, Icon, IconButton, Tooltip, type IconName } from '../components';
import { usePopover } from './usePopover';

export interface NovaPopoverProps {
  /** Accessible name of the trigger AND the dialog ("Tokenomics", "Settings"). */
  label: string;
  icon: IconName;
  /** Stable id so the trigger's aria-controls can point at the panel. */
  id: string;
  children: ReactNode;
  className?: string;
}

/**
 * An icon button in the Nova top bar that opens a floating panel beneath it.
 * The panel is the design system's ContextMenu surface re-roled as a dialog
 * (it is a frosted panel, not a menu of items); position and dismissal are
 * the caller's — here, `usePopover` — exactly as AccountMenu does it.
 *
 * Lives inside `.nova-topbar`, which must never carry a backdrop-filter: that
 * would make it a stacking context and trap the panel beneath the columns
 * that follow it in the DOM (gotcha 4/19).
 */
export function NovaPopover({ label, icon, id, children, className }: NovaPopoverProps) {
  const pop = usePopover();
  return (
    <div className="nova-pop-wrap" ref={pop.wrapRef} onKeyDown={pop.onKeyDown}>
      <Tooltip content={label} placement="bottom">
        <IconButton
          ref={pop.triggerRef}
          label={label}
          aria-haspopup="dialog"
          aria-expanded={pop.open}
          aria-controls={pop.open ? id : undefined}
          className={pop.open ? 'active' : undefined}
          onClick={pop.toggle}
        >
          <Icon name={icon} size={16} />
        </IconButton>
      </Tooltip>
      {pop.open && (
        <ContextMenu
          ref={pop.panelRef}
          id={id}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          className={['nova-pop', className].filter(Boolean).join(' ')}
        >
          {children}
        </ContextMenu>
      )}
    </div>
  );
}
