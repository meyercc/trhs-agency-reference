import { useEffect, useRef, useState } from 'react';
import { NovaTopBar } from '../nova/NovaTopBar';
import { ConversationsRail } from '../nova/ConversationsRail';
import { ChatLog } from '../nova/ChatLog';
import { Composer } from '../nova/Composer';
import { ContextRail } from '../nova/ContextRail';
import { AgentsDashboard } from '../nova/AgentsDashboard';
import { useNovaView } from '../nova/view';
import { useDrawer } from '../nova/usePopover';
import { atLeast, usePageStep } from '../app/breakpoints';
import './nova.css';


/** Which rails are shown at full width — remembered (2026-10-20). */
const RAILS_KEY = 'novaRails';
/**
 * Nova — the AI workspace. Full window below the shell nav (AppShell marks
 * the route `page-full`, shell.css hands the height down), its own bar of
 * views and popovers, and on Chat three columns: conversations, the log with
 * its composer, and the context Nova reasons over. The log is the only thing
 * that scrolls on Chat; the Agents view scrolls as a page.
 *
 * Below 1024px the context rail becomes a drawer, below 900px the
 * conversations rail does too — toggled from the bar, closed by Escape, by
 * choosing a view, or by a click anywhere else. The drawers are CSS: the same
 * rails, translated off-canvas and hidden from the tab order until opened.
 *
 * The provider's router-bound actions are registered by AppShell, not here.
 * They used to be the page's, lent while it was mounted; once Nova could also
 * be a pinned panel on any other page (TH-434) the registration had to come
 * from something mounted for every route.
 *
 * The <h1> is visually hidden: the page's name is in the nav tab and the
 * document title, and a visible heading above the bar would cost the log a
 * line. It is still the page's name to assistive tech, and to verify-nova.
 */
export function Nova() {
  const [view, setView] = useNovaView();
  const left = useDrawer();
  const right = useDrawer();
  const chat = useRef<HTMLDivElement>(null);

  // Show/hide either rail (Chris, 2026-10-20). Wide, a rail is a column and
  // hiding it gives the log its width — remembered. Narrow, a rail is already
  // a drawer, and the same button opens it as before. One button per rail,
  // whatever the width, so the control never moves.
  const [rails, setRails] = useState<{ left: boolean; right: boolean }>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(RAILS_KEY) || 'null');
      return v && typeof v === 'object' ? { left: v.left !== false, right: v.right !== false } : { left: true, right: true };
    } catch {
      return { left: true, right: true };
    }
  });
  const setRail = (side: 'left' | 'right', shown: boolean) =>
    setRails((r) => {
      const next = { ...r, [side]: shown };
      try {
        localStorage.setItem(RAILS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  // Both rails are drawers below `expanded` — the page's step, as nova.css queries it.
  const drawers = !atLeast(usePageStep(), 'expanded');
  const toggleRail = (side: 'left' | 'right') => {
    if (drawers) (side === 'left' ? left : right).toggle();
    else setRail(side, !rails[side]);
  };

  // A click outside an open drawer (and its toggle) closes it.
  useEffect(() => {
    if (!left.open && !right.open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      const inside = (el: Element | null) => !!el && el.contains(t);
      if (left.open && !inside(left.panelRef.current) && !inside(left.triggerRef.current)) left.close();
      if (right.open && !inside(right.panelRef.current) && !inside(right.triggerRef.current)) right.close();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [left, right]);

  const chooseView = (v: typeof view) => {
    left.close();
    right.close();
    setView(v);
  };

  return (
    <div className="nova">
      <h1 className="page-title ds-sr-only">Nova</h1>
      <NovaTopBar
        view={view}
        onView={chooseView}
        conversations={view === 'chat' ? { open: left.open, shown: rails.left, toggle: () => toggleRail('left'), ref: left.triggerRef, controls: 'nova-rail-conversations' } : undefined}
        context={view === 'chat' ? { open: right.open, shown: rails.right, toggle: () => toggleRail('right'), ref: right.triggerRef, controls: 'nova-rail-context' } : undefined}
      />
      {view === 'chat' ? (
        <div
          className={'nova-chat' + (left.open || right.open ? ' drawer-open' : '') + (rails.left ? '' : ' hide-left') + (rails.right ? '' : ' hide-right')}
          role="tabpanel"
          aria-label="Chat"
          ref={chat}
        >
          <ConversationsRail id="nova-rail-conversations" ref={left.panelRef} open={left.open} onKeyDown={left.onKeyDown} />
          <div className="nova-center">
            <ChatLog />
            {/* The selectors are at the top of the context rail here. */}
            <Composer selects={false} />
          </div>
          <ContextRail id="nova-rail-context" ref={right.panelRef} open={right.open} onKeyDown={right.onKeyDown} />
        </div>
      ) : (
        <AgentsDashboard />
      )}
    </div>
  );
}
