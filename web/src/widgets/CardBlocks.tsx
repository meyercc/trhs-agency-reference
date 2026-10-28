/**
 * The app panels a composed card can hold (TH-450): what you played, what is
 * on sale, what Nova has cost, and Nova itself. Rendered by `OverlayItems`, so
 * a block reads the same on the board and in the HUD, like every other item.
 *
 * None of these is a new component. The rows are `ListItem` with a cover in
 * its leading slot and the value in its trailing one; the price pair is
 * `Price`; the tiles are the Tokenomics popover's own; the field is `Input`.
 * The data is the app's own too — `RECENT` and `dealsOf` from the game
 * catalog, the Nova ledger, the active conversation — so a block is a second
 * view of one fact, never a copy of it.
 *
 * A block whose module is not installed says so in the same frame a control
 * uses when its device is absent, rather than rendering an empty panel.
 */
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Input, ListItem, Price } from '../components';
import { LiveControlFrame } from '../controls/LiveControl';
import { RECENT, dealsOf, discountLabel, priceLabel, type Game } from '../data/games';
import { TokenomicsTiles } from '../nova/TokenomicsPopover';
import { useModules } from '../state/Modules';
import { useNova } from '../state/Nova';
import { recipeBlockRender } from '../agents/recipes';
import { BLOCK_META, blockCount, type OverlayItem } from '../state/overlays';
import './card-blocks.css';

type BlockItem = Extract<OverlayItem, { kind: 'block' }>;

export function CardBlock({ item }: { item: BlockItem }) {
  switch (item.block) {
    case 'recent-games':
      return <RecentGamesBlock count={blockCount(item)} />;
    case 'deals':
      return <DealsBlock count={blockCount(item)} />;
    case 'tokenomics':
      return <TokenomicsBlock />;
    case 'nova-chat':
      return <NovaChatBlock />;
    default: {
      // A Nova recipe's block (Catch Me Up's list and recap, the refund
      // agent's windows and clock): rendered by the recipe that declares it.
      const Block = recipeBlockRender(item.block);
      // Said out loud, as a missing recipe card is (verify-agents listens).
      if (!Block) console.error(`Nova recipe block missing: ${item.block}`);
      return Block ? <Block item={item} /> : null;
    }
  }
}

/** The honest absent state — the control frame's own, so both absences read alike. */
function Absent({ block, note }: { block: BlockItem['block']; note: string }) {
  return (
    <LiveControlFrame title={BLOCK_META[block].label} data-block={block}>
      <span className="ds-live-control-value">{note}</span>
    </LiveControlFrame>
  );
}

/**
 * Rows of games. `ListItem` is a listbox option, so the rows sit in a listbox
 * and each one takes Enter and Space as well as a click — the board's drag
 * handle is the header, so a row's pointer stays its own.
 */
function GameRows({ block, games, label, to, trailing }: { block: BlockItem['block']; games: Game[]; label: string; to: string; trailing: (g: Game) => ReactNode }) {
  const navigate = useNavigate();
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(to);
    }
  };
  return (
    <div className="cb-block cb-list" role="listbox" aria-label={label} data-block={block}>
      {games.map((g) => (
        <ListItem
          key={g.id}
          className="cb-row"
          leading={<img className="cb-cover" src={g.art} alt="" />}
          label={g.title}
          trailing={trailing(g)}
          aria-label={g.title}
          onClick={() => navigate(to)}
          onKeyDown={onKey}
        />
      ))}
    </div>
  );
}

/** What you played, most recent first — `RECENT`, the list Jump Back In reads. */
function RecentGamesBlock({ count }: { count: number }) {
  return <GameRows block="recent-games" games={RECENT.slice(0, count)} label="Recent games" to="/play" trailing={(g) => <span className="cb-meta">{g.genre}</span>} />;
}

/** The store's deepest savings — `dealsOf`, the list the Deals widget shows. */
function DealsBlock({ count }: { count: number }) {
  const { has } = useModules();
  if (!has('shop')) return <Absent block="deals" note="The Shop module is not installed." />;
  return (
    <GameRows
      block="deals"
      games={dealsOf(count)}
      label="Deals"
      to="/shop"
      trailing={(g) => (
        <>
          <Price now={priceLabel(g.price)} was={priceLabel(g.was)} />
          <Badge variant="sale">{discountLabel(g)}</Badge>
        </>
      )}
    />
  );
}

/** The three ledger totals, compact, flowing 2-up beside the readings. */
function TokenomicsBlock() {
  const { has } = useModules();
  if (!has('nova')) return <Absent block="tokenomics" note="The Nova module is not installed." />;
  return <TokenomicsTiles compact data-block="tokenomics" />;
}

/**
 * Nova in a card: the last thing it said and a field to say the next thing.
 * The field sends to the active conversation through the same `send` the
 * composer uses, so the exchange is in the log on the Nova page afterwards.
 * Enter sends; while a reply is being produced the field says so and a send is
 * ignored rather than queued, which is the composer's rule too.
 */
function NovaChatBlock() {
  const { has } = useModules();
  const { active, send, busy } = useNova();
  const [draft, setDraft] = useState('');
  if (!has('nova')) return <Absent block="nova-chat" note="The Nova module is not installed." />;
  const last = [...(active?.messages ?? [])].reverse().find((m) => m.role === 'assistant' && m.text.trim());
  const submit = () => {
    const t = draft.trim();
    if (!t || busy) return;
    send(t);
    setDraft('');
  };
  return (
    <div className="cb-block cb-chat" data-block="nova-chat">
      <p className="cb-chat-last" aria-live="polite">
        {busy ? 'Nova is typing…' : last?.text ?? 'Ask about this machine, the desk or the profile you are in.'}
      </p>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Ask Nova"
        aria-label="Ask Nova"
        trailingIcon="send"
        trailingLabel="Send"
        onTrailingClick={submit}
      />
    </div>
  );
}
