// ── Personalize › Quick Control — tiles ──────────────────────────────────────
// Every tile is the DS `Tile`: status + one primary control + a reason line.
// Tiles only compose existing components (Toggle, Chip, Badge, TileLink) — no
// bespoke controls.
import { lazy, Suspense, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Chip,
  Icon,
  Slider,
  Tile,
  TileLink,
  Toggle,
  ToggleButtonGroup,
  type IconName,
  type TileState,
} from '../../components';
import { useModules } from '../../state/Modules';
import { MIC_PRESET_LABEL } from '../../devices/audioLabels';
import {
  BUTTONS_LABEL,
  EQ_LABEL,
  lightingSpread,
  lightingSummary,
  type ButtonLayout,
  type EqPreset,
  type MicPreset,
  type ModeOwned,
  type TileId,
} from './model';
import { SUGGESTIONS } from './suggestions';
import { usePersonalize } from './state';
import { useLightsPower } from './LightingModal';
import { CAMERA_VIEWS } from '../../lightstudio/lighting';
import type { CameraView, DeviceId } from '../../lightstudio/scene';

const LightStudio = lazy(() => import('../../lightstudio/LightStudio').then(m => ({ default: m.LightStudio })));
import type { SuggestionId } from './model';
import { useLookReader } from './looks';

/**
 * How a tile is shown (Quick Controls direction A, 2026-10-06). Context never
 * moves a tile: `ranked` only lights it up in place. `pinned` is one you
 * starred; `plain` is everything else.
 */
export type Placement = 'ranked' | 'pinned' | 'plain';

export interface TileContext {
  placement: Placement;
  /** In the front group, so it can be picked up and moved (see Personalize.tsx). */
  movable?: boolean;
  /** This tile is the one being dragged: its cell becomes the drop placeholder. */
  dragging?: boolean;
}

/** What every quick-control tile carries for the grid: a hook for the drag
 *  (`data-qc-tile`) and the placeholder look while it is lifted. */
const gridProps = (id: TileId, ctx: TileContext) => ({
  'data-qc-tile': id,
  className: [ctx.movable && 'qc-movable', ctx.dragging && 'qc-dragging'].filter(Boolean).join(' ') || undefined,
});

/** The device a control belongs to. Tiles no longer link out (depth is the
 *  device card), but "Audio EQ · FPS" with no owner leaves you guessing whose
 *  EQ it is — so the reason line names it. */
const DEVICE_OF: Partial<Record<TileId, string>> = {
  volume: 'Cloud III',
  eq: 'Cloud III',
  spatial: 'Cloud III',
  sidetone: 'Cloud III',
  mic: 'SoloCast 2 Pro',
  buttons: 'Pulsefire Saga Pro',
  dpi: 'Pulsefire Saga Pro',
};
/** The device's own glyph, for the tile's foot. */
const DEVICE_ICON: Partial<Record<TileId, IconName>> = {
  volume: 'audio-headset',
  eq: 'audio-headset',
  spatial: 'audio-headset',
  sidetone: 'audio-headset',
  mic: 'microphone',
  buttons: 'mouse',
  dpi: 'mouse',
};
/**
 * A quick control's foot: the icon of the device it belongs to, nothing to
 * hover (Kristy 2026-10-06: the old reason icons, a profile's glyph or a
 * context's, could not be read; "改成跟title device一致的icon", "拿掉tooltip").
 * The device name still names it for assistive tech.
 */
const deviceFoot = (id: TileId) => ({
  reason: DEVICE_OF[id],
  reasonIcon: DEVICE_ICON[id],
  reasonTooltip: false,
});

