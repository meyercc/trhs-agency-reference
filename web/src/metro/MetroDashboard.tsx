import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, Reorder, useDragControls, useMotionValue, useMotionValueEvent, useTransform, animate } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, Icon, DealTile, type MenuItem, type IconName } from '../components';
import { GAMES } from '../data/games';
import { DeviceCard, deviceCardModel } from '../widgets/DeviceCard';
import { DeviceModalHost } from '../devices/DeviceModalHost';
import dealGamepass from '../../../Assets/deal/xboxgamepass-deal.webp';
import dealSonic from '../../../Assets/deal/egs-sonic-franchise-sale-breaker-1920x1080-d7f60634dcb6.jpg';
import dealFeatured from '../../../Assets/deal/749a4d54-32b4-422a-9b36-6fbdf7420358.jpeg';
import './metro.css';

// ── Collections derived from the real game catalog ──
type TileData = { art: string; name: string };
const toTile = (g: (typeof GAMES)[number]): TileData => ({ art: g.art, name: g.title });

const RECENT = GAMES.filter((g) => g.installed).slice(0, 4).map(toTile);
const LIBRARY = GAMES.map(toTile); // 16 → dense 4×4
const INSTALLED = GAMES.filter((g) => g.installed).map(toTile);
const WISHLIST = GAMES.filter((g) => (g.price ?? 0) > 0).slice(0, 4).map(toTile);
const HERO = GAMES[0];

// ── Store deals — wide DealTile promos (Shop section) ──
type DealData = {
  image: string;
  title: string;
  platform?: IconName;
  discount?: string;
  price?: string;
  description?: string;
  cta?: string;
};
const DEALS: DealData[] = [
  { image: dealGamepass, title: 'PC Game Pass', platform: 'platform-xbox', discount: '-100%', price: 'Free', description: 'Claim your free month of PC Game Pass today!', cta: 'Claim Here' },
  { image: dealSonic, title: 'Sonic Franchise Sale', platform: 'platform-epic', discount: '-75%', price: '$4.99', description: 'The Sonic franchise sale is on now — up to 75% off.', cta: 'View Deal' },
  { image: dealFeatured, title: 'Featured Deal', platform: 'platform-steam', discount: '-50%', price: '$29.99', description: 'A featured deal, this week only.', cta: 'View Deal' },
];

// Sizing model — every widget has a {cols, rows} footprint set via the resize
// menu (Columns = width, Rows = density). Glance: grid-cell span on both axes.
// Collection: cols = tile-columns shown, rows = tile density (tileRows).
// Feature: cols = width preset, rows n/a (the panorama is window-height).
//
// Each widget's allowed footprint comes from a SizeSpec (see SIZE_SPECS). A
// widget may carry its own `sizeSpec` to override its type default — that's how
// a future widget declares a custom range (e.g. a 1–9 collection) or a fixed
// size (min === max on both axes → no resize control). Section rows are authored
// per-section (rows = how many 1fr rows divide the window-height section).
type Axis = { min: number; max: number };
type SizeSpec = { cols: Axis; rows: Axis | null }; // rows: null = no vertical axis
type GlanceWidget = { type: 'glance'; id: string; kind: string; label: string; value: string; spark?: boolean; cols?: number; rows?: number; sizeSpec?: SizeSpec };
// A device card sharing the main app's <DeviceCard>; lives in a packed section
// like glance, spanning a footprint (default 2×2). Keyed by id for reorder.
type DeviceMetroWidget = { type: 'device'; id: string; kind: string; skuId: string; cols?: number; rows?: number; sizeSpec?: SizeSpec };
type CollectionWidget = { type: 'collection'; items: TileData[]; tileRows: number; cols?: number; sizeSpec?: SizeSpec };
type FeatureWidget = { type: 'feature'; art: string; eyebrow?: string; title: string; sub?: string; cols?: number; sizeSpec?: SizeSpec };
// A vertical stack of wide DealTiles (Shop). Fills the section like
// collection/feature (not packed). `cols` = a tile-width preset (1–3), the only
// resize axis — a deal tile reads poorly when very small and wastes space when
// very large, so the range is deliberately tight.
type DealsWidget = { type: 'deals'; items: DealData[]; cols?: number; sizeSpec?: SizeSpec };
type Widget = GlanceWidget | DeviceMetroWidget | CollectionWidget | FeatureWidget | DealsWidget;
// "Cell" widgets pack into a section's grid (glance + device); the others fill
// the whole section (collection/feature).
type CellWidget = GlanceWidget | DeviceMetroWidget;
type SectionData = { id: string; kind: string; title?: string; count?: string; rows?: number; widgets: Widget[] };
const isCellWidget = (w: Widget): w is CellWidget => w.type === 'glance' || w.type === 'device';

