import { useId, type ReactNode } from 'react';
import './zone-lights.css';
import { ContextMenu, Icon } from '../components';
import { usePopover } from '../nova/usePopover';

/**
 * The gear at the top right of a lighting panel, and the popover it opens
 * (JY, 2026-10-22: the notebook's hotkeys, sleep and charging settings and the
 * reset squeezed the zone list, so they sit behind a gear in the panel header).
 *
 * The trigger wears the panel's own header action (`ds-ng3-action`). The
 * surface is the design system's ContextMenu re-roled as a dialog, with open
 * state and dismissal from `usePopover`, as Nova's popovers have them: an
 * outside click closes it, and so does Escape, which stops at the wrapper so
 * it never also closes the window behind (gotcha 5).
 *
 * The children are the settings themselves, held by the caller; this only
 * decides where they live.
 */
export function LightingGear({ children }: { children: ReactNode }) {
  const pop = usePopover();
  const id = useId();
  return (
    <div className="lg-wrap" ref={pop.wrapRef} onKeyDown={pop.onKeyDown}>
      <button
        ref={pop.triggerRef}
        type="button"
        className={'ds-ng3-action' + (pop.open ? ' active' : '')}
        aria-label="Lighting settings"
        title="Lighting settings"
        aria-haspopup="dialog"
        aria-expanded={pop.open}
        aria-controls={pop.open ? id : undefined}
        onClick={pop.toggle}
      >
        <Icon name="settings" />
      </button>
      {pop.open && (
        <ContextMenu ref={pop.panelRef} id={id} role="dialog" aria-label="Lighting settings" tabIndex={-1} className="lg-pop">
          <div className="lg-settings">{children}</div>
        </ContextMenu>
      )}
    </div>
  );
}
