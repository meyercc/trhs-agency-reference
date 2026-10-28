import { forwardRef, useEffect, useRef, useState } from 'react';
import { Fab, Icon, Tooltip } from '../components';
import { useNova } from '../state/Nova';

/**
 * Nova's floating door (TH-507) — the alternative to the top bar's chat
 * button, chosen in Admin → Nova entry. A `.ds-fab` in the bottom-right
 * corner that opens Nova as a window over the page (NovaPanel `mode="window"`).
 *
 * It owns no open state: "Nova is open" is still `novaPinned`, so every door
 * that already opens Nova — Catch me up, Who made this?, the refund warning —
 * opens the window too, untouched.
 *
 * Its states are the reason it exists:
 *   · busy — Nova is working on a reply: the ring runs, whether or not the
 *     window is open, so a reply you walked away from is visibly coming;
 *   · unread — a reply finished while the window was closed: the shoulder
 *     dot, and the label says so ("Ask Nova — new reply"), cleared on open.
 *
 * The chat log (which announces) is unmounted while the window is closed, so
 * this carries its own polite status for the two moments that happen then.
 */
export const NovaFab = forwardRef<HTMLButtonElement, { open: boolean; onToggle: () => void }>(function NovaFab({ open, onToggle }, ref) {
  const { busy, active } = useNova();
  const [unread, setUnread] = useState(false);
  const [said, setSaid] = useState('');
  const wasBusy = useRef(busy);

  useEffect(() => {
    if (open) {
      setUnread(false);
      setSaid('');
    }
  }, [open]);
  useEffect(() => {
    const finished = wasBusy.current && !busy;
    wasBusy.current = busy;
    if (open) return;
    if (busy) setSaid('Nova is thinking');
    else if (finished) {
      const last = active?.messages[active.messages.length - 1];
      // An error is not news worth a badge; the window shows it when opened.
      if (last?.role === 'assistant' && last.status !== 'error') {
        setUnread(true);
        setSaid('Nova replied');
      } else setSaid('');
    }
  }, [busy, open, active]);

  const label = open ? 'Minimize Nova' : unread ? 'Ask Nova — new reply' : busy ? 'Ask Nova — thinking' : 'Ask Nova';
  return (
    <>
      <Tooltip content={label} placement="left" className="nova-fab">
        <Fab
          ref={ref}
          label={label}
          aria-controls="nova-panel"
          icon={<Icon name="twinkle" size={24} />}
          openIcon={<Icon name="chevron-down" size={20} />}
          open={open}
          busy={busy}
          badge={unread && !open}
          onClick={onToggle}
        />
      </Tooltip>
      <span className="ds-sr-only" role="status" aria-live="polite">
        {said}
      </span>
    </>
  );
});