// Per-type default size ranges. A widget's `sizeSpec` overrides these. To add a
// new widget with custom sizing, set its sizeSpec in the catalog factory.
const SIZE_SPECS: Record<Widget['type'], SizeSpec> = {
  glance: { cols: { min: 1, max: 3 }, rows: { min: 1, max: 4 } },
  device: { cols: { min: 1, max: 3 }, rows: { min: 1, max: 3 } }, // 1×1 … 3×3 (default 2×2)
  collection: { cols: { min: 1, max: 4 }, rows: { min: 1, max: 4 } },
  feature: { cols: { min: 1, max: 3 }, rows: null }, // width-only
  deals: { cols: { min: 1, max: 3 }, rows: null }, // width preset only (tight range)
};
const SECTION_ROWS_MAX = 5; // how many 1fr rows a packed section may be divided into
const specOf = (w: Widget): SizeSpec => w.sizeSpec ?? SIZE_SPECS[w.type];
const axisOptions = (a: Axis | null): number[] => (a ? Array.from({ length: a.max - a.min + 1 }, (_, i) => a.min + i) : []);
// A widget is resizable only if some axis offers more than one option.
const isResizable = (w: Widget): boolean => {
  const s = specOf(w);
  return axisOptions(s.cols).length > 1 || axisOptions(s.rows).length > 1;
};

let _uid = 0;
const newId = (kind: string) => `${kind}-${Date.now().toString(36)}-${_uid++}`;

// Individual glance-widget templates — the source for the in-section "add widget"
// gallery and what new widgets are built from. (Existing widgets persist as full
// data, so user-edited values/spans survive reloads.)
// Glance-widget templates — entries may carry their own cols/rows defaults and a
// `sizeSpec` (e.g. `nowplaying` ships fixed at 2×2: min===max on both axes, so it
// has no resize control). instWidget falls back base → spec.min for size.
const WIDGET_CATALOG: Record<string, () => Omit<GlanceWidget, 'id' | 'kind'>> = {
  cpu: () => ({ type: 'glance', label: 'CPU', value: '42°C', spark: true }),
  gpu: () => ({ type: 'glance', label: 'GPU', value: '61°C', spark: true }),
  fps: () => ({ type: 'glance', label: 'FPS', value: '144' }),
  ram: () => ({ type: 'glance', label: 'RAM', value: '18.4 GB' }),
  net: () => ({ type: 'glance', label: 'Network', value: '2.1 Mbps' }),
  battery: () => ({ type: 'glance', label: 'Battery', value: '88%' }),
  downloads: () => ({ type: 'glance', label: 'Downloads', value: '2' }),
  online: () => ({ type: 'glance', label: 'Friends Online', value: '7' }),
  clock: () => ({ type: 'glance', label: 'Clock', value: '9:41' }),
  // A fixed-size widget — declares its own 2×2 spec, so the resize menu never
  // appears for it (proves the SizeSpec extensibility end-to-end).
  nowplaying: () => ({ type: 'glance', label: 'Now Playing', value: 'Phantom Liberty — P.T. Adamczyk', sizeSpec: { cols: { min: 2, max: 2 }, rows: { min: 2, max: 2 } } }),
};
const WIDGET_GALLERY = [
  { kind: 'cpu', name: 'CPU' },
  { kind: 'gpu', name: 'GPU' },
  { kind: 'fps', name: 'FPS' },
  { kind: 'ram', name: 'RAM' },
  { kind: 'net', name: 'Network' },
  { kind: 'battery', name: 'Battery' },
  { kind: 'downloads', name: 'Downloads' },
  { kind: 'online', name: 'Friends Online' },
  { kind: 'clock', name: 'Clock' },
  { kind: 'nowplaying', name: 'Now Playing' },
  { kind: 'dev-saga', name: 'Pulsefire Saga Pro' },
  { kind: 'dev-oled', name: 'OMEN OLED 27' },
  { kind: 'dev-cloud', name: 'Cloud III' },
];
function instWidget(kind: string, id?: string | null, cols?: number, rows?: number): GlanceWidget | null {
  const make = WIDGET_CATALOG[kind];
  if (!make) return null;
  const base = make();
  const spec = base.sizeSpec ?? SIZE_SPECS.glance;
  return {
    ...base,
    id: id || newId(kind),
    kind,
    cols: cols ?? base.cols ?? spec.cols.min,
    rows: rows ?? base.rows ?? spec.rows?.min ?? 1,
  };
}

// Device cards (the shared <DeviceCard>) addable into any packed section.
const DEVICE_SKUS: Record<string, string> = {
  'dev-saga': 'saga-pro',
  'dev-oled': 'pulse-27',
  'dev-cloud': 'cloud-iii',
};
function instDevice(kind: string, id?: string | null, cols?: number, rows?: number): DeviceMetroWidget | null {
  const skuId = DEVICE_SKUS[kind];
  if (!skuId) return null;
  // Default 2×2 regardless of the spec min (the menu now offers 1 too).
  return { type: 'device', kind, skuId, id: id || newId(kind), cols: cols ?? 2, rows: rows ?? 2 };
}
// Instantiate any packed-section ("cell") widget by kind — glance or device.
function instCell(kind: string, id?: string | null, cols?: number, rows?: number): CellWidget | null {
  return WIDGET_CATALOG[kind] ? instWidget(kind, id, cols, rows) : instDevice(kind, id, cols, rows);
}

