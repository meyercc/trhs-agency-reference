import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './device-canvas.css';
import {
  Icon,
  Ng3Panel,
  Ng3Grid,
  Ng3Section,
  Ng3Row,
  Ng3Field,
  Ng3Label,
  ListItem,
  Input,
  Dropdown,
  Radio,
  Slider,
  Toggle,
  Callout,
  Tooltip,
  type IconName,
} from '../components';
import { type ResolvedSku, deviceImageUrl, heroImageFile, connectionStatus } from './skus';
import { deviceTabs } from './deviceTabs';
import { ProfileBar, ProfileScopeBody, useDeviceProfileBar } from './ProfileBar';

/**
 * Full-canvas device modal — the Figma "Keys-Buttons" mouse design (node
 * 7026:56711). Replaces the small `.modal-shell` card for mice: status chips
 * top-left, the device centered on a dark canvas, and a bottom-anchored
 * `Ng3Panel` (chamfered 3-icon nav + header + a two-column Buttons body:
 * an Assignments rail and a searchable Keys/Buttons list).
 *
 * This pass is presentational with tab switching only — the assign flow
 * (button-overlay callouts, click-to-remap, tooltip, context menu) and the
 * Sensor/Settings tab content are follow-ups.
 */


// Assignment categories (left rail).
const ASSIGNMENTS: { id: string; label: string; icon: IconName }[] = [
  { id: 'keys', label: 'Buttons / Keys', icon: 'buttons' },
  { id: 'macro', label: 'Macro', icon: 'macro' },
  { id: 'text', label: 'Text', icon: 'message' },
  { id: 'launcher', label: 'Launcher', icon: 'open-app' },
];

// Mouse-button key chips (top line + key, or an icon glyph). `assign` is the
// label the chip writes into a callout when dropped/assigned.
type KeyChip = { top?: string; bot?: string; icon?: IconName; assign: string };
const MOUSE_KEYS: KeyChip[] = [
  { top: 'MOUS', bot: 'L', assign: 'MOUS L' },
  { top: 'MOUS', bot: 'R', assign: 'MOUS R' },
  { top: 'MOUS', bot: 'M', assign: 'MOUS M' },
  { top: 'MOUS', bot: '4', assign: 'MOUS 4' },
  { top: 'MOUS', bot: '5', assign: 'MOUS 5' },
  { top: 'MOUS', bot: 'L 2x', assign: 'MOUS L 2X' },
  { top: 'MOUS', icon: 'chevron-down', assign: 'WHEEL DN' },
  { top: 'MOUS', icon: 'chevron-up', assign: 'WHEEL UP' },
  { bot: 'DPI', assign: 'DPI' },
];

// ── Button callouts (Figma Keys-Buttons 4631:41576) ──────────────────────────
// Where each callout SLOT anchors on the hero figure, as a percentage of the
// rendered image box — geometry data, like the keyboard layout. `flip` slots
// anchor on the right flank, so their labels extend rightward-out (dot stays
// at the anchor end either way). Which slots exist comes from the SKU
// (`features.buttons.callouts`, editable in the configurator).
// `flip` = left-flank slots whose labels extend leftward-out; `line` stretches
// the leader so labels from centre anchors (wheel, DPI) clear the mouse body.
// Rows are spread so labels stay clear of each other even in the taller
// assigned state (kicker + value) — overlapping callout buttons steal each
// other's clicks and drag drops.
const CALLOUT_POS: Record<string, { x: number; y: number; flip?: boolean; line?: number }> = {
  lt: { x: 40, y: 12, flip: true, line: 44 },
  lm: { x: 26, y: 32, flip: true, line: 40 },
  lb: { x: 25, y: 45, flip: true, line: 36 },
  rt: { x: 61, y: 9, line: 44 },
  rm: { x: 51, y: 21, line: 118 },
  rb: { x: 50, y: 34, line: 104 },
};

/** A callout's assignment: a rebind label, or the button switched off. */
type CalloutBind = { label: string } | 'disabled';

/** Format a pressed keyboard key into a chip-style assignment label. */
function keyLabel(key: string): string {
  if (key === ' ') return 'SPACE';
  return key.length === 1 ? key.toUpperCase() : key.toUpperCase();
}

