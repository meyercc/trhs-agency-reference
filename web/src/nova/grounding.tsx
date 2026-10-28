/**
 * What Nova actually knows about this machine, and how the local model is told.
 *
 * `NOVA_SYSTEM` has always claimed Nova "know[s] the machine, the devices on the
 * desk and the active profile" and then handed the model nothing at all, so a
 * real reply invented device names and talked in generalities. This file is that
 * claim made true (TH-441).
 *
 * THREE RULES, each paid for by a failure mode:
 *
 *  1. The block is appended to the TAIL OF THE USER TURN, not the system message.
 *     Volatile state at the front of the prompt invalidates the KV prefix every
 *     turn, which on an M1 Pro is the most expensive thing available; and IBM
 *     Granite's chat template renders a system message only as `messages[0]`, so
 *     a second one appended later is SILENTLY DROPPED. At the tail it survives
 *     every template and an 8B model actually attends to it.
 *
 *  2. Omit rather than guess. No brightness number, because the real one resolves
 *     per display through `useBrightnessLevel(modesOf(sku.id), sku.id)` and a
 *     Settings-level value would be a confidently wrong number — exactly the
 *     failure grounding exists to prevent. Same for `monitorMode: ''`.
 *
 *  3. It is CAPPED. Grounding grows by someone adding "just one more line", and
 *     every line costs tokens on every turn, forever. `CONTEXT_CHAR_BUDGET` is
 *     the ceiling and verify-nova asserts it.
 *
 * Device names come from `getResolvedSku` — the same source `LiveControl`'s
 * `usePrimary` uses — so the name Nova says and the name the widget's head line
 * shows are one string, not two that drift.
 */
import { useCallback, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useSettings, type MvpScope } from '../state/Settings';
import { useProfiles } from '../state/Profiles';
import { useModules } from '../state/Modules';
import { useDeviceSim } from '../state/DeviceSim';
import { useNova } from '../state/Nova';
import { deskDeviceIds } from '../devices/connectedDevices';
import { getResolvedSku } from '../devices/skus';
import { fanSpeedAt } from '../state/fanCurve';
import { MODULES } from '../modules/registry';
import { catalogFor, type SurfaceCatalog } from './surfaces';
import type { LayoutContext } from '../widgets/layout';
import type { DeskDevice } from '../devices/arrangement';
import { DEFAULT_LAYOUT, type BoardItem } from '../widgets/catalog';
import { cardMetas } from '../widgets/cardMeta';
import type { CardSpec } from '../state/overlays';

export interface SnapshotDevice {
  id: string;
  name: string;
  type: string;
  /** Whether it is at this PC right now — the simulator's truth, not the roster's. */
  connected: boolean;
}
export interface SnapshotProfile {
  id: string;
  name: string;
  active: boolean;
}

export interface NovaSnapshot {
  at: number;
  /** Where the person is standing, e.g. `/perform`. */
  route: string;
  /** The `?modal=` id open over it, else null. */
  modal: string | null;
  /** The desk in `deskDeviceIds` order, with the sim's plugged-in truth. */
  devices: SnapshotDevice[];
  profiles: SnapshotProfile[];
  /** How the active profile came to be active: manual / schedule / game. */
  profileSource: string;
  /** Setting names the active profile is taking over. */
  overriding: string[];
  powerMode: string;
  /** The curve as one honest reading, rather than ten points of noise. */
  fanAt50: number;
  tempUnit: string;
  roomLight: string;
  /** Omitted from the rendered block when `''` — nobody has chosen one. */
  monitorMode: string;
  overlays: { title: string; visible: boolean }[];
  /** Installed module NAMES, for a sentence a person would recognise. */
  modules: string[];
  /** Installed module IDS, for narrowing the catalog. */
  moduleIds: string[];
  /** The Admin row's desk roster — what `isOnDesk` needs (TH-442). */
  deskDevices: DeskDevice[];
  /** Admin's MVP scope: what the board and the catalog leave out. */
  mvpScope: MvpScope;
  /**
   * The dashboard as it stands. Nova needs it for the UNDO chip, which has to
   * carry the board that really existed rather than recompute one — and for
   * `applyLayout`'s merge, which keeps the widgets a proposal cannot see.
   */
  boardLayout: BoardItem[];
  /**
   * The custom cards that exist (TH-443) — the whole spec, not a summary, because
   * `layoutContextOf` needs their sizes to recognise a `card-*` id on the board.
   */
  cards: CardSpec[];
}

