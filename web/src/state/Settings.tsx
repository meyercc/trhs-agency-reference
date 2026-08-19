import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light' | 'system';
/** Spacing density. `comfortable` is the design-system default. */
export type Density = 'comfortable' | 'compact';
export type TempUnit = 'C' | 'F';
export interface DisplayArrange {
  mode: 'extend' | 'mirror';
  // Tile top-left as a fraction of the stage box (0–1) when `space` says so.
  // Payloads without the tag predate the shared arrangement and are ignored —
  // they were pixels on whichever stage happened to save them (devices/arrangement.ts).
  positions: Record<string, { left: number; top: number }>;
  space?: 'fraction';
}

// KVM routing for a KVM-capable monitor. Shared so the monitor's KVM tab and the
// peripheral device cards agree on which PC currently owns the keyboard + mouse.
// `configured` gates the "set up KVM" discoverability prompt (off until set up).
export interface KvmState {
  configured: boolean;
  activePc: 'pc1' | 'pc2';
  moveKbm: boolean;
}
export const DEFAULT_KVM: KvmState = { configured: false, activePc: 'pc1', moveKbm: true };

// ── Schema ───────────────────────────────────────────────────────────────────
// Single source of truth for persisted settings — the React port of
// settings-manager.js. `key` is the localStorage key; `default` the fallback.
// New settings drop in by adding a row here (and an accessor below if desired).
type SettingType = 'string' | 'bool' | 'json' | 'number';
interface Spec {
  key: string;
  type: SettingType;
  default: unknown;
}
const SCHEMA = {
  theme: { key: 'theme', type: 'string', default: 'dark' },
  accent: { key: 'accent', type: 'string', default: 'cyan' },
  // Spacing density — re-points --gutter (24px → the 12px tablet step) for the
  // whole app. See the density block in shared/tokens.css.
  density: { key: 'density', type: 'string', default: 'comfortable' },
  tempUnit: { key: 'tempUnit', type: 'string', default: 'C' },
  activeProfileId: { key: 'activeProfileId', type: 'string', default: 'gaming' },
  powerMode: { key: 'powerMode', type: 'string', default: 'balanced' },
  displayArrange: { key: 'displayArrange', type: 'json', default: null },
  kvm: { key: 'kvm', type: 'json', default: null },
  // First-boot onboarding: the assembled persona ('' until onboarded) and a flag
  // marking the flow complete. Persona curates defaults; never shown to the user.
  persona: { key: 'persona', type: 'string', default: '' },
  onboarded: { key: 'onboarded', type: 'bool', default: false },
  // Wallpaper preset id + the blur (px, 0–60) / opacity (%, 0–100) of the
  // background layer. Ported from vanilla js/theme.js.
  wallpaper: { key: 'wallpaper', type: 'string', default: 'red' },
  wpBlur: { key: 'wpBlur', type: 'number', default: 44 },
  wpOpacity: { key: 'wpOpacity', type: 'number', default: 100 },
  // Top-nav visibility (ported from vanilla js/settings.js). Both default off
  // (labels + icons shown); toggling on hides that element for icon-/text-only nav.
  hideNavLabels: { key: 'hideNavLabels', type: 'bool', default: false },
  hideNavIcons: { key: 'hideNavIcons', type: 'bool', default: false },
} satisfies Record<string, Spec>;
export type SettingName = keyof typeof SCHEMA;

// ── typed localStorage encode/decode ─────────────────────────────────────────
function decode(raw: string | null, spec: Spec): unknown {
  if (raw === null) return spec.default;
  switch (spec.type) {
    case 'bool':
      return raw === '1' || raw === 'true';
    case 'json':
      try {
        return JSON.parse(raw);
      } catch {
        return spec.default;
      }
    case 'number': {
      const n = Number(raw);
      return Number.isNaN(n) ? spec.default : n;
    }
    default:
      return raw;
  }
}
function encode(value: unknown, spec: Spec): string {
  switch (spec.type) {
    case 'bool':
      return value ? '1' : '0';
    case 'json':
      return JSON.stringify(value);
    default:
      return value == null ? '' : String(value);
  }
}
function readAll(): Record<SettingName, unknown> {
  const out = {} as Record<SettingName, unknown>;
  (Object.keys(SCHEMA) as SettingName[]).forEach((name) => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SCHEMA[name].key);
    } catch {
      /* storage unavailable */
    }
    out[name] = decode(raw, SCHEMA[name]);
  });
  return out;
}

function resolveLight(theme: Theme): boolean {
  if (theme === 'system') return window.matchMedia('(prefers-color-scheme: light)').matches;
  return theme === 'light';
}

