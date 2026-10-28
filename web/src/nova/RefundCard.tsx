import { Badge, Meter, Separator } from '../components';
import { GAMES } from '../data/games';
import { PURCHASES, PURCHASE_BY_ID, STORES, WARN_AT_MIN, fmtMinutes, fmtPrice, windowFor, type Purchase, type RefundWindow } from '../data/refunds';
import { usePlaytime } from '../state/Playtime';
import './recap.css';

/** What a refund card shows (TH-484): one purchase's refund window, or how to use it. */
export interface RefundRef {
  /** A `PURCHASES` entry's game id (data/refunds.ts). */
  gameId: string;
  section?: 'window' | 'steps';
}

export interface RefundCardProps extends RefundRef {
  /**
   * Without its own frame — inside a widget or the in-game HUD, whose shell is
   * the frame and whose header is the title (2026-10-20).
   */
  bare?: boolean;
}

/** The state in words — the badge never relies on its tone. */
export function RefundBadge({ w }: { w: RefundWindow }) {
  if (!w.open) return <Badge variant="status" tone="danger">Window closed</Badge>;
  if (w.minutesLeft != null && w.minutesLeft <= WARN_AT_MIN) return <Badge variant="status" tone="warn">{fmtMinutes(w.minutesLeft)} left</Badge>;
  return <Badge variant="status" tone="positive">Refundable</Badge>;
}

function Window({ p, played, w, bare }: { p: Purchase; played: number; w: RefundWindow; bare?: boolean }) {
  const rule = STORES[p.store];
  const daysUsed = rule.days - w.daysLeft;
  return (
    <>
      {/* One meter per limit, the limit in its own value: "1 h 45 min of 2 h". */}
      {rule.minutes != null ? (
        <Meter label="Playtime" value={(Math.min(played, rule.minutes) / rule.minutes) * 100} display={fmtMinutes(played)} unit={` of ${fmtMinutes(rule.minutes)}`} />
      ) : (
        <p className="ds-text-body nova-recap-p nova-recap-dim">
          {fmtMinutes(played)} played — playtime does not count on {rule.name}.
        </p>
      )}
      <Meter label="Since you bought it" value={(daysUsed / rule.days) * 100} display={String(daysUsed)} unit={` of ${rule.days} days`} />
      {/* Bare (a widget, the HUD) leaves the back line out: the price is in the
          header and the time in the badge and the meter, and the card fits two
          board rows instead of spilling into a third. */}
      {!bare && <Separator />}
      {!bare && <p className="ds-text-body nova-recap-p">
        {w.open ? (
          <>
            You would get <strong>{fmtPrice(p.price)}</strong> back.{' '}
            {w.minutesLeft != null ? `${fmtMinutes(w.minutesLeft)} of playtime left` : `${w.daysLeft} days left`}.
          </>
        ) : (
          <>The window has closed; {rule.name} can still be asked.</>
        )}
      </p>}
    </>
  );
}

function Steps({ p }: { p: Purchase }) {
  const rule = STORES[p.store];
  return (
    <section className="nova-recap-section">
      <h4 className="ds-text-overline nova-recap-h">How to ask {rule.name}</h4>
      <ol className="nova-refund-steps">
        {rule.steps.map((s) => (
          <li key={s} className="ds-text-body">
            {s}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Did I Just Waste My Money's card (TH-484), rendered in a Nova reply from a
 * `refund` control record. Live: it reads the playtime clock, so on a game
 * being played the minutes left count down in the conversation itself.
 *
 * The shell is Catch Me Up's recap card (`.nova-recap*`, recap.css): the two
 * agents' cards are one family — a cover, an identity line, sections.
 */
export function RefundCard({ gameId, section = 'window', bare }: RefundCardProps) {
  const { playedMin } = usePlaytime();
  const p = PURCHASE_BY_ID[gameId];
  const game = GAMES.find((g) => g.id === gameId);
  if (!p || !game) return null;
  const played = playedMin(gameId);
  const w = windowFor(p, played);
  const rule = STORES[p.store];
  return (
    <article className={'nova-recap' + (bare ? ' bare' : '')} aria-label={`${game.title} refund window`} data-refund={gameId} data-section={section}>
      <header className="nova-recap-head">
        {game.art && <img className="nova-recap-cover" src={game.art} alt="" />}
        <div className="nova-recap-id">
          <h3 className="ds-text-label strong nova-recap-title">{game.title}</h3>
          <p className="ds-text-caption nova-recap-p nova-recap-dim">
            {rule.name} · bought {p.purchasedDaysAgo} {p.purchasedDaysAgo === 1 ? 'day' : 'days'} ago · {fmtPrice(p.price)}
          </p>
          <RefundBadge w={w} />
        </div>
      </header>
      <Separator />
      {section === 'steps' ? <Steps p={p} /> : <Window p={p} played={played} w={w} bare={bare} />}
    </article>
  );
}

/**
 * The purchase worth watching right now: the game being played, if it is a
 * tracked purchase; otherwise the open window that playtime will close
 * soonest; otherwise the open one with the fewest days. Null when nothing is
 * refundable any more.
 */
export function watchedPurchase(playing: string | null, playedMin: (id: string) => number): Purchase | null {
  if (playing && PURCHASE_BY_ID[playing] && windowFor(PURCHASE_BY_ID[playing], playedMin(playing)).open) return PURCHASE_BY_ID[playing];
  const open = PURCHASES.map((p) => ({ p, w: windowFor(p, playedMin(p.gameId)) })).filter((x) => x.w.open);
  const byMinutes = open.filter((x) => x.w.minutesLeft != null).sort((a, b) => a.w.minutesLeft! - b.w.minutesLeft!);
  if (byMinutes.length) return byMinutes[0].p;
  return open.sort((a, b) => a.w.daysLeft - b.w.daysLeft)[0]?.p ?? null;
}

/**
 * The refund window as a monitor (2026-10-20): the same card the agent replies
 * with, frameless, following whichever purchase `watchedPurchase` picks — so a
 * widget or HUD placed once keeps showing the clock that matters.
 */
export function RefundWatchCard() {
  const { playing, playedMin } = usePlaytime();
  const p = watchedPurchase(playing, playedMin);
  if (!p) return <p className="ds-text-body nova-recap-p nova-recap-dim">Nothing you can still refund.</p>;
  return <RefundCard gameId={p.gameId} bare />;
}

