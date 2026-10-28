/**
 * What Nova can truthfully talk about doing — the app's surfaces as data.
 *
 * Two jobs, one list. It is what the local model is TOLD the app contains, so
 * it stops inventing a "Settings tab"; and it is the allowlist a model-emitted
 * action will be validated against (TH-442). Those must be the same list or the
 * model is taught one thing and checked against another.
 *
 * No React and no storage here on purpose: `catalogFor` is a pure narrowing of
 * the static tables by what this install actually has, so it is readable as the
 * one place "what is reachable right now" is decided.
 *
 * ⚠️ `ROUTE_SURFACES` mirrors `TABS` in app/AppShell.tsx and `MODAL_SURFACES`
 * mirrors the ids modals/FeatureModalHost.tsx switches on. Nothing makes them
 * agree at compile time, so verify-nova checks the routes against the rendered
 * nav. Add a tab or a modal there and add it here.
 */
import { MODAL_MODULE, NAV_MODULE } from '../modules/registry';
import { CONTROL_META, type DeviceNeed, type OverlayControl } from '../state/overlays';

export interface RouteSurface {
  to: string;
  label: string;
  /** The module that gates it, if any — `NAV_MODULE`'s value for the tab. */
  module?: string;
}
export interface ModalSurface {
  id: string;
  label: string;
  module?: string;
}
export interface ProfileSurface {
  id: ProfileActionId;
  name: string;
}
export interface ControlSurface {
  kind: OverlayControl;
  label: string;
  /** The device type `LiveControl` binds to. Absent = it binds to Settings. */
  needs?: DeviceNeed;
}

/**
 * The three ids `selectProfile` can carry. `NovaActionCall` narrows the type to
 * these literals, so this doubles as the compile-time allowlist: a model-supplied
 * string reaches that union only through `isProfileActionId`.
 */
export const PROFILE_ACTION_IDS = ['gaming', 'work', 'silent'] as const;
export type ProfileActionId = (typeof PROFILE_ACTION_IDS)[number];

export function isProfileActionId(id: string): id is ProfileActionId {
  return (PROFILE_ACTION_IDS as readonly string[]).includes(id);
}

/** Mirrors `TABS` in app/AppShell.tsx, in nav order. */
export const ROUTE_SURFACES: RouteSurface[] = [
  { to: '/', label: 'Home' },
  { to: '/perform', label: 'Performance' },
  { to: '/personalize', label: 'Personalize' },
  { to: '/play', label: 'Play' },
  { to: '/shop', label: 'Shop', module: NAV_MODULE.shop },
  // No '/nova': Nova left the nav (2026-10-20), and this list mirrors it. The
  // full page is the sidebar's expand button away.
];

/**
 * The `?modal=` ids modals/FeatureModalHost.tsx renders — minus `admin`, which
 * is internal tooling and not a thing to offer anyone.
 */
export const MODAL_SURFACES: ModalSurface[] = [
  { id: 'omenai', label: 'OMEN AI', module: MODAL_MODULE.omenai },
  { id: 'booster', label: 'Booster', module: MODAL_MODULE.booster },
  { id: 'vitals', label: 'System Vitals', module: MODAL_MODULE.vitals },
  { id: 'settings', label: 'Settings' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'modules', label: 'Module Browser' },
  { id: 'agents', label: 'Forge' },
];

/**
 * The live controls a reply can carry — DERIVED from the card vocabulary's own
 * table (TH-450), so a control added there is taught and allowed here without
 * a second list to forget. `overlay`, `layout` and `card` are not controls: each
 * is built by its own builder from a spec, never named as a bare kind.
 */
export const CONTROL_SURFACES: ControlSurface[] = (Object.keys(CONTROL_META) as OverlayControl[]).map((kind) => ({
  kind,
  label: CONTROL_META[kind].label,
  ...(CONTROL_META[kind].needs ? { needs: CONTROL_META[kind].needs } : {}),
}));

export interface SurfaceCatalog {
  routes: RouteSurface[];
  modals: ModalSurface[];
  profiles: ProfileSurface[];
  controls: ControlSurface[];
}

/**
 * Everything the CODE can perform, ungated — the fallback when no snapshot is
 * registered (Storybook, a test, the moment before the shell's effect runs).
 * Deliberately permissive: with no snapshot we do not know what is installed,
 * and silently claiming nothing is reachable would be its own wrong answer.
 */
export const STATIC_CATALOG: SurfaceCatalog = {
  routes: ROUTE_SURFACES,
  modals: MODAL_SURFACES,
  profiles: PROFILE_ACTION_IDS.map((id) => ({ id, name: titleCase(id) })),
  controls: CONTROL_SURFACES,
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** What a module-gated surface needs, against the installed set. */
function installed(module: string | undefined, modules: readonly string[]): boolean {
  return !module || modules.includes(module);
}

/**
 * What is performable RIGHT NOW: the static tables narrowed by the modules this
 * install has and the devices on this desk.
 *
 * A control whose device type is absent is DROPPED rather than offered. On a
 * hand-written script `LiveControl` renders an honest "No headset on this desk."
 * card, which is correct there — the author meant it. Reached because a model
 * guessed, the same card is dead furniture, so it never gets the chance.
 *
 * `moduleIds` and `deviceTypes` are passed in rather than read, so this stays
 * pure and the caller (grounding.tsx) owns every hook.
 */
export function catalogFor(moduleIds: readonly string[], deviceTypes: readonly string[], profiles: readonly { id: string; name: string }[]): SurfaceCatalog {
  return {
    routes: ROUTE_SURFACES.filter((r) => installed(r.module, moduleIds)),
    modals: MODAL_SURFACES.filter((m) => installed(m.module, moduleIds)),
    // The live profile list, intersected with the three ids an action can carry.
    profiles: profiles.filter((p): p is ProfileSurface => isProfileActionId(p.id)),
    controls: CONTROL_SURFACES.filter((c) => !c.needs || deviceTypes.includes(c.needs)),
  };
}
