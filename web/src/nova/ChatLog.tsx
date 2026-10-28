import { useEffect, useRef } from 'react';
import { ChatMessage, Chip, Icon } from '../components';
import { AGENT_BY_ID } from '../agents/registry';
import { useNova, type NovaActionRecord, type NovaControlRecord, type NovaMessage } from '../state/Nova';
import { JUNE_HIDDEN_PILLS, PILLS, SCRIPT_BY_ID } from './scripts';
import { useSettings } from '../state/Settings';
import { relTime } from './format';
import { isBespokeControl, LiveControl } from '../controls/LiveControl';
import { BoundItem } from '../controls/BoundItem';
import { OverlayPreview } from '../overlays/OverlayPreview';
import { LayoutPreview } from '../widgets/LayoutPreview';
import { CardPreview } from '../widgets/CustomWidget';
import { recipeById } from '../agents/recipes';
import type { AgentCardRef } from './scripts';

/**
 * The recipe card a control shows. Conversations saved before the manifest
 * (2026-10-26) carry Catch Me Up's card as kind `recap` and the refund agent's
 * as `refund`; they read as the same cards.
 */
function agentCardOf(c: NovaControlRecord): AgentCardRef | null {
  if (c.agentCard) return c.agentCard;
  const kind = c.kind as string;
  if (kind === 'recap' && c.recap) return { agent: 'catch-me-up', card: 'recap', props: c.recap };
  if (kind === 'refund' && c.refund) return { agent: 'did-i-just-waste-my-money', card: 'refund', props: c.refund };
  return null;
}

/** A Nova recipe's card, from its manifest entry — before the fallthrough, where it would render empty. */
function AgentCard({ card }: { card: AgentCardRef | null }) {
  const Card = card ? recipeById(card.agent)?.cards[card.card] : undefined;
  // Said out loud: a reply whose card is missing still renders "fine", one
  // card short (verify-agents listens for this line).
  if (!Card) console.error(`Nova recipe card missing: ${card ? `${card.agent} › ${card.card}` : 'no card ref'}`);
  return Card && card ? <Card {...card.props} /> : null;
}

function speaker(m: NovaMessage): string {
  if (m.role === 'user') return 'You';
  return m.agentId ? (AGENT_BY_ID[m.agentId]?.name ?? m.agentId) : 'Nova';
}

/**
 * The call a chip performs. Since TH-435 the record carries it; the label
 * lookup is for conversations persisted before that, whose records have
 * only a label.
 */
function callFor(a: NovaActionRecord) {
  if (a.call) return a.call;
  for (const s of Object.values(SCRIPT_BY_ID)) {
    for (const st of s.steps) if ('offer' in st && st.label === a.label) return st.offer;
  }
  return null;
}

/**
 * The conversation — the only thing on the Chat view that scrolls. Newest
 * at the bottom; the list is bottom-anchored so a short chat sits above the
 * composer rather than under the bar. Follows new text while the reader is
 * at the bottom, and leaves them alone if they have scrolled up to re-read.
 *
 * Announcements go through one polite live region: "Nova is typing", then
 * the finished reply once — not every token (that is noise, not access).
 */
export function ChatLog() {
  const { active, busy, perform, send } = useNova();
  // June 2027 offers no prompt for a feature it leaves out (JUNE_OUT_OF_SCOPE).
  const { mvpScope } = useSettings();
  const pills = mvpScope === 'june27' ? PILLS.filter((p) => !JUNE_HIDDEN_PILLS.has(p.id)) : PILLS;
  const ref = useRef<HTMLDivElement>(null);
  const messages = active?.messages ?? [];
  const last = messages[messages.length - 1];
  const lastText = last?.text ?? '';
  const atBottom = useRef(true);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useEffect(() => {
    const el = ref.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastText, active?.id]);
  // A new conversation always opens at its end.
  useEffect(() => {
    atBottom.current = true;
  }, [active?.id]);

  const announce = busy && last?.role === 'assistant' ? `${speaker(last)} is typing` : last?.role === 'assistant' && !last.status ? `${speaker(last)}: ${last.text}` : '';

  return (
    <div className="nova-log" role="log" aria-label="Conversation" tabIndex={-1} ref={ref} onScroll={onScroll}>
      <div className="ds-sr-only" role="status" aria-live="polite">
        {announce}
      </div>
      {messages.length === 0 ? (
        <div className="nova-log-empty">
          <Icon name="twinkle" size={28} className="nova-log-empty-icon" />
          <p className="nova-log-empty-title">What are we tuning today?</p>
          <p className="nova-log-empty-note">Pick a quick prompt, or ask in your own words.</p>
          {/* The quick prompts live HERE, on an empty conversation only (Chris,
              2026-10-20): once a conversation is under way they are mostly
              beside the point. They stay in the context rail's "Can help with". */}
          <div className="nova-prompts nova-log-empty-prompts" aria-label="Quick prompts">
            {pills.map((p) => (
              <Chip key={p.id} onClick={() => send(p.label!, { scriptId: p.id })} disabled={busy}>
                {p.label}
              </Chip>
            ))}
          </div>
        </div>
      ) : (
        <div className="nova-log-list">
          {messages.map((m) => {
            const name = speaker(m);
            const agent = m.agentId ? AGENT_BY_ID[m.agentId] : null;
            const metaBits = m.role === 'assistant' ? [name, relTime(m.at), m.usage?.estimated ? 'estimated' : null, m.status === 'error' ? 'Not connected' : null] : [relTime(m.at)];
            return (
              <ChatMessage
                key={m.id}
                role={m.role}
                name={name}
                status={m.status}
                data-source={m.source}
                avatar={m.role === 'assistant' ? <Icon name={agent?.icon ?? 'twinkle'} size="sm" /> : undefined}
                meta={metaBits.filter(Boolean).join(' · ')}
                wide={!!m.controls?.length}
                controls={
                  m.controls?.length ? (
                    <>
                      {m.controls.map((c, i) =>
                        c.kind === 'overlay' ? (
                          c.spec ? <OverlayPreview key={i} spec={c.spec} composing={!!c.preview && m.status === 'streaming'} /> : null
                        ) : c.kind === 'card' ? (
                          // The composed widget itself, at board size (TH-443).
                          c.card ? <CardPreview key={i} spec={c.card} composing={!!c.preview && m.status === 'streaming'} /> : null
                        ) : c.kind === 'layout' ? (
                          // A diagram of the proposed board (TH-442). Nothing is
                          // applied until a chip is pressed, so this is the only
                          // place the proposal is visible before it is real.
                          c.layout ? <LayoutPreview key={i} items={c.layout} /> : null
                        ) : c.kind === 'agent-card' || agentCardOf(c) ? (
                          <AgentCard key={i} card={agentCardOf(c)} />
                        ) : isBespokeControl(c.kind) ? (
                          <LiveControl key={i} kind={c.kind} />
                        ) : (
                          // A control record naming a registry row (TH-452).
                          <BoundItem key={i} item={{ kind: 'bound', bind: c.kind }} />
                        ),
                      )}
                    </>
                  ) : undefined
                }
                actions={
                  m.actions?.length ? (
                    <>
                      {m.actions.map((a, i) => {
                        const call = callFor(a);
                        return (
                          <Chip key={i} onClick={call ? () => perform(call, a.label) : undefined} disabled={!call}>
                            {a.label}
                          </Chip>
                        );
                      })}
                    </>
                  ) : undefined
                }
              >
                {m.text || undefined}
              </ChatMessage>
            );
          })}
        </div>
      )}
    </div>
  );
}
