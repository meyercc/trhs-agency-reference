import React, { createContext, useContext, useCallback, type ReactNode } from 'react';
import { StatusOverlay } from './StatusOverlay';

/**
 * Marks a group of controls as **software-only** — features the device cannot
 * execute on its own, so they can't be saved into an onboard profile.
 *
 * When locked, the region does NOT disappear. The controls stay visible, go
 * inert and dim, and a `StatusOverlay` centred over them says why. That's
 * deliberate: the user's real problem is not knowing which of their settings
 * travel with the device, and a control that vanishes teaches nothing while a
 * control that is visibly unavailable teaches exactly the boundary.
 *
 * Locked is the only state that dims. A feature merely switched OFF by its
 * toggle never looks like this — its region keeps full color and stays fully
 * operable (curating presets or editing config works while off; it applies
 * when the feature returns). Off is the toggle's state plus live device
 * feedback, never a disabled look.
 *
 * Lock state comes from the nearest `SoftwareOnlyProvider` (so a device panel
 * sets it once for the whole tab body), or from an explicit `locked` prop,
 * which wins — that's what Storybook and tests drive.
 *
 * Avalonia: a ContentControl with a "Locked" visual state — content dimmed and
 * IsHitTestVisible=False, plus a badge in the adorner layer.
 */

const LockContext = createContext(false);

/** Locks every `SoftwareOnly` beneath it. Default (no provider) is unlocked. */
export function SoftwareOnlyProvider({ locked, children }: { locked: boolean; children: ReactNode }) {
  return <LockContext.Provider value={locked}>{children}</LockContext.Provider>;
}

export interface SoftwareOnlyProps {
  children: ReactNode;
  /** Override the provider's lock state (Storybook, tests). */
  locked?: boolean;
  /**
   * Why it's unavailable. Shown after the "Software only" badge — keep it
   * concrete ("needs Treehouse running to render the layers"), not generic.
   */
  reason?: string;
  className?: string;
}

export function SoftwareOnly({ children, locked, reason, className }: SoftwareOnlyProps) {
  const inherited = useContext(LockContext);
  const isLocked = locked ?? inherited;

  // `inert` removes the subtree from the tab order and the a11y tree. React 18
  // doesn't type it as a prop, so set it on the node directly.
  const bodyRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      if (isLocked) node.setAttribute('inert', '');
      else node.removeAttribute('inert');
    },
    [isLocked],
  );

  const classes = ['ds-sw-only', isLocked ? 'locked' : '', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="ds-sw-only-body" ref={bodyRef}>
        {children}
      </div>
      {isLocked && (
        <StatusOverlay icon="lock-on">
          Software Only{reason ? ` — ${reason}` : ''}
        </StatusOverlay>
      )}
    </div>
  );
}
