import { useEffect, useId, useRef, useState } from 'react';

// ── InfoDisclosure (PerformV7) ──
// A third kind of element, alongside doors and actions. A DOOR takes you
// somewhere; an ACTION does something here; a DISCLOSURE opens in place and
// changes nothing. It exists because education content — what a feature is, what
// it is good at, what it costs you — has a different lifetime from the controls
// around it: it matters the first time and is noise afterwards, so it should be
// available without occupying the surface permanently.
//
// Why not a tooltip: a tooltip is hover-summoned and small, and our own record
// says a tooltip someone has to go and find does not fix a comprehension
// failure. This is click-activated, so it has a visible affordance, and it is
// panel-sized, so it can hold real content.
//
// Behaviour, fixed here because this is the first one in the codebase:
//   · click the trigger to open, click anywhere outside to dismiss
//   · Escape closes and returns focus to the trigger
//   · NO scrim — a scrim would make it read as a Dialogue and imply a commit
//   · the trigger carries aria-expanded and aria-controls
//   · the panel is labelled by the trigger and takes focus on open

export interface InfoDisclosureProps {
  /** Trigger text. Short — it sits next to a title. */
  label: string;
  /** Panel heading, defaults to the trigger label. */
  title?: string;
  /**
   * Identity mark for the panel head. This is where a feature's hero glyph
   * belongs: it is identity, which is education, so it lives with the rest of
   * the "what this is" content rather than occupying the surface permanently.
   */
  icon?: React.ReactNode;
  /**
   * Where the panel opens from.
   *
   * `footer-left` is the standing home for help: a modal's header right-hand end
   * is reserved for controls that change what the modal does, and a modal can
   * need both a control and an explanation at once. Splitting them by frequency
   * settles it permanently — the control is touched often and keeps the prime
   * slot, the explanation is read once and can sit at the bottom-left, which is
   * also where dialogs have long put help.
   *
   * `header-right` remains for surfaces with no control competing for the slot.
   */
  placement?: 'footer-left' | 'header-right';
  children: React.ReactNode;
  className?: string;
}

export function InfoDisclosure({ label, title, icon, placement = 'footer-left', children, className }: InfoDisclosureProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    // Light dismiss: any pointer down outside the wrapper closes it. Pointerdown
    // rather than click so a press that starts outside dismisses immediately.
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // do not let Escape also close the modal behind it
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <span className={['pv7-disc', `pv7-disc-${placement}`, className].filter(Boolean).join(' ')} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={'pv7-disc-trigger' + (open ? ' active' : '')}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <div className="pv7-disc-panel" id={panelId} ref={panelRef} role="group" aria-label={title ?? label} tabIndex={-1}>
          <div className="pv7-disc-head-row">
            {icon && <span className="pv7-disc-icon" aria-hidden="true">{icon}</span>}
            <span className="pv7-disc-title">{title ?? label}</span>
          </div>
          {children}
        </div>
      )}
    </span>
  );
}