// Collapsed key-category rows beneath the expanded "Mouse Buttons" group.
const KEY_GROUPS = ['Alphanumeric Keys', 'Special Keys', 'Media Keys'];

function batteryIcon(level: number): IconName {
  const step = Math.max(0, Math.min(100, Math.round(level / 10) * 10));
  return `battery-${step}` as IconName;
}

function defaultDpi(features: Record<string, any>): number {
  // A representative "active" DPI for the status chip (the design shows 400) —
  // prefer an explicit default, else 400 when it's within the sensor range.
  const dpi = features?.sensor?.dpi || {};
  if (typeof dpi.default === 'number') return dpi.default;
  const min = typeof dpi.min === 'number' ? dpi.min : 50;
  const max = typeof dpi.max === 'number' ? dpi.max : 26000;
  return 400 >= min && 400 <= max ? 400 : min;
}

function KeyChipTile({ chip }: { chip: KeyChip }) {
  return (
    <>
      {chip.top && <span className="dc-key-top">{chip.top}</span>}
      {chip.icon ? <Icon name={chip.icon} size={20} /> : chip.bot && <span className="dc-key-bot">{chip.bot}</span>}
    </>
  );
}

interface ButtonsTabProps {
  /** Chip currently armed as the next assignment (its `assign` label). */
  armedChip: string | null;
  /** A callout is armed and waiting — chips read as targets to pick. */
  calloutArmed: boolean;
  onChipClick: (chip: KeyChip) => void;
  /** Begin a possible chip drag (threshold handled by the canvas). */
  onChipPointerDown: (chip: KeyChip, e: React.PointerEvent) => void;
  onResetAll: () => void;
}

function ButtonsTab({ armedChip, calloutArmed, onChipClick, onChipPointerDown, onResetAll }: ButtonsTabProps) {
  const [assignment, setAssignment] = useState('keys');
  return (
    <Ng3Grid className="dc-buttons">
      {/* Left — Assignments rail */}
      <Ng3Section className="dc-rail">
        <Ng3Label strong info>Assignments</Ng3Label>
        <div className="dc-rail-list" role="listbox" aria-label="Assignment type">
          {ASSIGNMENTS.map((a) => (
            <ListItem
              key={a.id}
              label={a.label}
              leading={<Icon name={a.icon} size={a.id === 'keys' ? 20 : 16} />}
              selected={assignment === a.id}
              onClick={() => setAssignment(a.id)}
            />
          ))}
        </div>
        <div className="dc-rail-foot">
          <span className="dc-divider" />
          <button type="button" className="ds-btn dc-reset" onClick={onResetAll}>
            <Icon name="undo" size={16} />
            Reset Buttons
          </button>
        </div>
      </Ng3Section>

      {/* Right — Keys / Buttons list. Chips assign by click (to an armed
          callout, or arming themselves) or by dragging onto a callout. */}
      <Ng3Section className="dc-keys">
        <Input variant="search" placeholder="Search keys or buttons" aria-label="Search keys or buttons" />
        <div className="dc-keys-list">
          <div className="dc-keygroup">
            <button type="button" className="dc-keygroup-head" aria-expanded="true">
              <Icon name="buttons" size={20} />
              <span className="ds-text-label dc-keygroup-label">Mouse Buttons</span>
              <Icon name="chevron-up" size={12} />
            </button>
            <div className="dc-keychips">
              {MOUSE_KEYS.map((chip) => (
                <button
                  key={chip.assign}
                  type="button"
                  className={'dc-key' + (armedChip === chip.assign ? ' armed' : '')}
                  aria-pressed={armedChip === chip.assign}
                  aria-label={
                    calloutArmed ? `Assign ${chip.assign} to the selected button` : `${chip.assign} — pick, then choose a button`
                  }
                  onClick={() => onChipClick(chip)}
                  onPointerDown={(e) => onChipPointerDown(chip, e)}
                >
                  <KeyChipTile chip={chip} />
                </button>
              ))}
            </div>
          </div>
          {KEY_GROUPS.map((g) => (
            <button type="button" key={g} className="dc-keygroup-head" aria-expanded="false">
              <Icon name="buttons" size={20} />
              <span className="ds-text-label dc-keygroup-label">{g}</span>
              <Icon name="chevron-right" size={12} />
            </button>
          ))}
        </div>
      </Ng3Section>
    </Ng3Grid>
  );
}

