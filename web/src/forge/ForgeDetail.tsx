import { useEffect, useState } from 'react';
import { Badge, Button, Icon, Meter, Rating, Sparkline, Textarea, ToggleButtonGroup } from '../components';
import {
  FORGE_FEATURED_ID,
  FORGE_TYPES,
  FORGE_TYPE_HELP,
  counts,
  downloadSeries,
  fmtCount,
  forgeCategoryLabel,
  isLater,
  ratingStats,
  sampleReviews,
  updatedText,
} from './listings';
import type { ForgeListing } from './types';
import type { ForgeDetailTab, ForgeState } from './ForgeBody';
import { AddButton, ListingBadges, ListingTile, PubLine, RateLine } from './ForgeParts';
import { ForgeClip } from './ForgeHero';

const STAR_LABELS = ['Doesn’t work', 'Poor', 'OK', 'Good', 'Excellent'];
const shortDate = (at: number) => new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * One listing's page inside Forge: header with the primary action, a tab
 * strip over the long-form sections, and a standing aside — ratings and
 * votes, downloads, what it can touch, and the release record.
 *
 * "What it can touch" sits beside the description rather than inside a tab:
 * what a listing can reach is part of deciding to add it.
 */
export function ForgeDetail({ listing: l, state }: { listing: ForgeListing; state: ForgeState }) {
  const { tab, setTab, close, section, mine } = state;
  const m = mine(l.id);
  const back = section === 'yours' ? 'Yours' : section === 'discover' ? 'Discover' : forgeCategoryLabel(section);

  return (
    <div className="fg-detail">
      <button type="button" className="fg-back" onClick={close}>
        <Icon name="chevron-left" size={14} aria-hidden /> {back}
      </button>

      <div className="fg-detail-head">
        <ListingTile listing={l} size="lg" />
        <div className="fg-detail-titles">
          <ListingBadges listing={l} withNew />
          <h2 className="fg-detail-name">{l.name}</h2>
          <PubLine listing={l} />
          <button type="button" className="fg-linkish" onClick={() => setTab('ratings')} aria-label="See ratings">
            <RateLine listing={l} mine={m.rating} />
          </button>
          <p className="fg-detail-summary">{l.summary}</p>
        </div>
        <div className="fg-detail-actions">
          <AddButton listing={l} state={state} size="md" />
          <Button variant={m.saved ? 'default' : 'ghost'} aria-pressed={m.saved} onClick={() => state.toggleSaved(l.id)}>
            <Icon name={m.saved ? 'bookmark-fill' : 'bookmark'} size={14} aria-hidden /> {m.saved ? 'Saved' : 'Save'}
          </Button>
          <Button variant={m.liked ? 'default' : 'ghost'} aria-pressed={m.liked} onClick={() => state.toggleLiked(l.id)}>
            <Icon name={m.liked ? 'heart-fill' : 'heart'} size={14} aria-hidden /> {m.liked ? 'Liked' : 'Like'}
          </Button>
        </div>
      </div>

      <div className="fg-detail-cols">
        <div className="fg-detail-main">
          <ToggleButtonGroup
            className="fg-tabs"
            aria-label={`${l.name} sections`}
            value={tab}
            onChange={(v) => setTab(v as ForgeDetailTab)}
            options={[
              { label: 'Overview', value: 'overview' },
              { label: 'Ratings', value: 'ratings' },
              { label: 'How it works', value: 'recipe' },
              { label: 'Trust card', value: 'card' },
              { label: 'Versions', value: 'versions' },
            ]}
          />
          {tab === 'overview' && <Overview listing={l} />}
          {tab === 'ratings' && <Ratings listing={l} state={state} />}
          {tab === 'recipe' && <Recipe listing={l} />}
          {tab === 'card' && <TrustCard listing={l} />}
          {tab === 'versions' && <Versions listing={l} />}
        </div>
        <Aside listing={l} state={state} />
      </div>
    </div>
  );
}

