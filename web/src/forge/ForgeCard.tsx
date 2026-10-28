import { Badge, Icon } from '../components';
import { counts, fmtCompact } from './listings';
import type { ForgeListing } from './types';
import type { ForgeState } from './ForgeBody';
import { AddButton, ListingBadges, ListingTile, PubLine, RateLine } from './ForgeParts';

/** What a listing has done here, for the card's extra line. Nova's ledger supplies it. */
export interface ForgeUsage {
  runs: number;
  tokens: number;
  lastUsed: number;
}

const fmtK = (n: number) => (n < 1000 ? String(n) : n < 1_000_000 ? `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k` : `${(n / 1_000_000).toFixed(2)}M`);
const ago = (at: number) => {
  const d = Date.now() - at;
  if (d < 3_600_000) return 'just now';
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
};

/**
 * Forge's grid unit. The name is the card's link — its hit area stretches over
 * the whole card — and every other control sits above it as a real button, so
 * nothing interactive is nested inside anything else.
 *
 * The downloads row is pinned to the card's foot (`margin-top: auto`): cards
 * in a row share one height, and their foot lines up whatever the copy above
 * does.
 */
export function ForgeCard({ listing: l, state, usage }: { listing: ForgeListing; state: ForgeState; usage?: ForgeUsage }) {
  const m = state.mine(l.id);
  const c = counts(l, m);
  return (
    <article className={'fg-card' + (m.added ? ' is-added' : '')} aria-label={l.name}>
      <div className="fg-card-top">
        <ListingTile listing={l} />
        <div className="fg-card-titles">
          <div className="fg-card-name-row">
            <button type="button" className="fg-card-open" onClick={() => state.open(l.id)}>
              {l.name}
            </button>
            {l.isNew && <Badge variant="new">New</Badge>}
          </div>
          <PubLine listing={l} />
          <RateLine listing={l} mine={m.rating} />
        </div>
        <AddButton listing={l} state={state} />
      </div>
      <p className="fg-card-desc">{l.summary}</p>
      <ListingBadges listing={l} />
      {usage && usage.runs > 0 && (
        <div className="fg-card-usage">
          {usage.runs} run{usage.runs === 1 ? '' : 's'} · {fmtK(usage.tokens)} tokens · {ago(usage.lastUsed)}
        </div>
      )}
      {/* Votes, likes and saves live on the listing's page, not the card (Chris
          2026-10-19): a grid of cards each carrying four counters read as noise.
          The download count stays as the card's one popularity figure. */}
      <div className="fg-stats">
        <span className="fg-ctl static" title="Downloads">
          <Icon name="download" size={14} label="Downloads" />
          {fmtCompact(c.dl)}
        </span>
      </div>
    </article>
  );
}