function useOwner(key: ModeOwned, placement: Placement) {
  const p = usePersonalize();
  const overridden = p.overrides.includes(key);
  const modeName = p.modeName(p.mode);
  const modeIcon = ((p.modes.find(m => m.id === p.mode)?.icon as IconName | undefined) ?? 'star') as IconName;
  const state: TileState = overridden ? 'overridden' : placement === 'ranked' ? 'context' : 'default';
  // What you change here is saved to the active profile, and the tile says so
  // for a moment ("Saved to Gaming") — then goes quiet again. `overridden` is
  // left only for a suggestion you accepted, which is temporary and has its
  // own Undo.
  const justSaved = p.saved?.key === key;
  const badge = overridden ? (
    <Badge variant="status" tone="neutral">
      Changed
    </Badge>
  ) : justSaved ? (
    <span role="status" className="qc-saved">
      <Badge variant="status" tone="positive">
        Saved to {modeName}
      </Badge>
    </span>
  ) : undefined;
  const reset = () => p.resetOwned(key);
  const save = () => p.saveToMode(key);
  // A changed value offers both ways out: keep it as the mode's own, or go back.
  const changedActions = (
    <>
      <TileLink icon="reset" onClick={reset}>
        Reset
      </TileLink>
      <TileLink
        icon="check"
        aria-label={`Keep this in the ${modeName} profile`}
        title={`Keep this in the ${modeName} profile`}
        onClick={save}
      >
        Save
      </TileLink>
    </>
  );
  return {
    overridden,
    modeName,
    modeIcon,
    state,
    badge,
    reset,
    save,
    changedActions,
  };
}

/** Open a feature modal (`?modal=…`) over the page, keeping its other params. */
function useOpenModal() {
  const [params, setParams] = useSearchParams();
  return (modal: string, extra: Record<string, string> = {}) => {
    const next = new URLSearchParams(params);
    next.set('modal', modal);
    Object.entries(extra).forEach(([k, v]) => next.set(k, v));
    setParams(next);
  };
}

/** Props that make a whole tile open something — like a Perform card. Clicks on
 *  the controls inside it (buttons, toggles, links, the reason icon) stay theirs. */
function tileOpens(label: string, open: () => void) {
  const fromTileItself = (e: React.SyntheticEvent) => {
    const target = e.target as HTMLElement;
    return target === e.currentTarget || target.closest('button, a, input, [tabindex]') === e.currentTarget;
  };
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    'aria-haspopup': 'dialog' as const,
    onClick: (e: React.MouseEvent) => {
      if (fromTileItself(e)) open();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      open();
    },
  };
}

// ── Lighting (full row) ──────────────────────────────────────────────────────
// The desk, lit the way it is right now. Lighting belongs to the active profile
// (Settings' `deskLighting`, overridden per profile), so this tile shows what
// the profile in the nav switcher is wearing — there is no second switcher here.
// Clicking it opens the list of devices with lights, each a door to its own
// window (2026-10-21: no whole-desk editor); the toggle turns the desk lights off.
export function LightingTile({ onPick }: { onPick?: (id: DeviceId) => void } = {}) {
  const p = usePersonalize();
  const { has } = useModules();
  const openModal = useOpenModal();
  const [params] = useSearchParams();
  const { on, setOn } = useLightsPower();
  const [view, setView] = useState<CameraView>('front');
  const lit = p.desk.lighting;
  const read = useLookReader(lit);
  const name = p.modeName(p.mode);

  const openLighting = () => openModal('lighting');

  return (
    <Tile
      size="full"
      state="context"
      title="Lighting"
      className="qc-desk qc-opens"
      id="qc-lighting"
      {...tileOpens(`Devices with lights — ${lightingSummary(lit, read)}`, openLighting)}
      controls={
        <span className="qc-desk-light-head">
          <Toggle checked={on} onChange={setOn} aria-label="Desk lighting" />
        </span>
      }
    >
      {/* What the desk is wearing, and whose it is. */}
      <div className="qc-desk-mode">
        <div className="qc-mode-name">{lightingSummary(lit, read)}</div>
        {/* Where each look is, then whose lighting this is. Audio and mic
            used to ride on this line; they are not lighting, and they have
            their own tiles. */}
        <span className="qc-mode-summary">
          {lightingSpread(lit, read)} · Saved in the {name} profile
        </span>
      </div>

      {/* The lit desk, full width. Anywhere on the tile opens the device list. */}
      {/* A click on the desk belongs to the device you clicked — it opens that
          device's own settings. The footer link is what opens the list. */}
      <div className="qc-desk-light" onClick={onPick ? e => e.stopPropagation() : undefined}>
        {has('lightstudio') ? (
          <Suspense fallback={<div className="qc-desk-fallback">Loading desk…</div>}>
            <LightStudio
              compact
              // A modal or a device panel over the page hides the desk; it stops
              // drawing so what is on top stays responsive.
              covered={params.has('modal') || params.has('sku')}
              cameraView={view}
              states={lit}
              onStatesChange={p.replaceLighting}
              onSelect={ids => ids.length === 1 && onPick?.(ids[0])}
            />
          </Suspense>
        ) : (
          <div className="qc-desk-fallback">{lightingSummary(lit, read)}</div>
        )}
      </div>

      {/* Bottom: the camera views under the desk on the left, the way in on the
          right — where every other tile puts its footer link. The whole tile
          opens the modal; this link is what says so. */}
      <div className="qc-desk-bottom">
        <ToggleButtonGroup
          aria-label="Camera view"
          options={CAMERA_VIEWS.map(v => ({ value: v.id, label: v.label }))}
          value={view}
          onChange={v => setView(v as CameraView)}
        />
        <span className="ds-quick-tile-actions">
          {/* The Undo for a profile switch lives in the profile band, once. */}
          <TileLink chevron aria-haspopup="dialog" onClick={openLighting}>
            Devices with lights
          </TileLink>
        </span>
      </div>
    </Tile>
  );
}