function Overview({ listing: l }: { listing: ForgeListing }) {
  return (
    <>
      {l.id === FORGE_FEATURED_ID && (
        <>
          <h3 className="fg-section-label">See it in action</h3>
          <ForgeClip tagged />
          <p className="fg-clip-caption">
            <b>0:00</b> A death review Autocast AI cut from a Counter-Strike 2 match: the 30 seconds leading up to the death, ending on who got you and with what.{' '}
            <b>0:30</b> Autocast’s Live Control screen during a CS2 session — the live preview, audio mixer and watchers on the left while clip suggestions fill the
            queue on the right, each waiting for your approval.
          </p>
        </>
      )}
      <h3 className="fg-section-label">About</h3>
      <p className="fg-prose">{l.desc}</p>
      <h3 className="fg-section-label">What it does</h3>
      <ul className="fg-list">
        {l.does.map((d) => (
          <li key={d}>
            <Icon name="check" size={12} aria-hidden /> {d}
          </li>
        ))}
      </ul>
      <h3 className="fg-section-label">Things you can ask Nova</h3>
      <ul className="fg-list quoted">
        {l.asks.map((d) => (
          <li key={d}>
            <Icon name="chat-support" size={12} aria-hidden /> {d}
          </li>
        ))}
      </ul>
      <h3 className="fg-section-label">Works with</h3>
      <div className="fg-badges">
        {l.games.map((g) => (
          <Badge key={g}>{g}</Badge>
        ))}
      </div>
      {l.url && (
        <p className="fg-hint" style={{ marginTop: 'var(--gutter-sm)' }}>
          Publisher site:{' '}
          <a className="fg-link" href={l.url} target="_blank" rel="noopener noreferrer">
            {l.url.replace(/^https?:\/\//, '')}
          </a>
        </p>
      )}
    </>
  );
}

function Ratings({ listing: l, state }: { listing: ForgeListing; state: ForgeState }) {
  const mine = state.forge.rating[l.id];
  const receipt = state.forge.receipt[l.id];
  const added = state.has(l.id);
  const [editing, setEditing] = useState(false);
  const [stars, setStars] = useState(mine?.stars ?? 0);
  const [text, setText] = useState(mine?.text ?? '');
  // A different listing, or a posted/deleted rating, resets the draft.
  useEffect(() => {
    setStars(mine?.stars ?? 0);
    setText(mine?.text ?? '');
    setEditing(false);
  }, [l.id, mine?.at]);

  const r = ratingStats(l, mine?.stars);
  if (!r) return <p className="fg-empty">Ratings open when {l.name} is released. Only players with a verified install can rate it.</p>;
  const max = Math.max(...r.d, 1);

  let composer;
  if (mine && !editing) {
    composer = (
      <div className="fg-review mine">
        <div className="fg-review-head">
          <span className="fg-review-who">You</span>
          <Rating value={mine.stars} size="sm" />
          <Badge variant="status" tone="positive">
            Verified install
          </Badge>
          <span className="fg-review-when">
            {shortDate(mine.at)} · v{mine.ver}
          </span>
        </div>
        {mine.text && <p>{mine.text}</p>}
        <div className="fg-receipt" style={{ marginTop: 'var(--gutter-xs)' }}>
          <Icon name="lock-on" size={12} aria-hidden /> Linked to install receipt <code>{mine.receipt}</code>
        </div>
        <div className="fg-composer-row" style={{ marginTop: 'var(--gutter-xs)' }}>
          <Button size="sm" onClick={() => setEditing(true)}>
            <Icon name="edit" size={14} aria-hidden /> Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => state.unrate(l.id)}>
            <Icon name="trash" size={14} aria-hidden /> Delete
          </Button>
        </div>
      </div>
    );
  } else if (added || mine) {
    composer = (
      <div className="fg-composer">
        <h4>{mine ? 'Edit your rating' : `Rate ${l.name}`}</h4>
        {receipt && (
          <div className="fg-receipt">
            <Badge variant="status" tone="positive">
              Verified install
            </Badge>
            <span>
              Added {shortDate(receipt.at)} · v{receipt.ver || l.ver} · receipt <code>{receipt.id}</code>
            </span>
          </div>
        )}
        <div className="fg-composer-row">
          <Rating value={stars} onChange={setStars} label="Your rating" starLabels={STAR_LABELS} />
          <span className="fg-hint">{stars ? STAR_LABELS[stars - 1] : 'Choose a star'}</span>
        </div>
        <Textarea rows={3} maxLength={500} placeholder="What worked, what didn’t? (optional)" aria-label="Your review" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="fg-composer-row end">
          {mine && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
          <Button size="sm" variant="accent" disabled={!stars} onClick={() => state.rate(l.id, stars, text, l.ver)}>
            {mine ? 'Update rating' : 'Post rating'}
          </Button>
        </div>
      </div>
    );
  } else {
    composer = (
      <div className="fg-composer">
        <h4>Rate {l.name}</h4>
        <Rating value={0} onChange={() => {}} label="Your rating" disabled />
        <p className="fg-note" style={{ margin: 0 }}>
          <Icon name="lock-on" size={14} aria-hidden />
          <span>Only players with a verified install can rate. Add it to this PC and Forge issues a signed install receipt; your rating is tied to that receipt.</span>
        </p>
        <div>
          <AddButton listing={l} state={state} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fg-r-summary">
        <div className="fg-r-figure">
          <span className="fg-big">{r.avg.toFixed(1)}</span>
          <Rating value={r.avg} size="lg" />
          <span className="fg-hint">{r.n.toLocaleString()} ratings, all from verified installs</span>
        </div>
        <div className="fg-r-hist" aria-label="Rating breakdown" role="group">
          {[5, 4, 3, 2, 1].map((k) => (
            <Meter key={k} label={`${k} star${k > 1 ? 's' : ''}`} value={(r.d[k - 1] / max) * 100} display={fmtCount(r.d[k - 1])} unit="" />
          ))}
        </div>
      </div>
      {composer}
      <h3 className="fg-section-label">
        Reviews <span className="fg-hint">· sample, illustrative</span>
      </h3>
      <div className="fg-reviews">
        {sampleReviews(l).map((x) => (
          <div className="fg-review" key={x.who}>
            <div className="fg-review-head">
              <span className="fg-review-who">{x.who}</span>
              <Rating value={x.stars} size="sm" />
              <Badge variant="status" tone="positive">
                Verified install
              </Badge>
              <span className="fg-review-when">
                {x.days}d ago · v{x.ver}
              </span>
            </div>
            <p>{x.text}</p>
            <div className="fg-hint" style={{ marginTop: 'var(--gutter-xxs)' }}>
              {x.helpful} found this helpful
            </div>
          </div>
        ))}
      </div>
      <p className="fg-note">
        <Icon name="info" size={14} aria-hidden />
        <span>
          How verification works: when you add a listing, Forge records a signed install receipt for your account and this PC. Ratings and votes are only accepted with a
          matching receipt, one per account per listing. You can change or delete your rating any time; removing the app keeps the rating, because you did use it.
        </span>
      </p>
    </>
  );
}

function Recipe({ listing: l }: { listing: ForgeListing }) {
  const intro =
    l.type === 'recipe'
      ? 'This recipe is plain instructions Nova follows. There is no code in it.'
      : l.type === 'app'
        ? 'Apps include their own code. This is the part of the package that tells Nova how to use the app.'
        : 'This pairs a recipe with tools. Below is the recipe; the tools are listed under What it can touch.';
  const src = [
    '---',
    `name: ${l.id}`,
    `description: ${l.summary}`,
    `version: ${l.ver}`,
    `type: ${l.type}`,
    `works-with: [${l.games.join(', ')}]`,
    `access: [${l.access.map((a) => a.label.toLowerCase()).join(', ') || 'none'}]`,
    '---',
    '',
    `# ${l.name}`,
    '',
    '## When to use',
    ...l.asks.map((a) => `- ${a.replace(/"/g, '')}`),
    '',
    '## How to help',
    ...l.does.map((d) => `- ${d}`),
    '- Explain what you are about to do before you change anything.',
    '- Ask before any spoiler, purchase or post.',
  ].join('\n');
  return (
    <>
      <p className="fg-prose dim">{intro}</p>
      <pre className="fg-source" aria-label={`${l.name} recipe source`}>
        {src}
      </pre>
    </>
  );
}

function TrustCard({ listing: l }: { listing: ForgeListing }) {
  const later = isLater(l);
  return (
    <>
      <p className="fg-prose dim">A short release record for every listing: what it does, who published it, and what to check before you use it.</p>
      <table className="fg-table">
        <tbody>
          <tr>
            <th scope="row">Overview</th>
            <td>{l.summary}</td>
          </tr>
          <tr>
            <th scope="row">Publisher</th>
            <td>
              {l.pub} · {l.pubKind === 'official' ? 'HP brand, official' : 'Verified legal entity'}
            </td>
          </tr>
          <tr>
            <th scope="row">Version</th>
            <td>{later ? 'Not released' : `${l.ver} · updated ${updatedText(l.upd)}`}</td>
          </tr>
          <tr>
            <th scope="row">Type</th>
            <td>
              {FORGE_TYPES[l.type]}: {FORGE_TYPE_HELP[l.type]}
            </td>
          </tr>
          {l.license && (
            <tr>
              <th scope="row">Licence</th>
              <td>
                {l.license}
                {l.platforms ? ` · ${l.platforms}` : ''}
              </td>
            </tr>
          )}
          <tr>
            <th scope="row">Review before use</th>
            <td>
              <b>Risk:</b> {l.risk}
              <br />
              <b>How it’s handled:</b> {l.mit}
            </td>
          </tr>
          <tr>
            <th scope="row">Side effects</th>
            <td>{l.side}</td>
          </tr>
          <tr>
            <th scope="row">Security review</th>
            <td>
              {later ? (
                <>
                  <Badge variant="status" tone="warn">
                    Pending
                  </Badge>{' '}
                  Reviewed before release
                </>
              ) : (
                <>
                  <Badge variant="status" tone="positive">
                    Passed
                  </Badge>{' '}
                  Declared access matches what the code does
                </>
              )}
            </td>
          </tr>
          <tr>
            <th scope="row">Signed</th>
            <td>{later ? 'At release' : 'Signed by the Forge release key; checked again on your PC before it runs'}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function Versions({ listing: l }: { listing: ForgeListing }) {
  if (isLater(l)) return <p className="fg-empty">Not released yet. Press Notify me and Nova will tell you when it ships.</p>;
  const [a, b, c] = l.ver.split('.').map(Number);
  const rows: [string, number, boolean][] = [
    [l.ver, l.upd, true],
    [`${a}.${b}.${Math.max(0, (c || 0) - 1)}`, l.upd + 19, false],
    [`${a}.${Math.max(0, (b || 0) - 1)}.0`, l.upd + 61, false],
  ];
  return (
    <>
      <table className="fg-table">
        <thead>
          <tr>
            <th scope="col">Version</th>
            <th scope="col">Released</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([v, d, latest]) => (
            <tr key={v}>
              <th scope="row">
                {v} {latest && <Badge variant="new">Latest</Badge>}
              </th>
              <td>{d === 0 ? 'Today' : `${d} days ago`} · security review passed</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="fg-hint" style={{ marginTop: 'var(--gutter-xs)' }}>
        Every update is re-scanned and re-signed before it reaches your PC.
      </p>
    </>
  );
}

function Aside({ listing: l, state }: { listing: ForgeListing; state: ForgeState }) {
  const m = state.mine(l.id);
  const c = counts(l, m);
  const r = ratingStats(l, m.rating);
  const later = isLater(l);
  const [range, setRange] = useState<'all' | '30d' | '7d'>('30d');
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [l.id]);
  const votes = c.up + c.down;
  const upPct = Math.round((c.up / Math.max(1, votes)) * 100);
  const series = downloadSeries(l, range);

  return (
    <aside className="fg-aside" aria-label="Ratings, downloads and access">
      <div className="fg-box">
        <h3 className="fg-section-label">Players say</h3>
        {r && (
          <div className="fg-aside-rate">
            <span className="fg-big">{r.avg.toFixed(1)}</span>
            <span style={{ display: 'grid', gap: 'var(--gutter-xxxs)' }}>
              <Rating value={r.avg} />
              <span className="fg-hint">{r.n.toLocaleString()} verified ratings</span>
            </span>
            <Button size="sm" variant="ghost" style={{ marginLeft: 'auto' }} onClick={() => state.setTab('ratings')}>
              {m.rating ? 'Your rating' : 'Rate'}
            </Button>
          </div>
        )}
        <div className="fg-hint">Works as described?</div>
        <div className="fg-vote" style={{ margin: 'var(--gutter-xxs) 0' }}>
          <Button size="sm" aria-pressed={m.vote === 1} aria-label="Upvote" disabled={!m.added} onClick={() => state.vote(l.id, 1)}>
            <Icon name="chevron-up" size={14} aria-hidden /> {m.vote === 1 ? 'Voted up' : 'Up'}
          </Button>
          <span className="fg-score">{fmtCount(c.up - c.down)}</span>
          <Button size="sm" aria-pressed={m.vote === -1} aria-label="Downvote" disabled={!m.added} onClick={() => state.vote(l.id, -1)}>
            <Icon name="chevron-down" size={14} aria-hidden /> {m.vote === -1 ? 'Voted down' : 'Down'}
          </Button>
        </div>
        {votes ? (
          <Meter label="Say it works as described" value={upPct} display={String(upPct)} />
        ) : (
          <div className="fg-hint">No votes yet.</div>
        )}
        {votes > 0 && (
          <div className="fg-hint" style={{ marginTop: 'var(--gutter-xxs)' }}>
            {fmtCount(c.up)} up · {fmtCount(c.down)} down
          </div>
        )}
        {!m.added && (
          <p className="fg-note">
            <Icon name="lock-on" size={14} aria-hidden />
            <span>{later ? 'Voting opens when it is released and you have added it.' : 'Add it first to rate or vote. Both come only from players with a verified install.'}</span>
          </p>
        )}
        <dl className="fg-kv">
          <dt>Likes</dt>
          <dd>{c.likes.toLocaleString()}</dd>
          <dt>Saves</dt>
          <dd>{c.saves.toLocaleString()}</dd>
          <dt>Downloads</dt>
          <dd>{c.dl.toLocaleString()}</dd>
        </dl>
      </div>

      <div className="fg-box">
        {later ? (
          <>
            <h3 className="fg-section-label">Downloads</h3>
            <div className="fg-hint">Not released yet.</div>
          </>
        ) : (
          <>
            <div className="fg-box-head">
              <h3 className="fg-section-label">Downloads</h3>
              <ToggleButtonGroup
                aria-label="Downloads range"
                value={range}
                onChange={(v) => setRange(v as typeof range)}
                options={[
                  { label: 'All', value: 'all' },
                  { label: '30d', value: '30d' },
                  { label: '7d', value: '7d' },
                ]}
              />
            </div>
            <Sparkline
              label={range === 'all' ? 'All time' : `Last ${range.replace('d', ' days')}`}
              points={series.values.map((v, t) => ({ t, v }))}
              display={series.total.toLocaleString()}
              unit=""
              min={0}
              max={1}
            />
          </>
        )}
      </div>

      <div className="fg-box">
        <h3 className="fg-section-label">What it can touch</h3>
        {l.access.length ? (
          <ul className="fg-access">
            {l.access.map((a) => (
              <li key={a.label}>
                <span className="fg-access-ico">
                  <Icon name={a.icon} size={14} aria-hidden />
                </span>
                <span className="fg-access-text">
                  <span className="fg-access-label">{a.label}</span>
                  {a.note && <span className="fg-access-note">{a.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="fg-hint">Nothing. This is guidance only.</div>
        )}
      </div>

      <div className="fg-box">
        <dl className="fg-kv" style={{ marginTop: 0 }}>
          <dt>Security review</dt>
          <dd>
            {later ? (
              <Badge variant="status" tone="warn">
                Pending
              </Badge>
            ) : (
              <Badge variant="status" tone="positive">
                Passed
              </Badge>
            )}
          </dd>
          <dt>Publisher</dt>
          <dd>{l.pubKind === 'official' ? 'Official' : 'Verified'}</dd>
          <dt>Version</dt>
          <dd>{later ? '–' : l.ver}</dd>
          <dt>Updated</dt>
          <dd>{later ? '–' : l.upd === 0 ? 'Today' : `${l.upd}d ago`}</dd>
          <dt>Type</dt>
          <dd>{FORGE_TYPES[l.type]}</dd>
        </dl>
        {state.forge.reported[l.id] ? (
          <p className="fg-hint" style={{ margin: 'var(--gutter-sm) 0 0' }} role="status">
            Thanks. Your report went to Forge Trust &amp; Safety.
          </p>
        ) : confirming ? (
          <div className="fg-confirm" role="group" aria-label="Report this listing">
            <span>Report this listing to Forge Trust &amp; Safety? Listings with three or more unique reports are hidden while they’re reviewed.</span>
            <div className="fg-composer-row">
              <Button size="sm" variant="accent" onClick={() => state.report(l.id)}>
                Report
              </Button>
              <Button size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" style={{ marginTop: 'var(--gutter-xs)' }} onClick={() => setConfirming(true)}>
            <Icon name="alert" size={14} aria-hidden /> Report
          </Button>
        )}
      </div>
    </aside>
  );
}
