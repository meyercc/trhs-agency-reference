import { useEffect, useRef, useState } from 'react';
import { GameTile, Dropdown, ContextMenu, ContextMenuLabel, ListItem, Separator, Toggle, Slider, ToggleButtonGroup, Checkbox, Chip } from '../components';
import { SectionHeader } from './SectionHeader';
import { GameTileMenu, type OptimizeState, type GamePlatform } from './GameTileMenu';
import { INSTALLED, type Game } from '../data/games';

// ── "My Games" library ──────────────────────────────────────────────────────
// GameTile grid (no labels by default) with a sort dropdown + a view-options
// popover (ContextMenu) for sort / display controls. Filters + saved views are
// deferred — see the handoff.

const SORTS = [
  { value: 'recent', label: 'Recently Played' },
  { value: 'alpha', label: 'A–Z' },
  { value: 'hours', label: 'Most Played' },
  { value: 'added', label: 'Recently Added' },
];

// Stable per-game number so Most Played / Recently Added produce distinct,
// repeatable orders without play-hours/added-date data in the catalog yet.
function hashNum(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
// ── Filters: facets derive their options + matching from the catalog ──
type Facet = 'genre' | 'mode' | 'publisher' | 'developer';
const FACETS: { key: Facet; label: string; values: (g: Game) => string[] }[] = [
  { key: 'genre', label: 'Genre', values: (g) => [g.genre] },
  { key: 'mode', label: 'Mode', values: (g) => g.modes ?? [] },
  { key: 'publisher', label: 'Publisher', values: (g) => (g.publisher ? [g.publisher] : []) },
  { key: 'developer', label: 'Developer', values: (g) => [g.studio] },
];
// Unique, sorted options per facet, drawn from the library itself.
const FACET_OPTIONS = Object.fromEntries(
  FACETS.map((f) => [f.key, [...new Set(INSTALLED.flatMap(f.values))].sort()]),
) as Record<Facet, string[]>;
type Filters = Record<Facet, string[]>;
const EMPTY_FILTERS: Filters = { genre: [], mode: [], publisher: [], developer: [] };

// A game passes if, for every facet that has selections, one of its values is
// selected (within-facet OR, across-facets AND).
function passesFilters(g: Game, filters: Filters): boolean {
  return FACETS.every((f) => {
    const sel = filters[f.key];
    return sel.length === 0 || f.values(g).some((v) => sel.includes(v));
  });
}

// ── Library views (chips): built-in quick views + saved custom views ──
const QUICK_VIEWS: { id: string; name: string; test: (g: Game) => boolean }[] = [
  { id: 'all', name: 'All', test: () => true },
  { id: 'favorites', name: 'Favorites', test: (g) => !!g.favorite },
  { id: 'omenai', name: 'OMEN AI', test: (g) => !!g.omenAi },
];

interface SavedView {
  id: string;
  name: string;
  quick: string;
  sort: string;
  filters: Filters;
  labels: boolean;
  tileSize: number;
  perPage: string;
}
/** Current library state snapshot — what a saved view captures / restores. */
type ViewSnapshot = Omit<SavedView, 'id' | 'name'>;

const VIEWS_KEY = 'trhs-lib-views';
function loadViews(): SavedView[] {
  try {
    const v = JSON.parse(localStorage.getItem(VIEWS_KEY) || 'null');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function saveViews(v: SavedView[]) {
  try {
    localStorage.setItem(VIEWS_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
const facetKey = (a: string[]) => [...a].sort().join('|');
function filtersEqual(a: Filters, b: Filters): boolean {
  return (Object.keys(EMPTY_FILTERS) as Facet[]).every((k) => facetKey(a[k]) === facetKey(b[k]));
}
// Does a saved view exactly match the current state? (drives chip highlighting,
// so chips light up only while you're actually viewing them — no extra state.)
function viewMatches(v: SavedView, s: ViewSnapshot): boolean {
  return v.quick === s.quick && v.sort === s.sort && v.labels === s.labels && v.tileSize === s.tileSize && v.perPage === s.perPage && filtersEqual(v.filters, s.filters);
}

function sortGames(games: Game[], sort: string): Game[] {
  const g = [...games];
  switch (sort) {
    case 'alpha':
      return g.sort((a, b) => a.title.localeCompare(b.title));
    case 'hours':
      return g.sort((a, b) => hashNum(b.id + 'h') - hashNum(a.id + 'h'));
    case 'added':
      return g.sort((a, b) => hashNum(b.id + 'a') - hashNum(a.id + 'a'));
    default:
      return g; // 'recent' — catalog order
  }
}

const Check = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2,5.5 4,7.5 8,3" />
  </svg>
);
const GridGlyph = ({ big }: { big?: boolean }) => (
  <svg width={big ? 14 : 10} height={big ? 14 : 10} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
    <rect x="1" y="1" width="4.2" height="4.2" rx="0.8" />
    <rect x="6.8" y="1" width="4.2" height="4.2" rx="0.8" />
    <rect x="1" y="6.8" width="4.2" height="4.2" rx="0.8" />
    <rect x="6.8" y="6.8" width="4.2" height="4.2" rx="0.8" />
  </svg>
);

const Chevron = ({ open }: { open: boolean }) => (
  <svg className={'lib-filter-chevron' + (open ? ' open' : '')} width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <polyline points="3,4 5,6 7,4" />
  </svg>
);

// One collapsible filter facet (header + checkbox body).
function FilterGroup({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lib-filter-group">
      <ListItem
        className="lib-filter-header"
        label={
          <>
            {label}
            {selected.length > 0 && <span className="lib-filter-badge">{selected.length}</span>}
          </>
        }
        trailing={<Chevron open={open} />}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="lib-filter-body">
          {options.map((o) => (
            <Checkbox key={o} label={o} checked={selected.includes(o)} onChange={() => onToggle(o)} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ViewState {
  sort: string;
  setSort: (v: string) => void;
  filters: Filters;
  onToggleFilter: (facet: Facet, value: string) => void;
  labels: boolean;
  setLabels: (v: boolean) => void;
  tileSize: number;
  setTileSize: (v: number) => void;
  perPage: string;
  setPerPage: (v: string) => void;
  onSaveView: () => void;
}

function LibOptions(v: ViewState) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="lib-options-wrap" ref={wrap}>
      <button className={'lib-options-btn' + (open ? ' active' : '')} type="button" aria-label="View options" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
          <line x1="1" y1="4" x2="13" y2="4" />
          <line x1="1" y1="10" x2="13" y2="10" />
          <circle cx="4.5" cy="4" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="9.5" cy="10" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open && (
        <ContextMenu className="lib-options-menu">
          <ContextMenuLabel>Sort</ContextMenuLabel>
          {SORTS.map((s) => (
            <ListItem key={s.value} label={s.label} selected={v.sort === s.value} trailing={v.sort === s.value ? <Check /> : undefined} onClick={() => v.setSort(s.value)} />
          ))}

          <Separator />
          <ContextMenuLabel>Filters</ContextMenuLabel>
          {FACETS.map((f) => (
            <FilterGroup key={f.key} label={f.label} options={FACET_OPTIONS[f.key]} selected={v.filters[f.key]} onToggle={(val) => v.onToggleFilter(f.key, val)} />
          ))}

          <Separator />
          <ContextMenuLabel>Display</ContextMenuLabel>
          <div className="lib-zoom-row">
            <span className="lib-zoom-icon">
              <GridGlyph />
            </span>
            <Slider min={88} max={220} step={4} value={v.tileSize} onChange={v.setTileSize} aria-label="Tile size" />
            <span className="lib-zoom-icon">
              <GridGlyph big />
            </span>
          </div>
          <ListItem label="Game labels" trailing={<Toggle checked={v.labels} onChange={v.setLabels} aria-label="Game labels" />} onClick={() => v.setLabels(!v.labels)} />
          <div className="lib-perpage-row">
            <span className="ds-text-label">Per page</span>
            <ToggleButtonGroup
              aria-label="Per page"
              value={v.perPage}
              onChange={v.setPerPage}
              options={[
                { label: '50', value: '50' },
                { label: '100', value: '100' },
                { label: 'All', value: 'all' },
              ]}
            />
          </div>

          <Separator />
          <ListItem
            className="lib-save-row"
            label="Save current view…"
            trailing={
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="5" y1="2" x2="5" y2="8" />
                <line x1="2" y1="5" x2="8" y2="5" />
              </svg>
            }
            onClick={v.onSaveView}
          />
        </ContextMenu>
      )}
    </div>
  );
}

export function PlayLibrary() {
  const [sort, setSort] = useState('recent');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [labels, setLabels] = useState(false); // no labels by default
  const [tileSize, setTileSize] = useState(140);
  const [perPage, setPerPage] = useState('all');
  const [quick, setQuick] = useState('all'); // built-in view (All/Favorites/OMEN AI)
  const [views, setViews] = useState<SavedView[]>(loadViews);
  useEffect(() => saveViews(views), [views]);

  // Per-tile ••• menu state (presentational — resets on reload).
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(INSTALLED.filter((g) => g.favorite).map((g) => g.id)));
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [optimize, setOptimize] = useState<Record<string, OptimizeState>>({});
  const [platform, setPlatform] = useState<Record<string, GamePlatform>>({});
  const [menu, setMenu] = useState<{ game: Game; anchor: DOMRect } | null>(null);
  const optOf = (g: Game): OptimizeState => optimize[g.id] ?? { booster: true, omenAi: g.omenAi ?? true };
  const platOf = (g: Game): GamePlatform => platform[g.id] ?? 'steam';
  const toggleFavorite = (id: string) =>
    setFavorites((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const onToggleFilter = (facet: Facet, value: string) =>
    setFilters((f) => ({ ...f, [facet]: f[facet].includes(value) ? f[facet].filter((v) => v !== value) : [...f[facet], value] }));

  // The Favorites quick view reads the live favorites set (so ••• → toggle updates it).
  const quickTest = (g: Game): boolean =>
    quick === 'favorites' ? favorites.has(g.id) : (QUICK_VIEWS.find((q) => q.id === quick)?.test(g) ?? true);
  const filtered = INSTALLED.filter((g) => !removed.has(g.id) && quickTest(g) && passesFilters(g, filters));
  const sorted = sortGames(filtered, sort);
  const limit = perPage === 'all' ? sorted.length : Number(perPage);
  const games = sorted.slice(0, limit);

  // The active custom view is *derived* by matching the current state.
  const snapshot: ViewSnapshot = { quick, sort, filters, labels, tileSize, perPage };
  const activeCustom = views.find((v) => viewMatches(v, snapshot));

  const applyQuick = (id: string) => {
    setQuick(id);
    setFilters(EMPTY_FILTERS);
  };
  const applyView = (v: SavedView) => {
    setQuick(v.quick);
    setFilters(v.filters);
    setSort(v.sort);
    setLabels(v.labels);
    setTileSize(v.tileSize);
    setPerPage(v.perPage);
  };
  const onSaveView = () => {
    const name = window.prompt('Name this view');
    if (!name?.trim()) return;
    setViews((list) => [...list, { id: `view-${Date.now().toString(36)}`, name: name.trim(), ...snapshot }]);
  };
  const removeView = (id: string) => setViews((list) => list.filter((v) => v.id !== id));

  return (
    <section className="play-library" id="my-games">
      <SectionHeader label="My Games" count={`${filtered.length} games`} />
      <div className="lib-controls">
        <div className="lib-chips">
          {QUICK_VIEWS.map((q) => (
            <Chip key={q.id} selected={!activeCustom && quick === q.id} onClick={() => applyQuick(q.id)}>
              {q.name}
            </Chip>
          ))}
          {views.map((v) => (
            <Chip
              key={v.id}
              selected={activeCustom?.id === v.id}
              onClick={() => applyView(v)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (window.confirm(`Remove saved view "${v.name}"?`)) removeView(v.id);
              }}
              title={`${v.name} — right-click to remove`}
            >
              {v.name}
            </Chip>
          ))}
        </div>
        <div className="lib-controls-right">
          <Dropdown aria-label="Sort library" options={SORTS} value={sort} onChange={setSort} />
          <LibOptions
            sort={sort}
            setSort={setSort}
            filters={filters}
            onToggleFilter={onToggleFilter}
            labels={labels}
            setLabels={setLabels}
            tileSize={tileSize}
            setTileSize={setTileSize}
            perPage={perPage}
            setPerPage={setPerPage}
            onSaveView={onSaveView}
          />
        </div>
      </div>

      <div className="library-grid" style={{ ['--lib-tile' as string]: `${tileSize}px` }}>
        {games.map((g) => (
          <GameTile
            key={g.id}
            cover={g.art}
            name={labels ? g.title : undefined}
            aria-label={g.title}
            glow
            onMenu={(e) => setMenu({ game: g, anchor: e.currentTarget.getBoundingClientRect() })}
            menuOpen={menu?.game.id === g.id}
          />
        ))}
      </div>

      {menu && (
        <GameTileMenu
          game={menu.game}
          anchor={menu.anchor}
          favorite={favorites.has(menu.game.id)}
          optimize={optOf(menu.game)}
          platform={platOf(menu.game)}
          onClose={() => setMenu(null)}
          onToggleFavorite={() => toggleFavorite(menu.game.id)}
          onRemove={() => setRemoved((s) => new Set(s).add(menu.game.id))}
          onSetOptimize={(key, value) =>
            setOptimize((m) => ({ ...m, [menu.game.id]: { ...optOf(menu.game), [key]: value } }))
          }
          onSetPlatform={(value) => setPlatform((m) => ({ ...m, [menu.game.id]: value }))}
        />
      )}
    </section>
  );
}