export type NovaSnapshotGetter = () => NovaSnapshot;

const MAX_DEVICES = 8;
const MAX_PROFILES = 8;
const MAX_OVERLAYS = 4;
/** The hard ceiling on the rendered block. See rule 3 above. */
export const CONTEXT_CHAR_BUDGET = 1600;

/**
 * Reads the real stores. Only callable BELOW `DeviceSimProvider` and inside the
 * router — which `NovaProvider` is not (see main.tsx). That is the whole reason
 * this is a hook handed down rather than something the provider does itself.
 *
 * Returns a GETTER, not a value: the provider calls it at send time, so the
 * snapshot is always current, and nothing here re-renders the tree.
 */
export function useNovaSnapshot(): NovaSnapshotGetter {
  const settings = useSettings();
  const { profiles, activeId, activeProfile, source } = useProfiles();
  const { has } = useModules();
  const { simState } = useDeviceSim();
  const pathname = useLocation().pathname;
  const [searchParams] = useSearchParams();
  const modal = searchParams.get('modal');

  return useCallback((): NovaSnapshot => {
    const moduleIds = MODULES.filter((m) => has(m.id)).map((m) => m.id);
    const devices: SnapshotDevice[] = deskDeviceIds(settings.deskDevices)
      .slice(0, MAX_DEVICES)
      .map((id) => {
        const sku = getResolvedSku(id);
        return {
          id,
          name: sku?.name ?? id,
          type: sku?.type ?? 'device',
          connected: simState(id).connected,
        };
      });
    // `settings.fanCurve` / `.overlays` arrive already normalized and
    // profile-resolved from Settings — do not re-normalize, or a profile
    // override would be silently dropped back to the raw stored value.
    const overlays = settings.overlays
      .slice(0, MAX_OVERLAYS)
      .map((o) => ({ title: o.title, visible: o.visible }));

    return {
      at: Date.now(),
      route: pathname,
      modal,
      devices,
      profiles: profiles.slice(0, MAX_PROFILES).map((p) => ({ id: p.id, name: p.name, active: p.id === activeId })),
      profileSource: source,
      overriding: Object.keys(activeProfile.overrides ?? {}),
      powerMode: settings.powerMode,
      fanAt50: Math.round(fanSpeedAt(settings.fanCurve, 50)),
      tempUnit: settings.tempUnit,
      roomLight: settings.roomLight,
      monitorMode: settings.monitorMode,
      overlays,
      modules: MODULES.filter((m) => has(m.id)).map((m) => m.name),
      moduleIds,
      deskDevices: settings.deskDevices,
      mvpScope: settings.mvpScope,
      boardLayout: settings.boardLayout ?? DEFAULT_LAYOUT,
      cards: settings.cards,
    };
  }, [settings, profiles, activeId, activeProfile, source, has, simState, pathname, modal]);
}

/**
 * The snapshot as a `LayoutContext`, so the Nova provider can ask what is
 * renderable without reaching the three stores it sits above (main.tsx). The
 * snapshot already carries all three absences; this just re-shapes them.
 */
export function layoutContextOf(snap: NovaSnapshot): LayoutContext {
  const connected = new Map(snap.devices.map((d) => [d.id, d.connected]));
  return {
    cards: cardMetas(snap.cards),
    gate: {
      has: (m) => snap.moduleIds.includes(m),
      desk: snap.deskDevices,
      connected: (sku) => connected.get(sku) ?? false,
      deviceTypes: snap.devices.map((d) => d.type),
      scope: snap.mvpScope,
    },
  };
}

