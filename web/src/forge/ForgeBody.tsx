import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Badge, Button, Chip, Icon, Input, StatTile, ToggleButtonGroup } from '../components';
import { useAgents } from '../state/Agents';
import {
  FORGE_BY_ID,
  FORGE_CATEGORIES,
  FORGE_FEATURED_ID,
  FORGE_LISTINGS,
  FORGE_TYPES,
  FORGE_TYPE_HELP,
  forgeCategoryLabel,
  isLater,
  score,
  trend,
  weightedRating,
  type ForgeMine,
} from './listings';
import type { ForgeCategory, ForgeListing, ForgeType } from './types';
import { ForgeCard, type ForgeUsage } from './ForgeCard';
import { ForgeDetail } from './ForgeDetail';
import { ForgeHero } from './ForgeHero';
import { ForgeSubmit } from './ForgeSubmit';
import './forge.css';

export type ForgeSection = 'discover' | 'yours' | ForgeCategory;
export type ForgeSort = 'featured' | 'trending' | 'rated' | 'top' | 'new';
export type ForgeDetailTab = 'overview' | 'ratings' | 'recipe' | 'card' | 'versions';

// The Agent Catalog's `?cat=` values, so its old deep links land somewhere sane.
const LEGACY_SECTION: Record<string, ForgeSection> = {
  performance: 'tune',
  personalization: 'gear',
  play: 'find',
  shop: 'deals',
  support: 'tune',
};
const isSection = (s: string): s is ForgeSection => s === 'discover' || s === 'yours' || FORGE_CATEGORIES.some((c) => c.id === s);

/** How long "Adding…" holds — long enough to read as a real install step. */
const ADD_MS = 900;

/**
 * Forge's state and its two halves — the category nav and the store pane —
 * with no frame of their own. ForgeModal puts them in a ModalShell; Nova's
 * Agents view puts them inline under its dashboard. Same DOM, same classes.
 */