const SYSTEM_WIDGETS: GlanceWidget[] = [
  instWidget('cpu', 'sys-cpu', 1, 3),
  instWidget('fps', 'sys-fps'),
  instWidget('online', 'sys-online'),
  instWidget('downloads', 'sys-dl'),
  instWidget('gpu', 'sys-gpu', 1, 2),
  instWidget('battery', 'sys-bat'),
].filter(Boolean) as GlanceWidget[];
const FRIENDS_WIDGETS: GlanceWidget[] = [
  { type: 'glance', id: 'fr-nova', kind: 'friend', label: 'Nova', value: 'In Elden Ring' },
  { type: 'glance', id: 'fr-riff', kind: 'friend', label: 'Riff', value: 'Online' },
  { type: 'glance', id: 'fr-kestrel', kind: 'friend', label: 'Kestrel', value: 'In CS2' },
  { type: 'glance', id: 'fr-juno', kind: 'friend', label: 'Juno', value: 'Away' },
  { type: 'glance', id: 'fr-pax', kind: 'friend', label: 'Pax', value: 'Online' },
  { type: 'glance', id: 'fr-vega', kind: 'friend', label: 'Vega', value: 'In BG3' },
];

// ── Catalog — the single source of section templates. The Add gallery draws
// from it, and a persisted layout (a tiny list of {id, kind}) rehydrates content
// from it, so saved layouts survive asset-hash changes on rebuild. ──
type Template = Omit<SectionData, 'id' | 'kind'>;
const CATALOG: Record<string, () => Template> = {
  spotlight: () => ({
    widgets: [{ type: 'feature', art: HERO.art, eyebrow: 'Continue Playing', title: HERO.title, sub: 'Pick up where you left off.' }],
  }),
  recent: () => ({ title: 'Recent', count: String(RECENT.length), widgets: [{ type: 'collection', items: RECENT, tileRows: 2 }] }),
  library: () => ({ title: 'Library', count: String(LIBRARY.length), widgets: [{ type: 'collection', items: LIBRARY, tileRows: 4 }] }),
  installed: () => ({ title: 'Installed', count: String(INSTALLED.length), widgets: [{ type: 'collection', items: INSTALLED, tileRows: 4 }] }),
  wishlist: () => ({ title: 'Wishlist', count: String(WISHLIST.length), widgets: [{ type: 'collection', items: WISHLIST, tileRows: 2 }] }),
  shop: () => ({ title: 'Shop', count: 'Deals', widgets: [{ type: 'deals', items: DEALS }] }),
  system: () => ({ title: 'System', rows: 3, widgets: SYSTEM_WIDGETS }),
  friends: () => ({ title: 'Friends', rows: 3, widgets: FRIENDS_WIDGETS }),
  devices: () => ({
    title: 'Devices',
    rows: 4,
    widgets: [instDevice('dev-saga', 'dev-saga-0'), instDevice('dev-cloud', 'dev-cloud-0'), instDevice('dev-oled', 'dev-oled-0')].filter(Boolean) as Widget[],
  }),
};

const GALLERY = [
  { kind: 'recent', name: 'Recent', hint: 'Recently played' },
  { kind: 'library', name: 'Library', hint: 'Your full collection' },
  { kind: 'installed', name: 'Installed', hint: 'Ready to play' },
  { kind: 'wishlist', name: 'Wishlist', hint: 'Saved to buy' },
  { kind: 'shop', name: 'Shop', hint: 'New & featured' },
  { kind: 'system', name: 'System', hint: 'CPU · GPU · FPS' },
  { kind: 'friends', name: 'Friends', hint: "Who's online" },
  { kind: 'spotlight', name: 'Spotlight', hint: 'Featured hero' },
  { kind: 'devices', name: 'Devices', hint: 'Your peripherals' },
];

const DEFAULT_KINDS = ['spotlight', 'recent', 'library', 'system', 'devices', 'shop'];
const STORAGE_KEY = 'trhs-metro-layout';

const isPacked = (s: SectionData) => isCellWidget(s.widgets[0]);