// Per-preset DPI colors (1 red · 2 blue · 3 yellow · 4 green · 5 violet) — the
// DPI slider takes the active preset's color instead of the theme accent.
const DPI_PRESET_COLORS = ['var(--red)', 'var(--blue)', 'var(--yellow)', 'var(--green)', 'var(--purple)'];

// SENSOR tab — Sensitivity (DPI presets + slider) on the left; polling, lift-off,
// motion sync, angle adjustment + snapping on the right. Data-driven from
// features.sensor, falling back to the same defaults as the generic modal.
function SensorTab({ features }: { features: Record<string, any> }) {
  const sensor = features?.sensor || {};
  const dpiCfg = sensor.dpi || {};
  const min: number = dpiCfg.min ?? 50;
  const max: number = dpiCfg.max ?? 26000;
  const step: number = dpiCfg.step ?? 50;
  const presets: number[] = Array.isArray(dpiCfg.presetValues) && dpiCfg.presetValues.length
    ? dpiCfg.presetValues
    : [400, 800, 1600, 2400, 3200];
  const ticks: number[] = Array.isArray(dpiCfg.ticks) && dpiCfg.ticks.length
    ? dpiCfg.ticks
    : [50, 400, 800, 1600, 2400, 3200, 6400, 9600, 12800, 16000, 26000, 30000];
  const polling: number[] = Array.isArray(sensor.pollingRates) ? sensor.pollingRates : [1000, 500, 250];
  const liftOff: { label: string; value: string }[] = Array.isArray(sensor.liftOffDistance)
    ? sensor.liftOffDistance
    : [{ label: 'Low', value: '1mm' }, { label: 'Medium', value: '2mm' }, { label: 'High', value: '3mm' }];
  const angle = sensor.angleAdjustment && typeof sensor.angleAdjustment === 'object' ? sensor.angleAdjustment : { min: -30, max: 30 };
  const angMin: number = angle.min ?? -30;
  const angMax: number = angle.max ?? 30;
  const defaultPoll = polling.includes(1000) ? 1000 : polling[0];

  const [val, setVal] = useState(presets[0] ?? min);
  const [presetIdx, setPresetIdx] = useState(0);
  const [dpiText, setDpiText] = useState(String(presets[0] ?? min));
  const [motionSync, setMotionSync] = useState(false);
  const [ang, setAng] = useState(0);
  const [snap, setSnap] = useState(false);
  // Keep the editable field in sync when a preset / the slider drives the value.
  useEffect(() => setDpiText(String(val)), [val]);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  // Set the DPI; if it lands on a preset, adopt that preset's color (else keep
  // the last one, so the slider stays coloured while dragging between presets).
  const applyDpi = (n: number) => {
    setVal(n);
    const idx = presets.indexOf(n);
    if (idx >= 0) setPresetIdx(idx);
  };
  const commitDpi = () => {
    const n = parseInt(dpiText, 10);
    applyDpi(Number.isNaN(n) ? min : clamp(n));
  };
  const dpiColor = DPI_PRESET_COLORS[presetIdx] ?? 'var(--accent-color)';

  return (
    <Ng3Grid className="dc-sensor">
      {/* Left — Sensitivity */}
      <Ng3Section className="dc-sensor-main">
        <Ng3Label strong info>Sensitivity</Ng3Label>
        {/* DS Radio cards (Figma Sensor 8686:12783) — a real native radio group
            (arrow keys for free, which the old role="radio" buttons never had).
            The card grid places the mark + number on the top row and lets the
            DPI value span flush-left beneath. */}
        <div className="dc-sensor-presets" role="radiogroup" aria-label="DPI preset">
          {presets.map((p, i) => (
            <Radio
              key={p}
              name="dpi-preset"
              value={p}
              checked={val === p}
              onChange={() => applyDpi(p)}
              className={'dc-sensor-preset' + (val === p ? ' selected' : '')}
              label={
                <>
                  <span className="dc-sensor-preset-num">{i + 1}</span>
                  <span className="dc-sensor-preset-val">
                    {p.toLocaleString()} <span>DPI</span>
                  </span>
                </>
              }
            />
          ))}
        </div>
        <span className="dc-divider" />
        <div className="dc-sensor-dpi">
          <div className="dc-sensor-dpi-row">
            <span className="dc-sensor-dpi-key">DPI</span>
            <Input
              variant="numeric"
              className="dc-sensor-dpi-input"
              value={dpiText}
              onChange={(e) => setDpiText(e.target.value)}
              onBlur={commitDpi}
              onKeyDown={(e) => e.key === 'Enter' && commitDpi()}
              aria-label="DPI value"
              inputMode="numeric"
            />
            {/* The DPI slider takes the active preset's colour, not the accent. */}
            <div className="dc-sensor-dpi-slider" style={{ ['--accent-color' as string]: dpiColor }}>
              <div className="dc-sensor-ticks" aria-hidden="true">
                {ticks.map((t) => (
                  <span key={t}>{t.toLocaleString()}</span>
                ))}
              </div>
              <Slider min={min} max={max} step={step} value={val} onChange={applyDpi} aria-label="DPI" />
            </div>
          </div>
        </div>
      </Ng3Section>

      {/* Right — Polling / Lift-off / Motion Sync / Angle */}
      <Ng3Section className="dc-sensor-side">
        <Ng3Field>
          <Ng3Label info>Polling Rate</Ng3Label>
          <Dropdown
            aria-label="Polling rate"
            defaultValue={String(defaultPoll)}
            options={polling.map((hz) => ({ label: `${hz} Hz`, value: String(hz) }))}
          />
        </Ng3Field>
        <Ng3Field>
          <Ng3Label info>Lift-off Distance</Ng3Label>
          <Dropdown
            aria-label="Lift-off distance"
            defaultValue={liftOff[0]?.value}
            options={liftOff.map((o) => ({ label: `${o.label} (${o.value})`, value: o.value }))}
          />
        </Ng3Field>
        <Ng3Row>
          <Ng3Label info>Motion Sync</Ng3Label>
          <Toggle checked={motionSync} onChange={setMotionSync} aria-label="Motion sync" />
        </Ng3Row>
        <Ng3Field>
          <Ng3Label info>Angle Adjustment</Ng3Label>
          <Slider min={angMin} max={angMax} value={ang} onChange={setAng} aria-label="Angle adjustment" />
          <div className="dc-sensor-notes">
            <span>{angMin}°</span>
            <span>{angMax}°</span>
          </div>
        </Ng3Field>
        <Ng3Row>
          <Ng3Label info>Angle Snapping</Ng3Label>
          <Toggle checked={snap} onChange={setSnap} aria-label="Angle snapping" />
        </Ng3Row>
      </Ng3Section>
    </Ng3Grid>
  );
}

