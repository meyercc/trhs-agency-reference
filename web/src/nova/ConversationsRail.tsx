import { forwardRef, type KeyboardEvent } from 'react';
import { Button, Icon } from '../components';
import { useNova, type NovaConversation } from '../state/Nova';
import { dayGroup, relTime } from './format';

const GROUPS = ['Today', 'Yesterday', 'Earlier'] as const;

/** The last line Nova or the person said, for the row's preview. */
function previewOf(c: NovaConversation): string {
  const last = c.messages[c.messages.length - 1];
  return last?.text.split('\n')[0] ?? '';
}

/**
 * The grouped rows on their own — the rail's body, and the whole content of
 * the pinned panel's Conversations popover (TH-434). Extracted so a
 * conversation row is authored once: the panel picker and the page rail
 * cannot drift into two different ideas of what a conversation looks like.
 *
 * `onPick` lets a host that floats (the popover) close itself after a choice;
 * the rail, which is always there, passes nothing.
 */
export function ConversationList({ onPick }: { onPick?: () => void }) {
  const { conversations, active, select } = useNova();
  const now = Date.now();
  const grouped = GROUPS.map((g) => ({ g, rows: conversations.filter((c) => dayGroup(c.updatedAt, now) === g) })).filter((x) => x.rows.length);

  return (
    <>
      {grouped.map(({ g, rows }) => (
        <section key={g} aria-label={g}>
          <h3 className="nova-rail-group">{g}</h3>
          <ul className="nova-convo-list" role="list">
            {rows.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="nova-convo"
                  aria-current={active?.id === c.id ? 'true' : undefined}
                  onClick={() => {
                    select(c.id);
                    onPick?.();
                  }}
                >
                  <span className="nova-convo-title">{c.title}</span>
                  <span className="nova-convo-meta">
                    <span>{relTime(c.updatedAt, now)}</span>
                    <span className="nova-convo-preview">{previewOf(c)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/**
 * Past conversations, newest first, grouped by day. A row is a button; the
 * open one carries `aria-current`. "New chat" clears the selection — the next
 * message starts a conversation titled after itself.
 */
export interface RailDrawerProps {
  /** Open as a drawer (only meaningful at widths where the rail is one — nova.css). */
  open?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  id?: string;
}

export const ConversationsRail = forwardRef<HTMLElement, RailDrawerProps>(function ConversationsRail({ open, onKeyDown, id }, ref) {
  const { active, newConversation } = useNova();

  return (
    <aside className={'nova-rail' + (open ? ' open' : '')} aria-label="Conversations" id={id} ref={ref} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="nova-rail-head">
        <h2 className="nova-rail-title">Conversations</h2>
        <Button size="sm" variant="ghost" onClick={newConversation} disabled={active === null}>
          <Icon name="add" size={14} />
          New chat
        </Button>
      </div>
      <ConversationList />
    </aside>
  );
});