// ── Small tiles ──────────────────────────────────────────────────────────────
// Quick Control: each small tile offers the few choices people actually switch
// between, as buttons — one tap, no dropdowns, no sliders. The full range lives
// on the device page (the footer link). On/off stays a toggle in the header.

/** One row of quick choices in equal columns, none narrower than its label. A
 *  value outside them (set on the device page) simply selects none — the tile's
 *  value line still shows it. */
/**
 * A level — anything whose value is a number the chips could never all carry.
 * Three chips over a 0-100 setting is how a tile ends up showing 40% with
 * nothing selected and no way back to it.
 */
export function QuickLevel({
  label,
  value,
  onChange,
  format = v => `${v}%`,
  step = 5,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  step?: number;
}) {
  return (
    <div className="qc-level">
      <Slider min={0} max={100} step={step} value={value} onChange={onChange} aria-label={label} />
      <span className="qc-level-value">{format(value)}</span>
    </div>
  );
}

export function QuickChoices<V extends string | number>({
  label,
  options,
  value,
  format,
  onPick,
  disabled,
}: {
  label: string;
  options: V[];
  value: V;
  format: (v: V) => string;
  onPick: (v: V) => void;
  disabled?: boolean;
}) {
  return (
    <div className="qc-choices" role="group" aria-label={label}>
      {options.map(v => (
        <Chip key={String(v)} selected={v === value} disabled={disabled} onClick={() => onPick(v)}>
          {format(v)}
        </Chip>
      ))}
    </div>
  );
}

/** Footer link to the device page that holds the full controls. */
/**
 * Keep this control at the front of the grid.
 *
 * Pinning is something you do TO a tile, not a mode the page enters: the old
 * "Your usual" section and its Edit mode are gone, so the only thing that
 * separates your controls from the ranked ones is this. Pinned tiles say so
 * always; the rest show it on hover or focus.
 */
function PinAction({ id }: { id: TileId }) {
  const p = usePersonalize();
  const pinned = p.pins.includes(id);
  return (
    <TileLink
      className={'qc-pin' + (pinned ? ' on' : '')}
      icon={pinned ? 'star-fill' : 'star'}
      aria-pressed={pinned}
      aria-label={pinned ? 'Pinned, click to unpin' : 'Keep this at the front'}
      title={pinned ? 'Pinned. Click to unpin.' : 'Keep this at the front'}
      onClick={() => (pinned ? p.unpin(id) : p.pin(id))}
    />
  );
}