export function useForge({ initialSection = 'discover', initialListingId }: { initialSection?: string; initialListingId?: string } = {}) {
  const agents = useAgents();
  const start = LEGACY_SECTION[initialSection] ?? (isSection(initialSection) ? initialSection : 'discover');
  const [section, setSection] = useState<ForgeSection>(start);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ForgeSort>('featured');
  const [type, setType] = useState<'all' | ForgeType>('all');
  const [selectedId, setSelectedId] = useState<string | null>(initialListingId && FORGE_BY_ID[initialListingId] ? initialListingId : null);
  const [tab, setTab] = useState<ForgeDetailTab>('overview');
  const [submitting, setSubmitting] = useState(false);
  const [installing, setInstalling] = useState<Record<string, true>>({});
  const timers = useRef<number[]>([]);
  // The pane scrolls on its own; opening a listing or a section starts at its top.
  const scroller = useRef<HTMLDivElement>(null);
  const toTop = () => scroller.current?.scrollTo({ top: 0 });

  // Honor a changed `?agent=` / `?listing=` deep link while already mounted.
  useEffect(() => {
    if (initialListingId && FORGE_BY_ID[initialListingId]) setSelectedId(initialListingId);
  }, [initialListingId]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const mine = (id: string): ForgeMine => ({
    added: agents.has(id),
    saved: !!agents.forge.saved[id],
    liked: !!agents.forge.liked[id],
    vote: agents.forge.vote[id] ?? 0,
    rating: agents.forge.rating[id]?.stars,
  });

  const open = (id: string, t: ForgeDetailTab = 'overview') => {
    setSelectedId(id);
    setTab(t);
    setSubmitting(false);
    toTop();
  };
  const goSection = (s: ForgeSection) => {
    setSection(s);
    setQuery('');
    setSelectedId(null);
    setSubmitting(false);
    toTop();
  };
  const onSearch = (v: string) => {
    setQuery(v);
    if (v.trim()) {
      setSelectedId(null);
      setSubmitting(false);
    }
  };
  const add = (l: ForgeListing) => {
    if (installing[l.id] || agents.has(l.id)) return;
    setInstalling((m) => ({ ...m, [l.id]: true }));
    timers.current.push(
      window.setTimeout(() => {
        agents.add(l.id, l.ver);
        setInstalling(({ [l.id]: _, ...rest }) => rest);
      }, ADD_MS),
    );
  };

  return {
    ...agents,
    section,
    goSection,
    query,
    onSearch,
    sort,
    setSort,
    type,
    setType,
    selected: selectedId ? FORGE_BY_ID[selectedId] : null,
    open,
    close: () => {
      setSelectedId(null);
      toTop();
    },
    tab,
    setTab,
    submitting,
    setSubmitting: (v: boolean) => {
      setSubmitting(v);
      if (v) setSelectedId(null);
      toTop();
    },
    installing: (id: string) => !!installing[id],
    addListing: add,
    mine,
    scroller,
  };
}

export type ForgeState = ReturnType<typeof useForge>;

export function ForgeNav({ state }: { state: ForgeState }) {
  const { addedCount, forge, section, goSection, query, selected, submitting } = state;
  const browsing = !query.trim() && !selected && !submitting;
  const active = (s: ForgeSection) => (browsing && section === s ? ' active' : '');
  const yoursCount = addedCount + Object.keys(forge.saved).filter((id) => !state.has(id)).length;
  const item = (id: ForgeSection, label: string, icon: Parameters<typeof Icon>[0]['name'], count?: number) => (
    <button
      key={id}
      type="button"
      className={'ds-modal-nav-item' + active(id)}
      aria-current={active(id) ? 'page' : undefined}
      onClick={() => goSection(id)}
    >
      <Icon name={icon} size={15} aria-hidden />
      <span>{label}</span>
      {count !== undefined && <span className="ds-modal-nav-count">{count}</span>}
    </button>
  );
  return (
    <nav className="ds-modal-nav" aria-label="Forge categories">
      {item('discover', 'Discover', 'sparks')}
      {item('yours', 'Yours', 'check', yoursCount)}
      <div className="ds-modal-nav-label">Browse</div>
      {FORGE_CATEGORIES.map((c) =>
        item(
          c.id,
          c.label,
          c.icon,
          FORGE_LISTINGS.filter((l) => l.cat === c.id).length,
        ),
      )}
      <div className="ds-modal-nav-foot">
        {addedCount} added · {FORGE_LISTINGS.length} listings
      </div>
    </nav>
  );
}

const SORTS: { label: string; value: ForgeSort }[] = [
  { label: 'Featured', value: 'featured' },
  { label: 'Trending', value: 'trending' },
  { label: 'Top rated', value: 'rated' },
  { label: 'Top voted', value: 'top' },
  { label: 'New', value: 'new' },
];

export function ForgeContent({
  state,
  usageOf,
  children,
}: {
  state: ForgeState;
  /** Per-listing usage for the card's extra line — Nova's Agents view passes the ledger. */
  usageOf?: (l: ForgeListing) => ForgeUsage | undefined;
  /** Rendered above the store — the Agents view's dashboard. */
  children?: ReactNode;
}) {
  const { section, query, onSearch, sort, setSort, type, setType, selected, submitting, setSubmitting, mine, forge, has } = state;
  const q = query.trim().toLowerCase();

  const sortList = (L: ForgeListing[]) => {
    const by = (f: (l: ForgeListing) => number) => (a: ForgeListing, b: ForgeListing) => Number(isLater(a)) - Number(isLater(b)) || f(b) - f(a);
    const m = (l: ForgeListing) => mine(l.id);
    if (sort === 'trending') return L.sort((a, b) => trend(b, m(b)) - trend(a, m(a)));
    if (sort === 'new') return L.sort((a, b) => Number(isLater(a)) - Number(isLater(b)) || Number(b.isNew) - Number(a.isNew) || a.upd - b.upd);
    if (sort === 'top') return L.sort(by((l) => score(l, m(l))));
    if (sort === 'rated') return L.sort(by((l) => weightedRating(l, m(l).rating)));
    return L.sort(by((l) => (l.featured ? 1e9 : 0) + trend(l, m(l))));
  };
  const filtered = useMemo(() => {
    let L = FORGE_LISTINGS.slice();
    if (section !== 'discover' && section !== 'yours' && !q) L = L.filter((l) => l.cat === section);
    if (type !== 'all') L = L.filter((l) => l.type === type);
    if (q) L = L.filter((l) => `${l.name} ${l.pub} ${l.summary} ${l.games.join(' ')} ${FORGE_TYPES[l.type]} ${forgeCategoryLabel(l.cat)}`.toLowerCase().includes(q));
    return L;
  }, [section, type, q]);

  const grid = (items: ForgeListing[]) => (
    <div className="fg-grid">
      {items.map((l) => (
        <ForgeCard key={l.id} listing={l} state={state} usage={usageOf?.(l)} />
      ))}
    </div>
  );
  const group = (title: string, items: ForgeListing[], count = items.length) =>
    items.length > 0 && (
      <>
        <h3 className="fg-group-title">
          {title} <span>{count}</span>
        </h3>
        {grid(items)}
      </>
    );
  const trendSort = (L: ForgeListing[]) => L.sort((a, b) => trend(b, mine(b.id)) - trend(a, mine(a.id)));

  let body: ReactNode;
  if (submitting) {
    body = <ForgeSubmit onBack={() => setSubmitting(false)} />;
  } else if (selected && !q) {
    body = <ForgeDetail listing={selected} state={state} />;
  } else if (section === 'yours' && !q) {
    const added = FORGE_LISTINGS.filter((l) => has(l.id));
    const saved = FORGE_LISTINGS.filter((l) => forge.saved[l.id] && !has(l.id));
    const notify = FORGE_LISTINGS.filter((l) => forge.notify[l.id]);
    body = (
      <>
        <div className="fg-stats-tiles">
          <StatTile label="Added from Forge" value={added.length} icon="ai" tone="neutral" />
          <StatTile label="Agents" value={added.filter((l) => l.agentId).length} icon="twinkle" tone="neutral" delta="Pick them in Nova’s composer" />
          <StatTile label="Saved for later" value={Object.keys(forge.saved).length} icon="bookmark" tone="neutral" />
          <StatTile label="Waiting on release" value={notify.length} icon="notification" tone="neutral" />
        </div>
        <h3 className="fg-group-title">
          Added <span>{added.length}</span>
        </h3>
        {added.length ? grid(added) : <p className="fg-empty">Nothing added yet. Press Add on any listing.</p>}
        <h3 className="fg-group-title">
          Saved <span>{saved.length}</span>
        </h3>
        {saved.length ? grid(saved) : <p className="fg-empty">Press the bookmark on a listing to save it for later.</p>}
        {group('Notify me when available', notify)}
        <p className="fg-note">
          <Icon name="info" size={14} aria-hidden />
          <span>You can rate and vote on anything you have added; each rating is tied to the install receipt Forge gave this PC. Likes and saves work on any listing.</span>
        </p>
      </>
    );
  } else {
    const landing = section === 'discover' && !q && type === 'all' && sort === 'featured';
    const toolbar = (
      <div className="fg-toolbar">
        <ToggleButtonGroup aria-label="Sort" value={sort} onChange={(v) => setSort(v as ForgeSort)} options={SORTS} />
        <div className="fg-chips" role="group" aria-label="Type">
          {(['all', 'app', 'skill', 'recipe', 'assistant'] as const).map((t) => (
            <Chip key={t} selected={type === t} title={t === 'all' ? undefined : FORGE_TYPE_HELP[t]} onClick={() => setType(t)}>
              {t === 'all' ? 'All types' : FORGE_TYPES[t]}
            </Chip>
          ))}
        </div>
      </div>
    );
    if (landing) {
      const L = FORGE_LISTINGS;
      body = (
        <>
          <p className="fg-intro">
            Apps, skills, recipes and assistants for your games. Every listing comes from a verified studio or creator and passes a security review.
          </p>
          <ForgeHero listing={FORGE_BY_ID[FORGE_FEATURED_ID]} state={state} />
          {toolbar}
          {group('From HyperX & OMEN', trendSort(L.filter((l) => l.pubKind === 'official' && l.featured && !isLater(l))))}
          {group('Agents for Nova', trendSort(L.filter((l) => l.agentId)))}
          {group('Partner apps', trendSort(L.filter((l) => l.src === 'partner')))}
          {group('Recipes ready at launch', trendSort(L.filter((l) => l.tier === 'launch')).slice(0, 6), L.filter((l) => l.tier === 'launch').length)}
          {group('Trending from the community', trendSort(L.filter((l) => l.pubKind !== 'official' && l.src !== 'partner')).slice(0, 6))}
          {group('Coming later', L.filter(isLater).slice(0, 6), L.filter(isLater).length)}
        </>
      );
    } else {
      const L = sortList(filtered.slice());
      const title = q ? `Results for “${query.trim()}”` : section === 'discover' ? 'All listings' : section === 'yours' ? 'Yours' : forgeCategoryLabel(section);
      body = (
        <>
          {toolbar}
          <h3 className="fg-group-title">
            {title} <span>{L.length}</span>
          </h3>
          {L.length ? grid(L) : <p className="fg-empty">No listings match. Try another word, or clear the type filter.</p>}
          {sort === 'rated' && (
            <p className="fg-note">
              <Icon name="info" size={14} aria-hidden />
              <span>Top rated weighs each listing’s average by how many verified installs rated it, so a handful of 5-star ratings can’t beat thousands of 4.7s.</span>
            </p>
          )}
          {sort === 'trending' && (
            <p className="fg-note">
              <Icon name="info" size={14} aria-hidden />
              <span>Trending ranks by the last 30 days of downloads, saves, likes and votes. Lifetime totals don’t count.</span>
            </p>
          )}
        </>
      );
    }
  }

  return (
    <>
      {children}
      <div className="fg-bar">
        <Input variant="search" placeholder="Search Forge…" value={query} onChange={(e) => onSearch(e.target.value)} aria-label="Search Forge" />
        <Button onClick={() => setSubmitting(true)} aria-pressed={submitting}>
          <Icon name="upload" size={14} aria-hidden /> Submit to Forge
        </Button>
      </div>
      <div className="fg-content" ref={state.scroller}>
        {body}
        <p className="fg-foot">
          <Badge>Prototype</Badge> Counts, ratings, sample reviews and community publishers are illustrative. Partner apps are real products shown to illustrate what Forge
          could carry; they are not announced partnerships. Your adds, likes, saves and votes stay in this browser.
        </p>
      </div>
    </>
  );
}