/** The catalog this snapshot makes performable. */
export function catalogOf(snap: NovaSnapshot): SurfaceCatalog {
  return catalogFor(
    snap.moduleIds,
    snap.devices.map((d) => d.type),
    snap.profiles,
  );
}

/**
 * The `<nova-context>` block. Pure, so it is the one readable place the honesty
 * rules live — and so a test can render it without a browser.
 *
 * Truncation is on a LINE boundary: half a line of state reads as a fact with
 * its qualifier cut off, which is worse than the line being absent.
 */
export function renderSnapshot(snap: NovaSnapshot, cat: SurfaceCatalog): string {
  const lines: string[] = [];

  lines.push(`route: ${snap.route}${snap.modal ? ` (${snap.modal} open over it)` : ' (no modal open)'}`);

  const active = snap.profiles.find((p) => p.active);
  if (active) {
    const how =
      snap.profileSource === 'manual' ? 'chosen by you' : snap.profileSource === 'schedule' ? 'opened by a schedule' : `started by a game`;
    const over = snap.overriding.length ? `; overrides: ${snap.overriding.join(', ')}` : '';
    lines.push(`profile: ${active.name} (${how})${over}`);
  }

  if (snap.devices.length) {
    lines.push(
      `desk: ${snap.devices.map((d) => `${d.name} (${d.type}, ${d.connected ? 'connected' : 'away'})`).join(' · ')}`,
    );
  }

  const bits = [`power mode: ${snap.powerMode}`, `fan curve: ${snap.fanAt50}% at 50°${snap.tempUnit}`, `room: ${snap.roomLight}`];
  // Rule 2: '' means nobody chose one. Say nothing rather than invent a mode.
  if (snap.monitorMode) bits.push(`display mode: ${snap.monitorMode}`);
  lines.push(bits.join(' · '));

  if (snap.overlays.length) {
    lines.push(`overlays: ${snap.overlays.map((o) => `${o.title} (${o.visible ? 'on screen' : 'hidden'})`).join(' · ')}`);
  }
  if (snap.modules.length) lines.push(`installed: ${snap.modules.join(', ')}`);

  if (cat.routes.length) lines.push(`can go: ${cat.routes.map((r) => `${r.to} ${r.label}`).join(' · ')}`);
  if (cat.modals.length) lines.push(`can open: ${cat.modals.map((m) => `${m.id} ${m.label}`).join(' · ')}`);
  if (cat.profiles.length) lines.push(`can switch: ${cat.profiles.map((p) => `${p.id} ${p.name}`).join(' · ')}`);
  if (cat.controls.length) lines.push(`can bind: ${cat.controls.map((c) => c.kind).join(' · ')}`);

  let body = lines.join('\n');
  if (body.length > CONTEXT_CHAR_BUDGET) {
    const cut = body.lastIndexOf('\n', CONTEXT_CHAR_BUDGET);
    body = body.slice(0, cut > 0 ? cut : CONTEXT_CHAR_BUDGET);
  }
  return `<nova-context>\n${body}\n</nova-context>`;
}

/**
 * Hands `NovaProvider` the snapshot getter, exactly as AppShell hands it
 * `registerActions`. Renders nothing.
 *
 * It lives in the SHELL, not the Nova page, for the TH-434 reason the actions
 * do: a reply sent from the pinned panel on /perform must be grounded too — and
 * "where the person is standing" is only interesting BECAUSE they are not on
 * /nova.
 */
export function NovaContextBridge(): null {
  const { registerContext } = useNova();
  const get = useNovaSnapshot();
  useEffect(() => {
    registerContext(get);
    return () => registerContext(null);
  }, [registerContext, get]);
  return null;
}