// ── Audio EQ (S) ─────────────────────────────────────────────────────────────
export function EqTile(ctx: TileContext) {
  const p = usePersonalize();
  const owner = useOwner('eq', ctx.placement);
  return (
    <Tile
      {...gridProps('eq', ctx)}
      icon="eq"
      title="Audio EQ"
      state={owner.state}
      controls={owner.badge}
      {...deviceFoot('eq')}
      actions={
        <>
          {owner.overridden && owner.changedActions}
          <PinAction id="eq" />
        </>
      }
    >
      <QuickChoices<EqPreset>
        label="EQ preset"
        options={['fps', 'music', 'movie', 'voice', 'flat']}
        value={p.desk.eq}
        format={v => EQ_LABEL[v]}
        onPick={v => p.update({ eq: v }, 'eq')}
      />
    </Tile>
  );
}

// ── Microphone (S) ───────────────────────────────────────────────────────────
export function MicTile(ctx: TileContext) {
  const p = usePersonalize();
  const owner = useOwner('mic', ctx.placement);
  return (
    <Tile
      {...gridProps('mic', ctx)}
      icon="mic"
      title="Microphone"
      state={p.desk.micOn ? owner.state : 'attention'}
      controls={
        <>
          {owner.badge}
          <Toggle checked={p.desk.micOn} onChange={v => p.update({ micOn: v })} aria-label="Microphone on" />
        </>
      }
      value={p.desk.micOn ? undefined : 'Muted'}
      {...deviceFoot('mic')}
      actions={
        <>
          {owner.overridden && owner.changedActions}
          <PinAction id="mic" />
        </>
      }
    >
      <QuickChoices<MicPreset>
        label="Mic preset"
        options={['gaming', 'streaming', 'podcast', 'conference']}
        value={p.desk.micPreset}
        format={v => MIC_PRESET_LABEL[v]}
        onPick={v => p.update({ micPreset: v }, 'mic')}
        disabled={!p.desk.micOn}
      />
    </Tile>
  );
}

// ── Mouse buttons (S) ────────────────────────────────────────────────────────
export function ButtonsTile(ctx: TileContext) {
  const p = usePersonalize();
  return (
    <Tile
      {...gridProps('buttons', ctx)}
      icon="buttons"
      title="Mouse buttons"
      state={ctx.placement === 'ranked' ? 'context' : 'default'}
      controls={undefined}
      {...deviceFoot('buttons')}
      actions={<PinAction id="buttons" />}
    >
      <QuickChoices<ButtonLayout>
        label="Button layout"
        options={['default', 'valorant', 'productivity']}
        value={p.desk.buttons}
        format={v => BUTTONS_LABEL[v]}
        onPick={v => p.update({ buttons: v })}
      />
    </Tile>
  );
}

// ── Spatial audio (S) — on/off is the whole choice ───────────────────────────
export function SpatialTile(ctx: TileContext) {
  const p = usePersonalize();
  const owner = useOwner('spatial', ctx.placement);
  return (
    <Tile
      {...gridProps('spatial', ctx)}
      icon="spatial-audio"
      title="Spatial audio"
      state={owner.state}
      controls={
        <>
          {owner.badge}
          <Toggle
            checked={p.desk.spatial}
            onChange={v => p.update({ spatial: v }, 'spatial')}
            aria-label="Spatial audio"
          />
        </>
      }
      value={p.desk.spatial ? 'Hear360' : 'Off'}
      {...deviceFoot('spatial')}
      actions={
        <>
          {owner.overridden && owner.changedActions}
          <PinAction id="spatial" />
        </>
      }
    />
  );
}

// ── Sidetone (S) ─────────────────────────────────────────────────────────────
export function SidetoneTile(ctx: TileContext) {
  const p = usePersonalize();
  return (
    <Tile
      {...gridProps('sidetone', ctx)}
      icon="sidetone"
      title="Sidetone"
      state={ctx.placement === 'ranked' ? 'context' : 'default'}
      controls={undefined}
      {...deviceFoot('sidetone')}
      actions={<PinAction id="sidetone" />}
    >
      <QuickLevel
        label="Sidetone"
        value={p.desk.sidetone}
        format={v => (v === 0 ? 'Off' : `${v}%`)}
        onChange={v => p.update({ sidetone: v })}
      />
    </Tile>
  );
}

