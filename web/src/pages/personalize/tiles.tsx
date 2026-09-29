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
  lightingSummary,
  type ButtonLayout,
  type EqPreset,
  type MicPreset,
  type ModeOwned,
  type TileId,
} from './model';
import { SUGGESTIONS } from './suggestions';
import { useActiveContext, usePersonalize } from './state';
import { useLightsPower } from './LightingModal';
import { CAMERA_VIEWS } from '../../lightstudio/lighting';
import type { CameraView, DeviceId } from '../../lightstudio/scene';

const LightStudio = lazy(() => import('../../lightstudio/LightStudio').then((m) => ({ default: m.LightStudio })));
import type { SuggestionId } from './model';

/** Where a tile sits decides its state: ranked by context, pinned, or overridden. */
export type Placement = 'ranked' | 'pinned';

interface TileContext {
  placement: Placement;
}

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
const onDevice = (id: TileId, reason: string) => (DEVICE_OF[id] ? `${DEVICE_OF[id]} · ${reason}` : reason);

function useOwner(key: ModeOwned, placement: Placement) {
  const p = usePersonalize();
  const scenario = useActiveContext();
  const overridden = p.overrides.includes(key);
  const modeName = p.modeName(p.mode);
  const modeIcon = ((p.modes.find((m) => m.id === p.mode)?.icon as IconName | undefined) ?? 'star') as IconName;
  const state: TileState = overridden ? 'overridden' : placement === 'ranked' ? 'context' : 'default';
  // Quiet by default: a tile says nothing about its owner until you've changed
  // it (the reason icon still names the mode on hover).
  const badge = overridden ? (
    <Badge variant="status" tone="neutral">
      Changed
    </Badge>
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
  // A tile that context put in front of you has to say so — a list that
  // reorders itself and won't explain is a list people learn to ignore. The
  // signal stays in the icon's tooltip (Kristy, Sept 15: no "Because ·" line).
  const ranked = placement === 'ranked' && !overridden;
  const reasonIcon: IconName = overridden ? 'edit' : ranked ? scenario.icon : modeIcon;
  const ownerReason = overridden
    ? `You changed this. Keep it for ${modeName}, or put it back the way ${modeName} had it.`
    : ranked
      ? `Up here now — ${scenario.modeReason}. The ${modeName} profile set it.`
      : `You pinned this. The ${modeName} profile set it.`;
  return {
    overridden,
    modeName,
    modeIcon,
    state,
    badge,
    reset,
    save,
    changedActions,
    reasonIcon,
    ownerReason: onDevice(key as TileId, ownerReason),
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
// The desk, lit the way it is right now. Lighting is page-local for now (it does
// not follow the profile until the desk is reconciled onto the per-device profile
// keys the device panels use), so this tile shows the desk, not a profile.
// Clicking it opens Light Studio; the toggle turns the desk lights off.
export function LightingTile({ onPick }: { onPick?: (id: DeviceId) => void } = {}) {
  const p = usePersonalize();
  const { has } = useModules();
  const openModal = useOpenModal();
  const scenario = useActiveContext();
  const { on, setOn } = useLightsPower();
  const [view, setView] = useState<CameraView>('front');
  const auto = p.autoSwitch && p.autoSwitch.to === p.mode;
  const lit = p.desk.lighting;
  const name = p.modeName(p.mode);

  const openLighting = () => openModal('lighting');

  return (
    <Tile
      size="full"
      state="context"
      title="Lighting"
      className="qc-desk qc-opens"
      id="qc-lighting"
      {...tileOpens(`Change the desk lighting — ${lightingSummary(lit)}`, openLighting)}
      controls={
        <span className="qc-desk-light-head">
          <Toggle checked={on} onChange={setOn} aria-label="Desk lighting" />
        </span>
      }
    >
      {/* What the desk is wearing, and whose it is. */}
      <div className="qc-desk-mode">
        <div className="qc-mode-name">{lightingSummary(lit)}</div>
        <span className="qc-mode-summary">
          {EQ_LABEL[p.desk.eq]} audio · {MIC_PRESET_LABEL[p.desk.micPreset]} mic · {name} profile
        </span>
      </div>

      {/* The lit desk, full width. Anywhere on the tile opens Light Studio. */}
      {/* A click on the desk belongs to the device you clicked — it opens that
          device's own settings. The footer link is what opens the studio. */}
      <div className="qc-desk-light" onClick={onPick ? (e) => e.stopPropagation() : undefined}>
        {has('lightstudio') ? (
          <Suspense fallback={<div className="qc-desk-fallback">Loading desk…</div>}>
            <LightStudio
              compact
              cameraView={view}
              states={lit}
              onStatesChange={p.replaceLighting}
              onSelect={(ids) => ids.length === 1 && onPick?.(ids[0])}
            />
          </Suspense>
        ) : (
          <div className="qc-desk-fallback">{lightingSummary(lit)}</div>
        )}
      </div>

      {/* Bottom: the camera views under the desk on the left, the way in on the
          right — where every other tile puts its footer link. The whole tile
          opens the modal; this link is what says so. */}
      <div className="qc-desk-bottom">
        <ToggleButtonGroup
          aria-label="Camera view"
          options={CAMERA_VIEWS.map((v) => ({ value: v.id, label: v.label }))}
          value={view}
          onChange={(v) => setView(v as CameraView)}
        />
        <span className="ds-quick-tile-actions">
          {auto && (
            <TileLink icon="undo" title={`Switched by itself because ${scenario.modeReason}`} onClick={p.undoAutoSwitch}>
              Undo auto-switch
            </TileLink>
          )}
          <TileLink chevron aria-haspopup="dialog" onClick={openLighting}>
            Light Studio
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
function QuickLevel({
  label,
  value,
  onChange,
  format = (v) => `${v}%`,
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

function QuickChoices<V extends string | number>({
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
      {options.map((v) => (
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
export function EqTile({ placement }: TileContext) {
  const p = usePersonalize();
  const owner = useOwner('eq', placement);
  return (
    <Tile
      icon="eq"
      title="Audio EQ"
      state={placement === 'pinned' && !owner.overridden ? 'default' : owner.state}
      controls={owner.badge}
      reason={owner.ownerReason}
      reasonIcon={owner.reasonIcon}
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
        format={(v) => EQ_LABEL[v]}
        onPick={(v) => p.update({ eq: v }, 'eq')}
      />
    </Tile>
  );
}

// ── Microphone (S) ───────────────────────────────────────────────────────────
export function MicTile({ placement }: TileContext) {
  const p = usePersonalize();
  const owner = useOwner('mic', placement);
  const scenario = useActiveContext();
  // Only a tile CONTEXT put here may claim a signal: a pinned one is here
  // because you pinned it, and saying otherwise is the tile lying.
  const signal =
    placement !== 'ranked'
      ? null
      : scenario.id === 'valorant'
        ? 'Up here because you’re in a Discord call'
        : scenario.id === 'meeting'
          ? 'Up here because your Teams call starts at 7:00 PM'
          : scenario.id === 'stream'
            ? 'Up here because you’re about to go live'
            : null;
  const micReason = !p.desk.micOn
    ? 'Muted — people can’t hear you'
    : p.desk.micNoise
      ? 'Noise reduction is on'
      : owner.overridden
        ? owner.ownerReason
        : (signal ? onDevice('mic', signal) : owner.ownerReason);
  const micIcon: IconName = !p.desk.micOn ? 'alert' : p.desk.micNoise ? 'mic' : owner.overridden ? 'edit' : signal ? 'stream' : owner.modeIcon;
  return (
    <Tile
      icon="mic"
      title="Microphone"
      state={p.desk.micOn ? (placement === 'pinned' && !owner.overridden ? 'default' : owner.state) : 'attention'}
      controls={<Toggle checked={p.desk.micOn} onChange={(v) => p.update({ micOn: v })} aria-label="Microphone on" />}
      value={p.desk.micOn ? undefined : 'Muted'}
      reason={micReason}
      reasonIcon={micIcon}
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
        format={(v) => MIC_PRESET_LABEL[v]}
        onPick={(v) => p.update({ micPreset: v }, 'mic')}
        disabled={!p.desk.micOn}
      />
    </Tile>
  );
}

// ── Mouse buttons (S) ────────────────────────────────────────────────────────
export function ButtonsTile({ placement }: TileContext) {
  const p = usePersonalize();
  const scenario = useActiveContext();
  const auto = scenario.id === 'valorant' && p.desk.buttons === 'valorant';
  return (
    <Tile
      icon="buttons"
      title="Mouse buttons"
      state={auto && placement === 'ranked' ? 'context' : 'default'}
      reason={onDevice('buttons', auto ? 'Switched by itself while Valorant is running' : 'Button layout')}
      reasonIcon={auto ? 'stream' : 'buttons'}
      actions={<PinAction id="buttons" />}
    >
      <QuickChoices<ButtonLayout>
        label="Button layout"
        options={['default', 'valorant', 'productivity']}
        value={p.desk.buttons}
        format={(v) => BUTTONS_LABEL[v]}
        onPick={(v) => p.update({ buttons: v })}
      />
    </Tile>
  );
}

// ── Spatial audio (S) — on/off is the whole choice ───────────────────────────
export function SpatialTile({ placement }: TileContext) {
  const p = usePersonalize();
  const owner = useOwner('spatial', placement);
  return (
    <Tile
      icon="spatial-audio"
      title="Spatial audio"
      state={placement === 'pinned' && !owner.overridden ? 'default' : owner.state}
      controls={
        <>
          {owner.badge}
          <Toggle
            checked={p.desk.spatial}
            onChange={(v) => p.update({ spatial: v }, 'spatial')}
            aria-label="Spatial audio"
          />
        </>
      }
      value={p.desk.spatial ? 'Hear360' : 'Off'}
      reason={owner.ownerReason}
      reasonIcon={owner.reasonIcon}
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
export function SidetoneTile(_: TileContext) {
  const p = usePersonalize();
  return (
    <Tile
      icon="sidetone"
      title="Sidetone"
      reason={onDevice('sidetone', 'How much of your own voice you hear')}
      reasonIcon="audio-headset"
      actions={<PinAction id="sidetone" />}
    >
      <QuickLevel
        label="Sidetone"
        value={p.desk.sidetone}
        format={(v) => (v === 0 ? 'Off' : `${v}%`)}
        onChange={(v) => p.update({ sidetone: v })}
      />
    </Tile>
  );
}

// ── Volume (S) ───────────────────────────────────────────────────────────────
// The control a desk gets touched for most, and the page never had it. A level,
// not chips: any value has to be reachable. Not profile-owned — a profile
// restores how the desk looks and sounds, not yesterday's volume.
export function VolumeTile(_: TileContext) {
  const p = usePersonalize();
  return (
    <Tile
      icon="volume-up"
      title="Volume"
      reason={onDevice('volume', 'How loud the headset is')}
      reasonIcon="audio-headset"
      actions={<PinAction id="volume" />}
    >
      <QuickLevel label="Volume" value={p.desk.volume} onChange={(v) => p.update({ volume: v })} />
    </Tile>
  );
}

// ── Mouse DPI (S) ────────────────────────────────────────────────────────────
export function DpiTile(_: TileContext) {
  const p = usePersonalize();
  return (
    <Tile
      icon="sensor"
      title="Mouse DPI"
      reason={onDevice('dpi', 'How fast the pointer moves')}
      reasonIcon="sensor"
      actions={<PinAction id="dpi" />}
    >
      <QuickChoices<string>
        label="DPI preset"
        options={['800', '1600', '3200']}
        value={p.desk.dpi}
        format={(v) => v}
        onPick={(v) => p.update({ dpi: v })}
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