function instantiate(id: string | null, kind: string): SectionData | null {
  const make = CATALOG[kind];
  return make ? { id: id || newId(kind), kind, ...make() } : null;
}
function defaultLayout(): SectionData[] {
  return DEFAULT_KINDS.map((kind) => instantiate(kind, kind)!).filter(Boolean);
}
// Persisted shape: collection/feature sections store {id, kind} + a small `size`
// override and rehydrate content from the catalog (fresh art). Packed (glance)
// sections store their widgets as full data, so user add/remove/resize edits
// survive reloads. Legacy `span` migrates to `rows` on load (back-compat).
type SavedSize = { cols?: number; rows?: number; tileRows?: number };
type SavedCell = (GlanceWidget | DeviceMetroWidget) & { span?: number };
type SavedSection = { id: string; kind: string; rows?: number; widgets?: SavedCell[]; size?: SavedSize };
function loadLayout(): SectionData[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as SavedSection[] | null;
    if (Array.isArray(saved) && saved.length) {
      const built = saved
        .map((s) => {
          const sec = instantiate(s.id, s.kind);
          if (!sec) return null;
          if (isPacked(sec) && Array.isArray(s.widgets)) {
            sec.widgets = s.widgets.map(({ span, ...w }) => ({ ...w, cols: w.cols ?? 1, rows: w.rows ?? span ?? 1 })) as Widget[];
            if (s.rows != null) sec.rows = s.rows; // restore authored section row count
          } else if (!isPacked(sec) && s.size) {
            sec.widgets = [applySize(sec.widgets[0], s.size)];
          }
          return sec;
        })
        .filter(Boolean) as SectionData[];
      if (built.length) return built;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return defaultLayout();
}
function saveLayout(layout: SectionData[]) {
  try {
    const compact: SavedSection[] = layout.map((s) => {
      if (isPacked(s)) return { id: s.id, kind: s.kind, rows: s.rows, widgets: s.widgets as SavedCell[] };
      const w0 = s.widgets[0];
      const size: SavedSize | undefined =
        w0.type === 'collection'
          ? { cols: w0.cols, tileRows: w0.tileRows }
          : w0.type === 'feature' || w0.type === 'deals'
            ? { cols: w0.cols }
            : undefined;
      return { id: s.id, kind: s.kind, size };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
  } catch {
    /* ignore */
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const SPRING = { type: 'spring', stiffness: 420, damping: 46, mass: 0.7 } as const;

// ── Sizing model helpers (Columns = width, Rows = density) ──
// The current cols/rows of any widget, with sensible defaults per type. `rows`
// is null for Feature (a window-height hero has nothing to span vertically).
function sizeOf(w: Widget): { cols: number; rows: number | null } {
  if (w.type === 'glance') return { cols: w.cols ?? 1, rows: w.rows ?? 1 };
  if (w.type === 'device') return { cols: w.cols ?? 2, rows: w.rows ?? 2 };
  if (w.type === 'collection') return { cols: w.cols ?? Math.ceil(w.items.length / (w.tileRows || 2)), rows: w.tileRows ?? 2 };
  if (w.type === 'deals') return { cols: w.cols ?? 2, rows: null };
  return { cols: w.cols ?? 2, rows: null }; // feature
}
// Apply one axis of the resize menu to a widget, mapping per type.
function applyAxis(w: Widget, axis: 'cols' | 'rows', val: number): Widget {
  if (w.type === 'collection') return axis === 'cols' ? { ...w, cols: val } : { ...w, tileRows: val };
  if (w.type === 'feature' || w.type === 'deals') return axis === 'cols' ? { ...w, cols: val } : w; // width-only
  return { ...w, [axis]: val }; // glance + device (grid-cell span on both axes)
}
// Apply a whole persisted size override (used on load for non-packed sections).
function applySize(w: Widget, size: SavedSize): Widget {
  let out = w;
  if (size.cols != null) out = applyAxis(out, 'cols', size.cols);
  if (size.rows != null) out = applyAxis(out, 'rows', size.rows);
  if (size.tileRows != null && out.type === 'collection') out = { ...out, tileRows: size.tileRows };
  return out;
}

const METRO_TABS: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', to: '/metro', icon: <Icon name="grid" /> },
  { id: 'play', label: 'Play', to: '/play', icon: <Icon name="play" /> },
  { id: 'perform', label: 'Perform', to: '/perform', icon: <Icon name="performance" /> },
  { id: 'personalize', label: 'Personalize', to: '/personalize', icon: <Icon name="profile" /> },
  { id: 'shop', label: 'Shop', to: '/shop', icon: <Icon name="shop" /> },
];

function Tile({ art, name }: TileData) {
  return (
    <div className="metro-tile" style={{ backgroundImage: `url(${art})` }} tabIndex={0} role="button" aria-label={name}>
      <div className="metro-tile-label">{name}</div>
    </div>
  );
}

function Collection({ items, tileRows = 2, cols }: { items: TileData[]; tileRows?: number; cols?: number }) {
  // grid-auto-flow is column with `tileRows` rows, so exactly cols*tileRows tiles
  // auto-create exactly `cols` columns. Undefined cols → show everything (default).
  const visible = cols ? items.slice(0, cols * tileRows) : items;
  return (
    <div className="metro-grid" style={{ gridTemplateRows: `repeat(${tileRows}, 1fr)` }}>
      {visible.map((g, i) => (
        <Tile key={g.name + i} {...g} />
      ))}
    </div>
  );
}

// A vertical stack of wide DealTiles — the Shop section's store promos.
// `cols` maps to a tile-width preset (kept tight so deals stay legible but not
// oversized in the window-height column).
const DEAL_WIDTH: Record<number, number> = { 1: 280, 2: 340, 3: 400 };
function Deals({ items, cols = 2 }: { items: DealData[]; cols?: number }) {
  const width = DEAL_WIDTH[cols] ?? DEAL_WIDTH[2];
  return (
    <div className="metro-deals">
      {items.map((d, i) => (
        <DealTile key={d.title + i} className="metro-deal" style={{ width }} glow {...d} />
      ))}
    </div>
  );
}

const FEATURE_WIDTH: Record<number, string> = {
  1: 'min(360px, 80vw)',
  2: 'min(520px, 34vw)',
  3: 'min(680px, 52vw)',
};
function Feature({ art, eyebrow, title, sub, cols = 2 }: FeatureWidget) {
  return (
    <div className="metro-spotlight" style={{ backgroundImage: `url(${art})`, width: FEATURE_WIDTH[cols] ?? FEATURE_WIDTH[2] }}>
      <div className="metro-spotlight-body">
        {eyebrow && <p className="metro-eyebrow">{eyebrow}</p>}
        <h2 className="metro-spotlight-title">{title}</h2>
        {sub && <p className="metro-spotlight-sub">{sub}</p>}
        <button className="metro-play" type="button">▶ Play</button>
      </div>
    </div>
  );
}

// Resize menu — options come from the widget's SizeSpec, so each axis only shows
// what that widget allows (and an axis with a single option is hidden, e.g. a
// fixed-size or width-only widget). Stays open so both axes can be set at once.
const RESIZE_ICON = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V3h4M13 9v4H9" /><path d="M3 3l4 4M13 13l-4-4" />
  </svg>
);
function ResizePop({ widget, onSet }: { widget: Widget; onSet: (axis: 'cols' | 'rows', val: number) => void }) {
  const cur = sizeOf(widget);
  const spec = specOf(widget);
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  const seg = (axis: 'cols' | 'rows', active: number, opts: number[]) => (
    <div className="metro-seg">
      {opts.map((n) => (
        <button key={n} type="button" className={active === n ? 'on' : ''} onPointerDown={stop} onClick={() => onSet(axis, n)} aria-pressed={active === n}>
          {n}
        </button>
      ))}
    </div>
  );
  const colOpts = axisOptions(spec.cols);
  const rowOpts = axisOptions(spec.rows);
  return (
    <div className="metro-resize-pop" onPointerDown={stop} role="group" aria-label="Resize widget">
      {colOpts.length > 1 && <div className="metro-seg-row"><span className="metro-seg-label">Columns</span>{seg('cols', cur.cols, colOpts)}</div>}
      {cur.rows != null && rowOpts.length > 1 && <div className="metro-seg-row"><span className="metro-seg-label">Rows</span>{seg('rows', cur.rows, rowOpts)}</div>}
    </div>
  );
}

function Section({
  section,
  groupRef,
  editing,
  onRemove,
  onWidgetRemove,
  onAddWidget,
  openResizeId,
  onOpenResize,
  onSetSize,
  onSetSectionRows,
  onReorderWidget,
  onGripPointerDown,
  onOpenDevice,
}: {
  section: SectionData;
  groupRef?: (el: HTMLElement | null) => void;
  editing?: boolean;
  onRemove?: () => void;
  onWidgetRemove?: (widgetId: string) => void;
  onAddWidget?: () => void;
  openResizeId?: string | null;
  onOpenResize?: (targetId: string) => void;
  onSetSize?: (targetId: string, axis: 'cols' | 'rows', val: number) => void;
  onSetSectionRows?: (n: number) => void;
  onReorderWidget?: (fromId: string, toIndex: number) => void;
  onGripPointerDown?: (e: React.PointerEvent) => void;
  onOpenDevice?: (skuId: string, tab?: string) => void;
}) {
  const { title, count, rows = 1, widgets } = section;
  const packed = isCellWidget(widgets[0]);
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  // Refs to each glance widget's element, for drop hit-testing on reorder.
  const widgetEls = useRef<Map<string, HTMLElement>>(new Map());
  const gridRef = useRef<HTMLDivElement>(null);
  // On drop, the dragged widget lands in the slot nearest the pointer; the array
  // is reordered and the grid repacks (Framer `layout` animates the shuffle).
  const handleWidgetDrop = (fromId: string, point: { x: number; y: number }) => {
    let bestId: string | null = null;
    let bestD = Infinity;
    widgetEls.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      const d = (r.left + r.width / 2 - point.x) ** 2 + (r.top + r.height / 2 - point.y) ** 2;
      if (d < bestD) { bestD = d; bestId = id; }
    });
    if (bestId && bestId !== fromId) {
      const toIndex = widgets.findIndex((w) => (w as GlanceWidget).id === bestId);
      if (toIndex >= 0) onReorderWidget?.(fromId, toIndex);
    }
  };
  return (
    <section className={'metro-group' + (editing ? ' editing' : '')} ref={groupRef as React.Ref<HTMLElement>}>
      {editing && (
        <div className="metro-edit-chrome">
          <span className="metro-grip" role="button" tabIndex={0} aria-label={`Drag to reorder ${title || 'section'}`} onPointerDown={onGripPointerDown}>
            <svg viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="4" r="1.3" /><circle cx="11" cy="4" r="1.3" /><circle cx="5" cy="8" r="1.3" /><circle cx="11" cy="8" r="1.3" /><circle cx="5" cy="12" r="1.3" /><circle cx="11" cy="12" r="1.3" /></svg>
          </span>
          <div className="metro-chrome-actions">
            {/* Packed sections author their own row count (height ÷ N). */}
            {packed && (
              <div className="metro-rows-step" onPointerDown={stop}>
                <button type="button" onClick={() => onSetSectionRows?.(rows - 1)} disabled={rows <= 1} aria-label="Fewer rows">−</button>
                <span className="metro-rows-val" title="Section rows">{rows}<span className="metro-rows-unit">rows</span></span>
                <button type="button" onClick={() => onSetSectionRows?.(rows + 1)} disabled={rows >= SECTION_ROWS_MAX} aria-label="More rows">+</button>
              </div>
            )}
            {!packed && isResizable(widgets[0]) && (
              <button className="metro-remove metro-secresize" type="button" onPointerDown={stop} onClick={() => onOpenResize?.(section.id)} aria-label={`Resize ${title || 'section'}`}>
                {RESIZE_ICON}
              </button>
            )}
            <button className="metro-remove" type="button" onPointerDown={stop} onClick={onRemove} aria-label={`Remove ${title || 'section'}`}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
          </div>
        </div>
      )}
      {/* Resize menu for single-widget (collection/feature) sections. */}
      {editing && !packed && openResizeId === section.id && (
        <ResizePop widget={widgets[0]} onSet={(axis, val) => onSetSize?.(section.id, axis, val)} />
      )}
      {(title || count != null) && (
        <header className="metro-group-head">
          {title && <span className="metro-group-title">{title}</span>}
          {count != null && <span className="metro-group-count">{count}</span>}
        </header>
      )}
      {packed ? (
        <div className="metro-widgets" ref={gridRef} style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}>
          {(widgets as CellWidget[]).map((w) => (
            <motion.div
              className={'metro-cell ' + (w.type === 'device' ? 'metro-devcell' : 'metro-widget')}
              style={{ gridColumn: `span ${w.cols ?? 1}`, gridRow: `span ${w.rows ?? 1}` }}
              key={w.id}
              layout
              ref={(el) => { if (el) widgetEls.current.set(w.id, el); else widgetEls.current.delete(w.id); }}
              drag={editing && widgets.length > 1}
              dragSnapToOrigin
              dragElastic={0.12}
              dragConstraints={gridRef}
              dragMomentum={false}
              whileDrag={{ scale: 1.04, zIndex: 30, cursor: 'grabbing' }}
              onPointerDown={editing ? stop : undefined}
              onDragEnd={(_e, info) => handleWidgetDrop(w.id, info.point)}
            >
              {w.type === 'device' ? (
                (() => {
                  const model = deviceCardModel(w.skuId);
                  return model ? (
                    <DeviceCard
                      model={model}
                      onOpen={editing ? undefined : () => onOpenDevice?.(w.skuId)}
                      onShortcut={editing ? undefined : (tab) => onOpenDevice?.(w.skuId, tab)}
                    />
                  ) : null;
                })()
              ) : (
                <>
                  <span className="metro-widget-label">{w.label}</span>
                  <span className="metro-widget-value">{w.value}</span>
                  {w.spark && <div className="metro-spark" />}
                </>
              )}
              {editing && (
                <>
                  <div className="metro-wchrome">
                    {isResizable(w) && (
                      <button type="button" className={'metro-wbtn' + (openResizeId === w.id ? ' on' : '')} title="Resize" onPointerDown={stop} onClick={() => onOpenResize?.(w.id)} aria-label="Resize widget">
                        {RESIZE_ICON}
                      </button>
                    )}
                    <button type="button" className="metro-wbtn" title="Remove widget" onPointerDown={stop} onClick={() => onWidgetRemove?.(w.id)} aria-label="Remove widget">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                    </button>
                  </div>
                  {openResizeId === w.id && <ResizePop widget={w} onSet={(axis, val) => onSetSize?.(w.id, axis, val)} />}
                </>
              )}
            </motion.div>
          ))}
          {editing && (
            <button type="button" className="metro-widget metro-add-widget" onPointerDown={stop} onClick={onAddWidget} aria-label="Add widget">
              <span className="plus">+</span>
              <span className="metro-widget-label">Add widget</span>
            </button>
          )}
        </div>
      ) : (
        widgets.map((w, i) =>
          w.type === 'feature' ? (
            <Feature key={i} {...w} />
          ) : w.type === 'deals' ? (
            <Deals key={i} {...w} />
          ) : (
            <Collection key={i} {...(w as CollectionWidget)} />
          ),
        )
      )}
    </section>
  );
}