// ── Volume (S) ───────────────────────────────────────────────────────────────
// The control a desk gets touched for most, and the page never had it. A level,
// not chips: any value has to be reachable. Not profile-owned — a profile
// restores how the desk looks and sounds, not yesterday's volume.
export function VolumeTile(ctx: TileContext) {
  const p = usePersonalize();
  return (
    <Tile
      {...gridProps('volume', ctx)}
      icon="volume-up"
      title="Volume"
      state={ctx.placement === 'ranked' ? 'context' : 'default'}
      controls={undefined}
      {...deviceFoot('volume')}
      actions={<PinAction id="volume" />}
    >
      <QuickLevel label="Volume" value={p.desk.volume} onChange={v => p.update({ volume: v })} />
    </Tile>
  );
}

// ── Mouse DPI (S) ────────────────────────────────────────────────────────────
export function DpiTile(ctx: TileContext) {
  const p = usePersonalize();
  return (
    <Tile
      {...gridProps('dpi', ctx)}
      icon="sensor"
      title="Mouse DPI"
      state={ctx.placement === 'ranked' ? 'context' : 'default'}
      controls={undefined}
      {...deviceFoot('dpi')}
      actions={<PinAction id="dpi" />}
    >
      <QuickChoices<string>
        label="DPI preset"
        options={['800', '1600', '3200']}
        value={p.desk.dpi}
        format={v => v}
        onPick={v => p.update({ dpi: v })}
      />
    </Tile>
  );
}

export const TILE_LABEL: Record<TileId, string> = {
  mode: 'Mode',
  lighting: 'Lighting',
  eq: 'Audio EQ',
  mic: 'Microphone',
  buttons: 'Mouse buttons',
  spatial: 'Spatial audio',
  sidetone: 'Sidetone',
  dpi: 'Mouse DPI',
  volume: 'Volume',
};

export function renderTile(id: TileId, ctx: TileContext) {
  switch (id) {
    case 'mode':
      return <LightingTile key={id} />;
    case 'lighting':
      // Part of the Mode tile now; old saved layouts may still list it.
      return null;
    case 'eq':
      return <EqTile key={id} {...ctx} />;
    case 'mic':
      return <MicTile key={id} {...ctx} />;
    case 'buttons':
      return <ButtonsTile key={id} {...ctx} />;
    case 'spatial':
      return <SpatialTile key={id} {...ctx} />;
    case 'sidetone':
      return <SidetoneTile key={id} {...ctx} />;
    case 'dpi':
      return <DpiTile key={id} {...ctx} />;
    case 'volume':
      return <VolumeTile key={id} {...ctx} />;
  }
}

// ── Suggestion (row) ─────────────────────────────────────────────────────────
// One slim row under the context strip: the question, why (icon + tooltip), and
// the answers. Accepting turns it into a confirmation with Undo; Not now and
// Close remove the row. Nothing changes the desk until you accept.
export function SuggestionRow({ id }: { id: SuggestionId }) {
  const p = usePersonalize();
  const s = SUGGESTIONS[id];
  if (p.accepted[id]) {
    return (
      <Tile
        row
        className="qc-suggestion"
        icon="check"
        title={s.done}
        reason={s.reason}
        reasonIcon={s.reasonIcon}
        actions={
          <>
            <TileLink icon="undo" onClick={() => p.undoSuggestion(id)}>
              Undo
            </TileLink>
            <TileLink onClick={() => p.dismiss(id)}>Close</TileLink>
          </>
        }
      />
    );
  }
  return (
    <Tile
      row
      state="suggested"
      className="qc-suggestion"
      icon={s.icon}
      title={s.question}
      reason={s.reason}
      reasonIcon={s.reasonIcon}
      actions={
        <>
          <Button variant="accent" size="sm" onClick={() => p.accept(id, s.patch(p.desk), s.owned)}>
            {s.acceptLabel}
          </Button>
          <button type="button" className="qc-dismiss" aria-label="Not now" onClick={() => p.dismiss(id)}>
            <Icon name="close" size="sm" />
          </button>
        </>
      }
    />
  );
}
