// ══════════════════════════════════════════════════════════════════════════
// Device Overview — the Perform "My Devices" section reconceived (approved
// rework): a glanceable Map of the display/KVM arrangement + a Tile view that
// reuses Chris's DeviceWidget cards. Adaptive to how many computers are present.
//
// Source of truth: Treehouse-monitor/device-overview.html (v3 2026-07-09 +
// adaptive states 2026-07-14). Scenario/spec = design-assets/chris-sync-2026-07.md
// #2. Built on library components; only the draft kb/mouse/laptop glyphs are
// inline (not in Chris's 267-icon set — icon-requests #8-10, rendered neutral).
//
// States (see mockup header comment for the full rationale):
//   0 single computer  → Tile only (DeviceWidget reused), no toggle, no KVM
//   1 multi · Direct    → Map; MacBook active; Treehouse 32 shows empty KVM slot
//   2 multi · KVM       → Map; Gaming Laptop active; Treehouse 32 shows KVM chip
// The three-way "Prototype state" control stands in for detection (review only).
//
// One schematic, two verbs (decision C, 2026-07-28): the map is read-only by
// default (View — click a tile to switch the active computer, Zone 3) and
// becomes editable inside Arrange mode (drag a display). Positions are the same
// saved layout the monitor modal hero edits — devices/arrangement.ts. Only
// displays drag: the clamshell Gaming Laptop has no place in an OS display
// arrangement, so it is dimmed in Arrange and travels with Treehouse 32.
// ══════════════════════════════════════════════════════════════════════════
import { useRef, useState } from 'react';
import { Button, ToggleButtonGroup } from '../components';
import { useSettings } from '../state/Settings';
import {
  MIRROR,
  SLAB_ANCHOR,
  SLAB_OFFSET,
  offsetFrom,
  pct,
  readArrangement,
  useArrangeDrag,
  type Positions,
} from '../devices/arrangement';
import { DeviceWidget } from './DeviceWidget';
import '../devices/display-arrange.css'; // mirror badge, hint type — Chris's, reused
import './device-overview.css';

// Tile view reuses the existing configurable-device roster as-is (the current
// "My Devices" grid). NOTE for review: the Map roster (below) is the display/
// computer arrangement (incl. MacBook + Gaming Laptop), which is a different
// granularity than these configurable devices — flagged for Cindy.
const TILE_DEVICES = ['treehouse-32', 'haste-3-pro', 'pulse-27', 'origins-65', 'cloud-iii'];

type Proto = 'single' | 'direct' | 'kvm';
type View = 'map' | 'tile';

// ── draft glyphs (paths lifted verbatim from the mockup's inline symbols) ──
function KeyboardGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1.8" y="5.3" width="16.4" height="9.4" rx="1.8" />
      <path d="M4.6 8.2h.9M7.5 8.2h.9M10.4 8.2h.9M13.3 8.2h.9M5.5 11.6h9" />
    </svg>
  );
}
function MouseGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6.6" y="2.6" width="6.8" height="14.8" rx="3.4" />
      <path d="M10 5.4v2.8" />
    </svg>
  );
}
function LaptopGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 10.5h11l1.7 3.2H2.8z" />
      <path d="M7.5 12.1h5" />
    </svg>
  );
}

function TileGrid() {
  return (
    <div className="pg-grid pg-grid-wide">
      {TILE_DEVICES.map((id) => (
        <DeviceWidget key={id} skuId={id} />
      ))}
    </div>
  );
}

type StageProps = {
  positions: Positions;
  mirror: boolean;
  arrange: boolean;
  stageRef: React.RefObject<HTMLDivElement>;
  onTileDown: (e: React.PointerEvent, id: string, kind: string) => void;
  onSwitch: (to: Proto) => void;
};

