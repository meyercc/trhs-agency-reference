import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Icon, IconButton, ResizeHandle, Tooltip, type ResizeHandleProps } from '../components';
import { useRecipeStatuses } from '../agents/recipes';
import { ChatLog } from '../nova/ChatLog';
import { Composer } from '../nova/Composer';
import { ConversationList } from '../nova/ConversationsRail';
import { NovaPopover } from '../nova/NovaPopover';
import { useNova } from '../state/Nova';
import './nova-panel.css';

/**
 * Nova pinned to the right rail (TH-434) — the chat, and only the chat,
 * following you across every page the way the Devices flyout does.
 *
 * It is the SAME ChatLog and Composer the /nova page renders, reading the
 * same provider, so a conversation continued here is the one the page shows:
 * there is one Nova, in two places, never two Novas. That is also why the
 * page wins — AppShell withholds the panel on `/nova` rather than drawing a
 * second copy of the log beside the first (which reads as a bug, not a
 * feature).
 *
 * The header carries the three things chat-only costs you: the conversation
 * picker the page keeps in its left rail, the Agent Catalog that used to sit
 * in the shell nav, and a way out to the full page for Agents and Tokenomics.
 *
 * Closed, it is parked off-canvas AND `visibility: hidden` (nova-panel.css),
 * so the composer and every chip leave the tab order — a panel you cannot see
 * must not be a panel you can Tab into. Its CONTENTS go further and unmount:
 * a hidden-but-mounted chat put a second live `.nova-log`, composer and polite
 * live region in the document on /nova, bound to the same store as the page's
 * — invisible, duplicated render work, and exactly the kind of thing that
 * reads as fine until something counts the elements (verify-nova, TH-434).
 * The frosted shell stays mounted so the slide still runs in both directions;
 * the contents linger for the length of that slide and then go.
 */
/**
 * True while `on` is true, and for `ms` after it goes false — long enough for
 * a closing transition to finish with its content still in place. Lets a
 * surface animate out and still leave the DOM afterwards, which `open` alone
 * cannot express: unmounting on `open=false` kills the exit, and never
 * unmounting leaves a duplicate tree behind.
 */