export function DeviceCanvas({
  sku,
  onClose,
  initialTab,
}: {
  sku: ResolvedSku;
  onClose: () => void;
  initialTab?: string;
}) {
  const profile = useDeviceProfileBar(sku);
  const TABS = deviceTabs(sku);
  const [tabId, setTabId] = useState(
    initialTab && TABS.some((t) => t.id === initialTab) ? initialTab : TABS[0].id,
  );
  const active = TABS.find((t) => t.id === tabId) ?? TABS[0];

  const heroSrc = deviceImageUrl(heroImageFile(sku));
  const conn = connectionStatus(sku.features);
  const dpi = defaultDpi(sku.features);

  // ── Button assignment state (Buttons tab) ─────────────────────────────────
  // Owned by the canvas because the hero (callouts) and the panel (chips)
  // share it — same split as the keyboard canvas. Session-local.
  const callouts: { slot: string; id: string; label: string }[] = Array.isArray(
    sku.features?.buttons?.callouts,
  )
    ? sku.features.buttons.callouts
    : [];
  const [binds, setBinds] = useState<Record<string, CalloutBind>>({});
  const [armed, setArmed] = useState<string | null>(null); // callout id awaiting an assignment
  const [armedChip, setArmedChip] = useState<string | null>(null); // chip picked first
  const [drag, setDrag] = useState<{ chip: KeyChip; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragPending = useRef<{ chip: KeyChip; sx: number; sy: number } | null>(null);

  const assign = useCallback((calloutId: string, label: string) => {
    setBinds((b) => ({ ...b, [calloutId]: { label } }));
    setArmed(null);
    setArmedChip(null);
  }, []);

  const onCalloutClick = (id: string) => {
    setMenu(null);
    if (armedChip) {
      assign(id, armedChip);
    } else {
      setArmed((a) => (a === id ? null : id));
    }
  };

  const onChipClick = (chip: KeyChip) => {
    if (armed) assign(armed, chip.assign);
    else setArmedChip((c) => (c === chip.assign ? null : chip.assign));
  };

  // Armed callout: any key assigns it (the Figma hint's "press any key").
  // Capture phase so Escape cancels the arm without closing the modal; Tab is
  // left alone so keyboard users can still reach the chip panel instead.
  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return;
      e.stopPropagation();
      if (e.key === 'Escape') {
        setArmed(null);
        return;
      }
      e.preventDefault();
      assign(armed, keyLabel(e.key));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [armed, assign]);

  // Chip drag: pointer-based with a small threshold (clicks stay clicks) —
  // same pattern as the widget board. Dropping on a callout assigns.
  const onChipPointerDown = (chip: KeyChip, e: React.PointerEvent) => {
    dragPending.current = { chip, sx: e.clientX, sy: e.clientY };
  };
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const pd = dragPending.current;
      if (pd && !drag) {
        if (Math.hypot(e.clientX - pd.sx, e.clientY - pd.sy) < 4) return;
        setArmed(null);
        setArmedChip(null);
        setMenu(null);
        setDrag({ chip: pd.chip, x: e.clientX, y: e.clientY });
        return;
      }
      if (!drag) return;
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
      const over = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('[data-callout]');
      setDropTarget(over ? (over as HTMLElement).dataset.callout ?? null : null);
    };
    const onUp = () => {
      if (drag && dropTarget) assign(dropTarget, drag.chip.assign);
      dragPending.current = null;
      setDrag(null);
      setDropTarget(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, dropTarget, assign]);

  // Context menu (Reset / Disable) closes on any outside press or Escape.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest('.dc-cmenu')) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setMenu(null);
      }
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [menu]);

  const resetAll = () => {
    setBinds({});
    setArmed(null);
    setArmedChip(null);
    setMenu(null);
  };

  return (
    <div className="dc-canvas" role="dialog" aria-label={sku.name}>
      {/* Status chips */}
      <div className="dc-status">
        {conn.batteryLevel != null && (
          <div className="dc-chip">
            <Icon name={batteryIcon(conn.batteryLevel)} size={20} />
            <span className="dc-chip-val">{Math.round(conn.batteryLevel)}%</span>
          </div>
        )}
        <div className="dc-chip">
          <span className={'dc-chip-dot' + (profile.connected ? ' dc-chip-dot-on' : '')} aria-hidden="true" />
          <span className="dc-chip-val">{profile.connected ? `${dpi} DPI` : 'Disconnected'}</span>
        </div>
      </div>

      <button type="button" className="dc-close" aria-label="Close" onClick={onClose}>
        <Icon name="close" />
      </button>

      <ProfileBar state={profile} />

      {/* Hero — with the button callouts overlaid while the Buttons tab is up */}
      <div className="dc-hero">
        {heroSrc && (
          <span
            className="dc-hero-fig"
            // Interaction state, exposed for the CDP suites.
            data-armed={armed ?? undefined}
            data-armed-chip={armedChip ?? undefined}
            data-drop={dropTarget ?? undefined}
          >
            <img src={heroSrc} alt={sku.name} />
            {active.id === 'buttons' &&
              callouts.map((c) => {
                const pos = CALLOUT_POS[c.slot];
                if (!pos) return null;
                const bind = binds[c.id];
                const isOff = bind === 'disabled';
                const rebound = !!bind && !isOff;
                return (
                  <span
                    key={c.id}
                    data-callout={c.id}
                    className={'dc-co' + (pos.flip ? ' flip' : '')}
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      ...(pos.line ? { ['--co-line' as string]: `${pos.line}px` } : {}),
                    }}
                  >
                    <Tooltip
                      placement="top"
                      open={armed === c.id}
                      // Armed: the assignment hint. Otherwise the hover copy
                      // carries the identity the single-line label drops when
                      // reassigned ("Mouse 4 · G").
                      content={
                        armed === c.id
                          ? 'Nice pick! Press any key or use the panel below to assign it.'
                          : rebound
                            ? `${c.label} · ${(bind as { label: string }).label}`
                            : isOff
                              ? `${c.label} · disabled`
                              : c.label
                      }
                    >
                      {/* Single-line label (per the Figma) — assigned callouts swap
                          their text for the assignment; the physical button's
                          identity stays in the accessible name and the leader
                          line pointing at it. Two-line labels collide in the
                          tight hero rows and steal each other's clicks/drops. */}
                      <Callout
                        flip={pos.flip}
                        armed={armed === c.id || dropTarget === c.id}
                        assigned={rebound}
                        off={isOff}
                        value={isOff ? 'Disabled' : rebound ? (bind as { label: string }).label : c.label}
                        aria-label={
                          c.label +
                          (rebound ? `, assigned ${(bind as { label: string }).label}` : isOff ? ', disabled' : '')
                        }
                        onClick={() => onCalloutClick(c.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setArmed(null);
                          setMenu({ id: c.id, x: e.clientX, y: e.clientY });
                        }}
                      />
                    </Tooltip>
                  </span>
                );
              })}
          </span>
        )}
      </div>

      {/* Chip drag ghost — the picked-up key, following the cursor */}
      {drag &&
        createPortal(
          <span className="dc-key dc-drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
            <KeyChipTile chip={drag.chip} />
          </span>,
          document.body,
        )}

      {/* Callout context menu — Reset / Disable */}
      {menu &&
        createPortal(
          <div className="dc-cmenu" role="menu" style={{ left: menu.x, top: menu.y }}>
            <button
              type="button"
              className="dc-cmenu-item"
              role="menuitem"
              onClick={() => {
                setBinds((b) => {
                  const next = { ...b };
                  delete next[menu.id];
                  return next;
                });
                setMenu(null);
              }}
            >
              <Icon name="undo" size={16} />
              Reset Button
            </button>
            <button
              type="button"
              className="dc-cmenu-item"
              role="menuitem"
              onClick={() => {
                setBinds((b) => ({ ...b, [menu.id]: 'disabled' }));
                setMenu(null);
              }}
            >
              <Icon name="close" size={16} />
              Disable Button
            </button>
          </div>,
          document.body,
        )}

      {/* Bottom Ng3 product panel */}
      <div className="dc-panel-wrap">
        <Ng3Panel
          header={active.title}
          tools={TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={['ds-ng3-tool', t.id === active.id ? 'active' : ''].filter(Boolean).join(' ')}
              aria-label={t.title}
              aria-pressed={t.id === active.id}
              onClick={() => setTabId(t.id)}
            >
              <Icon name={t.icon} />
            </button>
          ))}
          actions={
            <button type="button" className="ds-ng3-action" aria-label="Duplicate">
              <Icon name="duplicate" />
            </button>
          }
          bare
        >
          <ProfileScopeBody state={profile}>
          {active.id === 'buttons' ? (
            <ButtonsTab
              key={profile.revision}
              armedChip={armedChip}
              calloutArmed={armed != null}
              onChipClick={onChipClick}
              onChipPointerDown={onChipPointerDown}
              onResetAll={resetAll}
            />
          ) : active.id === 'sensor' ? (
            <SensorTab key={profile.revision} features={sku.features} />
          ) : (
            <div className="dc-placeholder">{active.title} settings — coming soon.</div>
          )}
          </ProfileScopeBody>
        </Ng3Panel>
      </div>
    </div>
  );
}
