import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon, IconButton, Textarea } from '../components';
import { useNova } from '../state/Nova';
import { ModelAgentSelects } from './ModelAgentSelects';

/** The field grows with the draft to four lines, then scrolls (Chris, 2026-10-20). */
const MAX_ROWS = 4;

/**
 * The message field, and — where there is no context rail to hold them —
 * the two selectors. The quick prompts moved out (2026-10-20): they show on an
 * empty conversation (ChatLog) and always in the rail's "Can help with".
 *
 * Enter sends, Shift+Enter breaks a line. Escape clears a draft and is
 * STOPPED here: three document-level Escape listeners are live under Nova
 * (Devices flyout, device modal, feature modal) and an Escape meant for the
 * draft must not close a panel behind it (gotcha 5). The field is refocused
 * after a send in an effect, after the commit, not inside the key handler
 * (gotcha 6). It grows with the draft up to four lines — by `rows`, measured,
 * never by drag.
 */
export function Composer({
  selects = true,
  onEmptyEscape,
}: {
  selects?: boolean;
  /**
   * Escape with nothing drafted. The composer keeps every Escape to itself
   * (gotcha 5: a leaked one closes whatever document-level surface is open —
   * Devices, a modal), so a host that wants Escape to mean "close me" says so
   * here. The Nova window does (TH-507); the rail and the page do not.
   */
  onEmptyEscape?: () => void;
} = {}) {
  const { send, busy } = useNova();
  const [draft, setDraft] = useState('');
  const [rows, setRows] = useState(1);
  const [sent, setSent] = useState(0);
  const field = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const t = draft.trim();
    if (!t || busy) return;
    send(t);
    setDraft('');
    setRows(1);
    setSent((n) => n + 1);
  };

  // Refocus after the commit that cleared the field.
  useEffect(() => {
    if (sent > 0) field.current?.focus();
  }, [sent]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      if (!draft) onEmptyEscape?.();
      else {
        e.preventDefault();
        setDraft('');
        setRows(1);
      }
    }
  };

  // Measure the draft's height in lines, with the attribute reset first so a
  // shrinking draft shrinks the field.
  const onChange = (v: string) => {
    setDraft(v);
    const el = field.current;
    if (!el) return;
    el.rows = 1;
    // The fallback mirrors `textarea.ds-input { line-height: 19px }` in
    // shared/components.css for the rare pre-mount read that returns nothing.
    const cs = getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || 19;
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    // Measured with the floor lifted: the field's min-height is one CONTROL
    // (32px), taller than one 19px line, so with it in place a single line
    // read as two. Without it, scrollHeight is the text itself.
    const floor = el.style.minHeight;
    el.style.minHeight = '0';
    const lines = Math.max(1, Math.round((el.scrollHeight - padY) / line));
    el.style.minHeight = floor;
    const next = Math.min(MAX_ROWS, lines);
    el.rows = next;
    setRows(next);
  };

  return (
    <div className="nova-compose">
      <div className="nova-composer">
        {/* On the full page the selectors live at the top of the context rail
            (2026-10-20); the pinned panel has no rail, so it keeps them here. */}
        {selects && <ModelAgentSelects openUp />}
        <div className="nova-composer-row">
          <Textarea
            ref={field}
            rows={rows}
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message Nova…"
            aria-label="Message Nova"
          />
          <IconButton label="Send" variant="accent" onClick={submit} disabled={busy || !draft.trim()}>
            <Icon name="send" size={16} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
