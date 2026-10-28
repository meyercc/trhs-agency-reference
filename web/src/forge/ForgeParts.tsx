import { Badge, Button, Icon, Rating } from '../components';
import { FORGE_TYPES, fmtCount, forgeCategoryLabel, isLater, ratingStats } from './listings';
import type { ForgeListing } from './types';
import type { ForgeState } from './ForgeBody';

/** The listing's mark: a brand logo on a plate, or its icon on a tone-tinted tile. */
export function ListingTile({ listing: l, size = 'md' }: { listing: ForgeListing; size?: 'md' | 'lg' }) {
  const lg = size === 'lg' ? ' lg' : '';
  if (l.logo)
    return (
      <span className={'fg-tile logo' + (l.logoDark ? ' dark' : '') + lg}>
        <img src={l.logo} alt="" />
      </span>
    );
  return (
    <span className={'fg-tile' + lg} data-tone={l.tone} aria-hidden>
      <Icon name={l.icon} size={size === 'lg' ? 28 : 18} />
    </span>
  );
}

/** Publisher plus the verification mark — the mark carries its meaning in words for AT. */
export function PubLine({ listing: l }: { listing: ForgeListing }) {
  const official = l.pubKind === 'official';
  const what = official ? 'Official HP brand' : 'Verified studio or creator';
  return (
    <span className="fg-pub">
      {l.pub}
      <span className={'fg-verified' + (official ? ' official' : '')} title={what}>
        <Icon name="check" size={10} label={what} />
      </span>
    </span>
  );
}

export function RateLine({ listing: l, mine }: { listing: ForgeListing; mine?: number }) {
  const r = ratingStats(l, mine);
  if (!r) return <span className="fg-rate">No ratings until release</span>;
  return (
    <span className="fg-rate">
      <Rating value={r.avg} size="sm" />
      <b>{r.avg.toFixed(1)}</b>
      <span>({fmtCount(r.n)})</span>
    </span>
  );
}

/** Type, category, then provenance and release — text badges, so none relies on a tint. */
export function ListingBadges({ listing: l, withNew }: { listing: ForgeListing; withNew?: boolean }) {
  return (
    <div className="fg-badges">
      <Badge variant="status" tone="info">
        {FORGE_TYPES[l.type]}
      </Badge>
      <Badge>{forgeCategoryLabel(l.cat)}</Badge>
      {/* No "Official" badge: the check after the publisher already says it,
          with its kind in words for AT (Chris 2026-10-19). */}
      {l.src === 'partner' && <Badge>Partner app</Badge>}
      {l.tier === 'launch' && (
        <Badge variant="status" tone="positive">
          Launch
        </Badge>
      )}
      {isLater(l) && <Badge variant="coming">Coming later</Badge>}
      {withNew && l.isNew && <Badge variant="new">New</Badge>}
    </div>
  );
}

/**
 * The one primary control. Its label and glyph change with the state, so the
 * state is never only a color: Add → Adding… → Added (✓); an unreleased
 * listing offers Notify me / Notifying instead.
 */
export function AddButton({ listing: l, state, size = 'sm' }: { listing: ForgeListing; state: ForgeState; size?: 'sm' | 'md' }) {
  if (isLater(l)) {
    const on = !!state.forge.notify[l.id];
    return (
      <Button size={size} aria-pressed={on} onClick={() => state.toggleNotify(l.id)}>
        <Icon name="notification" size={14} aria-hidden /> {on ? 'Notifying' : 'Notify me'}
      </Button>
    );
  }
  if (state.installing(l.id))
    return (
      <Button size={size} disabled>
        <Icon name="download" size={14} aria-hidden /> Adding…
      </Button>
    );
  if (state.has(l.id))
    return (
      <Button size={size} aria-label={`${l.name} added. Remove`} title="Remove" onClick={() => state.remove(l.id)}>
        <Icon name="check" size={14} aria-hidden /> Added
      </Button>
    );
  return (
    <Button size={size} variant="accent" aria-label={`Add ${l.name}`} onClick={() => state.addListing(l)}>
      <Icon name="add" size={14} aria-hidden /> Add
    </Button>
  );
}