/** The Map stage — direct/KVM appearance is CSS-driven via the root `is-kvm`. */
function MapStage({ positions, mirror, arrange, stageRef, onTileDown, onSwitch }: StageProps) {
  const at = (id: string) => (mirror ? MIRROR[id] : positions[id]);
  const place = (id: string) => ({ left: pct(at(id).left), top: pct(at(id).top) });
  const slab = offsetFrom(mirror ? MIRROR[SLAB_ANCHOR] : positions[SLAB_ANCHOR], SLAB_OFFSET);

  // Drag while arranging; switch the active computer while viewing. Gating the
  // two verbs by mode is what keeps click and drag from fighting on one tile.
  const display = (id: string, kind: string) =>
    arrange
      ? { className: ' is-draggable', onPointerDown: (e: React.PointerEvent) => onTileDown(e, id, kind) }
      : {};
  const switcher = (to: Proto, label: string) =>
    arrange
      ? {}
      : {
          className: ' is-activate',
          role: 'button',
          tabIndex: 0,
          title: label,
          'aria-label': label,
          onClick: () => onSwitch(to),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSwitch(to);
            }
          },
        };

  const omen = display('oled-27', 'monitor');
  const mac = { ...display('builtin', 'laptop'), ...switcher('direct', 'Switch the active computer to MacBook') };
  const tree = {
    ...display('treehouse-32', 'monitor'),
    ...switcher('kvm', 'Switch the Treehouse 32 KVM to the Gaming Laptop'),
  };
  const gaming = switcher('kvm', 'Switch the active computer to Gaming Laptop');

  return (
    <div className={'dov-stage' + (mirror ? ' is-mirror' : '')} ref={stageRef}>
      {mirror && <span className="dsa-mirror-badge">Mirrored — all displays show the same image</span>}

      {/* OMEN OLED 27 — always MacBook's utility screen */}
      <div className={'dov-monitor dov-disp d-omen' + (omen.className ?? '')} style={place('oled-27')} onPointerDown={omen.onPointerDown}>
        <div className="dov-screen" />
        <div className="dov-base" />
        <span className="dov-name">OMEN OLED 27</span>
      </div>

      {/* MacBook — open, built-in display; active computer in the DIRECT state */}
      <div {...mac} className={'dov-laptop dov-disp d-mac' + (mac.className ?? '')} style={place('builtin')}>
        <span className="dov-io-pill dov-only-direct" title="Keyboard & mouse — connected directly to MacBook">
          <KeyboardGlyph />
          <MouseGlyph />
        </span>
        <div className="dov-screen" />
        <div className="dov-base" />
        <span className="dov-name">MacBook</span>
      </div>

      {/* Treehouse 32 — shared screen, built-in 2-host KVM */}
      <div {...tree} className={'dov-monitor dov-disp d-tree' + (tree.className ?? '')} style={place('treehouse-32')}>
        <span className="dov-io-pill dov-only-kvm" title="Keyboard & mouse — connected to the Treehouse 32 KVM">
          <KeyboardGlyph />
          <MouseGlyph />
        </span>
        <div className="dov-screen">
          <span className="dov-kvm-slot dov-only-direct">KVM</span>
          <span className="dov-kvm-chip dov-only-kvm">KVM</span>
        </div>
        <div className="dov-base" />
        <span className="dov-name">Treehouse 32</span>
        <span className="dov-tag dov-only-direct">MacBook</span>
        <span className="dov-tag dov-only-kvm">Gaming Laptop</span>
      </div>

      {/* Gaming Laptop — clamshell slab; not a display, so it never drags: it
          keeps its place beside the monitor it feeds (Cindy, 2026-07-29). */}
      <div
        {...gaming}
        className={'dov-disp d-slab' + (arrange ? ' is-static' : gaming.className ?? '')}
        style={{ left: pct(slab.left), top: pct(slab.top) }}
      >
        <div className="dov-slab"><LaptopGlyph /></div>
        <span className="dov-name">Gaming Laptop</span>
      </div>
    </div>
  );
}

export function DeviceOverview() {
  const [proto, setProto] = useState<Proto>('direct');
  const [view, setView] = useState<View>('map');
  const [arranging, setArranging] = useState(false);
  const single = proto === 'single';
  const kvm = proto === 'kvm';

  const { displayArrange, setDisplayArrange } = useSettings();
  const state = readArrangement(displayArrange);
  const mirror = state.mode === 'mirror';
  const [drag, setDrag] = useState<Positions | null>(null);
  const positions = drag ?? state.positions;
  const stageRef = useRef<HTMLDivElement>(null);

  // Arrange only exists on the Map, with more than one computer, in Extend.
  const arrange = arranging && view === 'map' && !single && !mirror;

  const onTileDown = useArrangeDrag({
    stageRef,
    enabled: arrange,
    getPositions: () => positions,
    onMove: setDrag,
    onCommit: (p) => {
      setDisplayArrange({ mode: state.mode, positions: p, space: 'fraction' });
      setDrag(null);
    },
  });

  const PROTOS: { id: Proto; label: string }[] = [
    { id: 'single', label: '0 · Single computer' },
    { id: 'direct', label: '1 · 2 computers — Direct' },
    { id: 'kvm', label: '2 · 2 computers — KVM' },
  ];

  return (
    <div className={'dov' + (kvm ? ' is-kvm' : '') + (arrange ? ' is-arrange' : '')}>
      {/* prototype chrome — remove when real detection lands */}
      <div className="dov-proto" role="group" aria-label="Prototype state">
        <span className="dov-proto-lbl">Prototype state</span>
        {PROTOS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={'dov-proto-btn' + (proto === p.id ? ' on' : '')}
            aria-pressed={proto === p.id}
            onClick={() => setProto(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {single ? (
        <>
          <TileGrid />
          <p className="dov-note">Tiles = existing DeviceWidget, reused — no Map/Tile toggle, no KVM with one computer</p>
        </>
      ) : (
        <>
          <div className="dov-toolbar">
            {arrange ? (
              <Button variant="accent" onClick={() => setArranging(false)}>
                Done
              </Button>
            ) : (
              <>
                <ToggleButtonGroup
                  aria-label="Overview view"
                  value={view}
                  onChange={(v) => setView(v as View)}
                  options={[{ label: 'Map', value: 'map' }, { label: 'Tile', value: 'tile' }]}
                />
                {view === 'map' && (
                  <Button
                    onClick={() => setArranging(true)}
                    disabled={mirror}
                    title={mirror ? 'Mirrored displays show one image — switch to Extend to arrange them' : undefined}
                  >
                    Arrange
                  </Button>
                )}
              </>
            )}
          </div>

          {view === 'map' ? (
            <MapStage
              positions={positions}
              mirror={mirror}
              arrange={arrange}
              stageRef={stageRef}
              onTileDown={onTileDown}
              onSwitch={setProto}
            />
          ) : (
            <TileGrid />
          )}

          {/* Arrange explains itself; View keeps the DIRECT-only status strip
              (text diet — the KVM state says it via accent + pill + tag). */}
          {arrange ? (
            <div className="dov-foot">
              <span className="dsa-hint">
                Drag a display to arrange it · this layout is shared with every display's settings
              </span>
              <span className="dsa-hint dov-hint-aside">
                Gaming Laptop is closed, so it isn't part of the display arrangement — it stays with Treehouse 32.
              </span>
            </div>
          ) : (
            !kvm && (
              <div className="dov-foot">
                <div className="dov-strip">
                  <span className="dov-dot" />
                  <span>
                    Connect your keyboard &amp; mouse to the <b>Treehouse&nbsp;32 KVM</b> to switch between computers.
                  </span>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