// A reorderable section in edit mode. Drag is started only from the grip handle
// (dragListener=false + dragControls), so the panorama has an unambiguous grab
// point that doesn't compete with dragging the glance widgets inside.
function SectionItem(props: React.ComponentProps<typeof Section>) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="div"
      value={props.section}
      className="metro-reorder-item"
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.03, zIndex: 30, cursor: 'grabbing' }}
      transition={SPRING}
    >
      <Section {...props} onGripPointerDown={(e) => controls.start(e)} />
    </Reorder.Item>
  );
}

export function MetroDashboard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Open the device modal (mounted below) — shared with the main app via `?sku=`.
  const openDevice = (skuId: string, tab?: string) => {
    const p = new URLSearchParams(params);
    p.set('sku', skuId);
    if (tab) p.set('tab', tab);
    else p.delete('tab');
    setParams(p);
  };
  const x = useMotionValue(0);
  const bgX = useTransform(x, (v) => v * 0.4);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const groupEls = useRef<(HTMLElement | null)[]>([]);
  const maxScrollRef = useRef(0);

  const [maxScroll, setMaxScroll] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [snap, setSnap] = useState(false);
  const snapRef = useRef(snap);
  snapRef.current = snap;

  const [speed, setSpeed] = useState(2.6);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const wheelTarget = useRef(0);
  const lastWheel = useRef(0);

  const [layout, setLayout] = useState<SectionData[]>(loadLayout);
  const [editing, setEditing] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [widgetGalleryFor, setWidgetGalleryFor] = useState<string | null>(null);
  // The widget whose resize menu is open. Glance widgets key by widget id;
  // single-widget (collection/feature) sections key by section id.
  const [resizeFor, setResizeFor] = useState<string | null>(null);
  useEffect(() => { saveLayout(layout); }, [layout]);
  useEffect(() => { if (!editing) setResizeFor(null); }, [editing]);
  const removeSection = (id: string) => setLayout((l) => l.filter((s) => s.id !== id));
  const addSection = (kind: string) => { setLayout((l) => [...l, instantiate(null, kind)!]); setGallery(false); };
  const resetLayout = () => setLayout(defaultLayout());
  const toggleResize = (targetId: string) => setResizeFor((cur) => (cur === targetId ? null : targetId));

  // Widget-level edits within a section.
  const editSection = (sectionId: string, fn: (s: SectionData) => SectionData) =>
    setLayout((l) => l.map((s) => (s.id === sectionId ? fn(s) : s)));
  const removeWidget = (sectionId: string, widgetId: string) => {
    if (resizeFor === widgetId) setResizeFor(null);
    editSection(sectionId, (s) => ({ ...s, widgets: s.widgets.filter((w) => (w as GlanceWidget).id !== widgetId) }));
  };
  // Resize: a packed section targets the matching glance widget by id; a
  // single-widget section is keyed by section id, so we resize widgets[0].
  // Growing a glance widget past the section's row count grows the section to fit.
  const setWidgetSize = (sectionId: string, targetId: string, axis: 'cols' | 'rows', val: number) =>
    editSection(sectionId, (s) => {
      const packed = isPacked(s);
      const widgets = s.widgets.map((w, i) =>
        (packed ? (w as GlanceWidget).id === targetId : i === 0) ? applyAxis(w, axis, val) : w,
      );
      const rows = packed && axis === 'rows' ? Math.min(SECTION_ROWS_MAX, Math.max(s.rows ?? 1, val)) : s.rows;
      return { ...s, rows, widgets };
    });
  // Authoring a packed section's row count. Clamps to [1, MAX]; reducing it
  // shrinks any glance widget that was taller than the new count.
  const setSectionRows = (sectionId: string, n: number) =>
    editSection(sectionId, (s) => {
      const rows = clamp(n, 1, SECTION_ROWS_MAX);
      return {
        ...s,
        rows,
        widgets: s.widgets.map((w) => (isCellWidget(w) && (w.rows ?? 1) > rows ? { ...w, rows } : w)),
      };
    });
  // Move a glance widget to a new index within its section (drag-reorder).
  const reorderWidget = (sectionId: string, fromId: string, toIndex: number) =>
    editSection(sectionId, (s) => {
      const from = s.widgets.findIndex((w) => (w as GlanceWidget).id === fromId);
      if (from < 0 || toIndex < 0 || toIndex >= s.widgets.length || from === toIndex) return s;
      const widgets = [...s.widgets];
      const [moved] = widgets.splice(from, 1);
      widgets.splice(toIndex, 0, moved);
      return { ...s, widgets };
    });
  const addWidget = (sectionId: string, kind: string) => {
    const w = instCell(kind);
    if (w) editSection(sectionId, (s) => ({ ...s, widgets: [...s.widgets, w] }));
    setWidgetGalleryFor(null);
  };

  useLayoutEffect(() => {
    const measure = () => {
      const vw = viewportRef.current?.clientWidth ?? 0;
      const cw = trackRef.current?.scrollWidth ?? 0;
      const m = Math.max(0, cw - vw);
      maxScrollRef.current = m;
      setMaxScroll(m);
      setAtEnd(-x.get() >= m - 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    if (viewportRef.current) ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, [x, layout]);

  useMotionValueEvent(x, 'change', (v) => {
    setAtStart(v >= -1);
    setAtEnd(-v >= maxScrollRef.current - 1);
  });

  const goTo = (target: number, opts: object = SPRING) => animate(x, clamp(target, -maxScrollRef.current, 0), opts);

  const snapToNearest = () => {
    if (!snapRef.current) return;
    const cur = -x.get();
    const offsets = groupEls.current.filter(Boolean).map((el) => (el as HTMLElement).offsetLeft);
    if (!offsets.length) return;
    let best = offsets[0];
    for (const o of offsets) if (Math.abs(o - cur) < Math.abs(best - cur)) best = o;
    goTo(-clamp(best - 24, 0, maxScrollRef.current));
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let snapTimer: ReturnType<typeof setTimeout>;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      let dy = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= el.clientWidth;
      const now = performance.now();
      if (now - lastWheel.current > 180) wheelTarget.current = x.get();
      lastWheel.current = now;
      wheelTarget.current = clamp(wheelTarget.current - dy * speedRef.current, -maxScrollRef.current, 0);
      animate(x, wheelTarget.current, { type: 'spring', stiffness: 180, damping: 28, mass: 0.6 });
      if (snapRef.current) {
        clearTimeout(snapTimer);
        snapTimer = setTimeout(snapToNearest, 200);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      clearTimeout(snapTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x]);

  const page = (dir: number) => goTo(x.get() - dir * ((viewportRef.current?.clientWidth ?? 0) * 0.72));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); page(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); page(-1); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); goTo(-maxScrollRef.current); }
  };

  const setGroupRef = (i: number) => (el: HTMLElement | null) => { groupEls.current[i] = el; };

  return (
    <div className="metro">
      <motion.div className="metro-bg" style={{ x: bgX, backgroundImage: `url(${HERO.art})` }} />
      <div className="metro-scrim" />

      <nav className="metro-nav">
        <span className="metro-brand">Treehouse</span>
        <Menu items={METRO_TABS} orientation="horizontal" aria-label="Main" />
        <span className="metro-nav-util" />
      </nav>

      <div className="metro-stage">
        <div className="metro-viewport" ref={viewportRef} tabIndex={0} onKeyDown={onKeyDown} aria-label="Dashboard panorama">
          {editing ? (
            <Reorder.Group as="div" axis="x" values={layout} onReorder={setLayout} className="metro-track editing" ref={trackRef} style={{ x }}>
              {layout.map((section) => (
                <SectionItem
                  key={section.id}
                  section={section}
                  editing
                  onRemove={() => removeSection(section.id)}
                  onWidgetRemove={(wid) => removeWidget(section.id, wid)}
                  onAddWidget={() => setWidgetGalleryFor(section.id)}
                  openResizeId={resizeFor}
                  onOpenResize={toggleResize}
                  onSetSize={(targetId, axis, val) => setWidgetSize(section.id, targetId, axis, val)}
                  onSetSectionRows={(n) => setSectionRows(section.id, n)}
                  onReorderWidget={(fromId, toIndex) => reorderWidget(section.id, fromId, toIndex)}
                  onOpenDevice={openDevice}
                />
              ))}
            </Reorder.Group>
          ) : (
            <motion.div className="metro-track" ref={trackRef} style={{ x }} drag="x" dragConstraints={{ left: -maxScroll, right: 0 }} dragElastic={0.06} dragMomentum onDragEnd={snapToNearest}>
              {layout.map((section, i) => (
                <Section key={section.id} section={section} groupRef={setGroupRef(i)} onOpenDevice={openDevice} />
              ))}
            </motion.div>
          )}
        </div>

        <button className="metro-edge left" type="button" hidden={atStart} onClick={() => page(-1)} aria-label="Scroll left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5 8 12l7 7" /></svg>
        </button>
        <button className="metro-edge right" type="button" hidden={atEnd} onClick={() => page(1)} aria-label="Scroll right">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="metro-controls">
        <span className="metro-hint">{editing ? 'drag sections to reorder' : 'scroll · drag · ← →'}</span>
        <span className="sep" />
        {editing ? (
          <>
            <button type="button" onClick={() => setGallery(true)}>+ Add section</button>
            <button type="button" onClick={resetLayout}>Reset</button>
            <span className="sep" />
            <button type="button" className="primary" onClick={() => setEditing(false)}>Done</button>
          </>
        ) : (
          <>
            <label title="Wheel speed (distance per notch)">
              Speed
              <input type="range" min="1.4" max="6" step="0.2" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
              <span className="metro-hint" style={{ width: 22 }}>{speed.toFixed(1)}</span>
            </label>
            <span className="sep" />
            <label>
              <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
              Snap
            </label>
            <span className="sep" />
            <button type="button" onClick={() => setEditing(true)}>Customize</button>
            <button type="button" onClick={() => navigate('/')}>Classic</button>
          </>
        )}
      </div>

      {gallery && (
        <div className="metro-gallery-backdrop" onClick={() => setGallery(false)}>
          <div className="metro-gallery" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add to dashboard">
            <header className="metro-gallery-head">
              <span>Add to dashboard</span>
              <button className="metro-gallery-close" type="button" onClick={() => setGallery(false)} aria-label="Close">✕</button>
            </header>
            <div className="metro-gallery-grid">
              {GALLERY.map((g) => (
                <button key={g.kind} className="metro-gallery-card" type="button" onClick={() => addSection(g.kind)}>
                  <span className="name">{g.name}</span>
                  <span className="hint">{g.hint}</span>
                  <span className="plus" aria-hidden="true">+</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {widgetGalleryFor && (
        <div className="metro-gallery-backdrop" onClick={() => setWidgetGalleryFor(null)}>
          <div className="metro-gallery" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add widget">
            <header className="metro-gallery-head">
              <span>Add widget</span>
              <button className="metro-gallery-close" type="button" onClick={() => setWidgetGalleryFor(null)} aria-label="Close">✕</button>
            </header>
            <div className="metro-gallery-grid metro-gallery-grid--widgets">
              {WIDGET_GALLERY.map((g) => (
                <button key={g.kind} className="metro-gallery-card" type="button" onClick={() => addWidget(widgetGalleryFor, g.kind)}>
                  <span className="name">{g.name}</span>
                  <span className="plus" aria-hidden="true">+</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Device modal — shared with the main app; device cards open it via ?sku= */}
      <DeviceModalHost />
    </div>
  );
}