interface SettingsValue {
  /** Generic typed getter/setter — the schema-driven core. */
  get: <T = unknown>(name: SettingName) => T;
  set: (name: SettingName, value: unknown) => void;
  // convenience accessors
  theme: Theme;
  setTheme: (t: Theme) => void;
  accent: string;
  setAccent: (a: string) => void;
  density: Density;
  setDensity: (d: Density) => void;
  tempUnit: TempUnit;
  setTempUnit: (u: TempUnit) => void;
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  powerMode: string;
  setPowerMode: (m: string) => void;
  displayArrange: DisplayArrange | null;
  setDisplayArrange: (d: DisplayArrange) => void;
  kvm: KvmState;
  setKvm: (k: KvmState) => void;
  persona: string;
  setPersona: (p: string) => void;
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
  wallpaper: string;
  setWallpaper: (id: string) => void;
  wpBlur: number;
  setWpBlur: (px: number) => void;
  wpOpacity: number;
  setWpOpacity: (pct: number) => void;
  hideNavLabels: boolean;
  setHideNavLabels: (on: boolean) => void;
  hideNavIcons: boolean;
  setHideNavIcons: (on: boolean) => void;
  /** Resolved light/dark (follows the system pref when theme is `system`). */
  isLight: boolean;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/**
 * Schema-driven settings store (React port of settings-manager.js): one typed
 * source of truth persisted to localStorage. Theme drives `html.light`; accent
 * overrides `--accent-color`. Add a SCHEMA row to introduce a new setting.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<Record<SettingName, unknown>>(readAll);

  const set = (name: SettingName, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    try {
      localStorage.setItem(SCHEMA[name].key, encode(value, SCHEMA[name]));
    } catch {
      /* storage full / unavailable */
    }
  };
  const get = <T,>(name: SettingName) => values[name] as T;

  const theme = values.theme as Theme;
  const accent = values.accent as string;
  const density = values.density as Density;

  // Resolved light/dark — re-resolves on theme change and (for `system`) when
  // the OS preference flips, so theme-aware UI like the wallpaper layer updates.
  const [isLight, setIsLight] = useState(() => resolveLight(theme));
  useEffect(() => {
    const apply = () => {
      const light = resolveLight(theme);
      setIsLight(light);
      document.documentElement.classList.toggle('light', light);
    };
    apply();
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    // `cyan` is the design-system default — clear the override so the token wins.
    if (accent === 'cyan') document.documentElement.style.removeProperty('--accent-color');
    else document.documentElement.style.setProperty('--accent-color', `var(--accent-${accent})`);
  }, [accent]);

  useEffect(() => {
    // Comfortable is the token default, so it carries no attribute at all —
    // the absence IS the default, same as accent above.
    if (density === 'compact') document.documentElement.dataset.density = 'compact';
    else delete document.documentElement.dataset.density;
  }, [density]);

  const value: SettingsValue = {
    get,
    set,
    theme,
    setTheme: (t) => set('theme', t),
    accent,
    setAccent: (a) => set('accent', a),
    density,
    setDensity: (d) => set('density', d),
    tempUnit: values.tempUnit as TempUnit,
    setTempUnit: (u) => set('tempUnit', u),
    activeProfileId: values.activeProfileId as string,
    setActiveProfileId: (id) => set('activeProfileId', id),
    powerMode: values.powerMode as string,
    setPowerMode: (m) => set('powerMode', m),
    displayArrange: values.displayArrange as DisplayArrange | null,
    setDisplayArrange: (d) => set('displayArrange', d),
    kvm: (values.kvm as KvmState | null) ?? DEFAULT_KVM,
    setKvm: (k) => set('kvm', k),
    persona: values.persona as string,
    setPersona: (p) => set('persona', p),
    onboarded: values.onboarded as boolean,
    setOnboarded: (v) => set('onboarded', v),
    wallpaper: values.wallpaper as string,
    setWallpaper: (id) => set('wallpaper', id),
    wpBlur: values.wpBlur as number,
    setWpBlur: (px) => set('wpBlur', px),
    wpOpacity: values.wpOpacity as number,
    setWpOpacity: (pct) => set('wpOpacity', pct),
    hideNavLabels: values.hideNavLabels as boolean,
    setHideNavLabels: (on) => set('hideNavLabels', on),
    hideNavIcons: values.hideNavIcons as boolean,
    setHideNavIcons: (on) => set('hideNavIcons', on),
    isLight,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>');
  return ctx;
}