function useLingering(on: boolean, ms: number): boolean {
  const [present, setPresent] = useState(on);
  useEffect(() => {
    if (on) {
      setPresent(true);
      return;
    }
    const t = setTimeout(() => setPresent(false), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return present;
}

/** Matches `--dur-slow`, the slide in nova-panel.css. */
const SLIDE_MS = 350;


/** From this width (px) the panel drops its narrow-column treatment (nova-panel.css `.wide`). */
const NOVA_WIDE_AT = 640;
export function NovaPanel({
  open,
  mode = 'rail',
  floating = false,
  onClose,
  onOpenAgents,
  resize,
  resizeHeight,
}: {
  open: boolean;
  /**
   * `rail` docks to the right edge beside the page (TH-434); `window` is the
   * floating chat the Nova FAB opens (TH-507) — anchored bottom-right above
   * the button, grown out of it, reserving nothing. Same contents either way.
   */
  mode?: 'rail' | 'window';
  /**
   * Over the page rather than beside it (2026-10-20): wider than the room the
   * page reserves, or on a window too narrow to reserve any. Takes the
   * elevation that says so (nova-panel.css `.floating`).
   */
  floating?: boolean;
  onClose: () => void;
  /**
   * The left edge's resize (Chris, 2026-10-20) — the shell owns the width and
   * its bounds; `snap` is true while a drag has gone past the widest sidebar,
   * which on release opens the full page.
   */
  resize?: Omit<ResizeHandleProps, 'label' | 'edge'> & { snap: boolean };
  /**
   * The window's height, from its top edge (TH-507) — the shell owns it, as it
   * owns the width; its snap shows through `resize.snap`. A rail has none: it
   * runs from the top bar to the foot of the window.
   */
  resizeHeight?: Omit<ResizeHandleProps, 'label' | 'edge'>;
  /** Opens Forge (`?modal=agents`, the Agent Catalog's old URL) — the shell owns the URL. */
  onOpenAgents: () => void;
}) {
  const { active, busy, newConversation } = useNova();
  const isWindow = mode === 'window';
  // An agent mid-story says where it is on the status line (TH-509).
  const [agentStatus] = useRecipeStatuses();
  const navigate = useNavigate();
  const present = useLingering(open, SLIDE_MS);

  return (
    <aside
      id="nova-panel"
      className={'ds-panel nova-panel' + (isWindow ? ' window' : '') + (open ? ' open' : '') + (busy ? ' busy' : '') + (floating ? ' floating' : '') + (resize?.snap ? ' snap-full' : '') + (resize && resize.value >= NOVA_WIDE_AT ? ' wide' : '')}
      aria-label="Nova"
      aria-hidden={!open}
      aria-busy={busy || undefined}
    >
      {present && (
        <>
          {resize && <ResizeHandle label="Resize Nova" edge="left" {...resize} />}
          {isWindow && resizeHeight && <ResizeHandle label="Resize Nova height" edge="top" {...resizeHeight} />}
          {/* Past the widest sidebar, the drag means "full screen" — said in
              words, so the release is never a surprise. */}
          {resize?.snap && (
            <div className="novp-snap" role="status">
              <Icon name="expand" size={20} aria-hidden />
              Release to open Nova full screen
            </div>
          )}
          <div className="ds-panel-header">
            {/* The state in words as well as in motion: the header's scan line
                (nova-panel.css) is decoration; this is the reading. The log's
                own live region does the announcing. */}
            <div className="novp-title">
              <span className="ds-panel-title">Nova</span>
              <span className="novp-status" aria-hidden>
                <span className="novp-status-dot" />
                {busy ? 'Thinking…' : 'Ready'}
                {agentStatus && (
                  <Badge variant="status" tone={agentStatus.tone} className="novp-agent-status">
                    {agentStatus.text}
                  </Badge>
                )}
              </span>
            </div>
            <div className="novp-actions">
              {/* The left rail's job, compressed to one control: the grouped list
              is ConversationList, the same rows the page draws. */}
              <NovaPopover id="nova-panel-conversations" label="Conversations" icon="details">
                <div className="nova-pop-body novp-convos">
                  <div className="nova-rail-head">
                    <h2 className="nova-rail-title">Conversations</h2>
                    <Button size="sm" variant="ghost" onClick={newConversation} disabled={active === null}>
                      <Icon name="add" size={14} />
                      New chat
                    </Button>
                  </div>
                  <ConversationList />
                </div>
              </NovaPopover>
              {/* Moved here from `.shell-util` (TH-434): the catalog belongs beside
              the agents you talk to, not beside the Module Browser. */}
              <Tooltip content="Forge" placement="bottom">
                <IconButton label="Forge" onClick={onOpenAgents}>
                  <Icon name="ai" size={16} />
                </IconButton>
              </Tooltip>
              {/* Agents and Tokenomics only exist at page width. */}
              <Tooltip content="Open full page" placement="bottom">
                <IconButton label="Open Nova full page" onClick={() => navigate('/nova')}>
                  <Icon name="expand" size={16} />
                </IconButton>
              </Tooltip>
              {/* A window tucks back into its button; a rail unpins. */}
              <button className="ds-panel-close" onClick={onClose} title={isWindow ? 'Minimize' : 'Unpin'} aria-label={isWindow ? 'Minimize Nova' : 'Unpin Nova'}>
                <Icon name={isWindow ? 'chevron-down' : 'close'} />
              </button>
            </div>
          </div>

          {/* Not `.ds-panel-body`: that pads and scrolls as one block, and a chat
          column needs the log to scroll under a composer that does not. The
          page's own `.nova-center` is exactly that pair, so the panel borrows
          it rather than restating it. */}
          <div className="nova-center">
            <ChatLog />
            {/* A window is closed by Escape like any popup; the rail keeps it (gotcha 5). */}
            <Composer onEmptyEscape={isWindow ? onClose : undefined} />
          </div>
        </>
      )}
    </aside>
  );
}
