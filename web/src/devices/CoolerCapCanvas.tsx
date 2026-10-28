import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import './device-canvas.css';
import './lighting-tab.css';
import './pc-parts.css';
import './cooler-cap.css';
import {
  Badge,
  Button,
  Chip,
  Dropdown,
  Icon,
  Input,
  Ng3Col,
  Ng3Field,
  Ng3Grid,
  Ng3Label,
  Ng3Row,
  Ng3Section,
  Ng3Spec,
  Slider,
  Swatch,
  Toggle,
  ToggleButtonGroup,
  type IconName,
} from '../components';
import { type ResolvedSku, getResolvedSku } from './skus';
import { partsOf } from './pcDirectory';
import type { CapScreenLook } from '../lightstudio/capScreen';
import { deviceTabs } from './deviceTabs';
import { DeviceSettingsCard } from './DeviceSettingsCard';
import {
  BOOT_KEYS,
  CAP_MAX_DRIVES,
  DRIVES,
  SCREEN_CONTENT_LABEL,
  SCREEN_READING_LABEL,
  VITALS_THEMES,
  applyCapPreset,
  deleteCapPreset,
  duplicateCapPreset,
  lookOf,
  setCapPhase,
  showCapEvent,
  showCapPreset,
  tonesFor,
  useCapEvent,
  useCapPhase,
  useCoolerCap,
  type BootEdit,
  type CapLook,
  type CapPhase,
  type CapPreset,
  type CoolerCapState,
  type ReadingSlot,
  type Rotation,
  type ScreenContent,
  type ScreenReading,
  type VitalsTheme,
} from './pcParts';
import { fanName, fanRpm, getFanKit, kitFans, useFanKit } from './fanKit';
import { useSettings } from '../state/Settings';
import { formatTemp } from '../state/units';
import { VITALS } from '../widgets/perform5/vitalsData';
import pictureA from '../../../Assets/games/baldursgate3.webp';
import pictureB from '../../../Assets/games/arcraiders.webp';

/**
 * The cooler cap — the round screen on a desktop's CPU cooler (OpenGSW
 * lcd-diy; the CPU cooler LCD is MVP, Jira GSW-583). It is a part of the PC,
 * so it lives on the PC's page as its LCD cooler cap tab, and every door to
 * it opens that tab, its own address too (JY, 2026-10-22; lcd-diy.25). This
 * file holds the tab's pieces (useCapSession and what reads it); the page
 * (DesktopCanvas) puts them in its title row, its panel and over its hero.
 *
 * The controls inside follow OGH's LCD Display page, in three views switched
 * at the title row's right end:
 *
 *   Display  — the title's switch turns the screen on and off, the quarter
 *              turn beside the views turns it (lcd-diy.26); a brightness rail
 *              beside the presets, as Lights has. A preset is a look: System
 *              Vitals in a designed theme (lcd-diy.8, .9), a clock, a picture,
 *              a slideshow, a GIF or a video (lcd-diy.5). Picking one shows it
 *              at once; Customize puts OGH's configuration page in the list's
 *              place ("‹ Presets" back, as the macro editor does) — Style,
 *              Theme, Top, Bottom — which waits for Apply.
 *   Power On — the Power On Effect (lcd-diy.7), a GIF sized (lcd-diy.28),
 *              also sent with Apply.
 *   Settings — the device card with both firmwares (lcd-diy.23, .24, .40),
 *              what the app may put over the content (lcd-diy.6).
 *
 * When a change reaches the cap was open (lcd-diy#open:2); the user's call,
 * 2026-10-19, follows OGH: the screen's own controls and the settings act at
 * once, the configuration pages wait for Apply. Cancel leaves the saved
 * setting as it was (lcd-diy.22) and the applying wait always ends
 * (lcd-diy.39). The preview over the hero always shows what the cap would:
 * the edit while one is open, the cap as it is otherwise (lcd-diy.27).
 */

// ── Readings ────────────────────────────────────────────────────────────────
// System Vitals' numbers (lcd-diy.29) — the values the System Vitals card shows.
const CPU = { temp: 58, load: 44 };
const GPU = { temp: 60, load: 37 };
const RAM = { gb: 18.7, pct: 58 };
const RPM_FULL = 2000;
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const APPLY_MS = 900;

interface ReadingView {
  label: string;
  big: string;
  small: string;
  /** 0–100, for a theme that draws an arc or a bar. */
  pct: number;
  /** Storage only: the drives, four at most (lcd-diy.42). */
  drives?: { letter: string; pct: number }[];
}

function readingView(slot: ReadingSlot, unit: 'C' | 'F'): ReadingView {
  switch (slot.reading) {
    case 'cpu':
      return { label: 'CPU', big: formatTemp(CPU.temp, unit), small: `CPU · ${CPU.load}%`, pct: CPU.load };
    case 'gpu':
      return { label: 'GPU', big: formatTemp(GPU.temp, unit), small: `GPU · ${GPU.load}%`, pct: GPU.load };
    case 'ram':
      return { label: 'RAM', big: `${RAM.pct}%`, small: `RAM · ${RAM.gb} GB`, pct: RAM.pct };
    case 'storage': {
      const c = DRIVES[0];
      return {
        label: 'Storage',
        big: `${c.pct}%`,
        small: `Drive ${c.letter}`,
        pct: c.pct,
        drives: DRIVES.slice(0, CAP_MAX_DRIVES),
      };
    }
    case 'fan': {
      // The fan under the player's name, wherever it shows (lcd-diy.13).
      const kit = getFanKit();
      const fan = kit.fans.find((f) => f.id === slot.fanId) ?? kit.fans[0];
      const rpm = fan ? fanRpm(fan, kit) : 0;
      const name = fan ? fanName(fan) : 'Fan';
      return {
        label: name,
        big: rpm.toLocaleString(),
        small: `${name} · RPM`,
        pct: Math.min(100, (rpm / RPM_FULL) * 100),
      };
    }
  }
}

// ── Files ───────────────────────────────────────────────────────────────────
const SAMPLE_FILES = [
  { src: pictureA, name: "Baldur's Gate 3.webp" },
  { src: pictureB, name: 'ARC Raiders.webp' },
];
const contentFile = (s: { file: string | null }) => SAMPLE_FILES.find((f) => f.name === s.file) ?? SAMPLE_FILES[0];

/**
 * The cap's screen, tiny: what it shows now, scaled down to an icon (JY,
 * 2026-10-22, option B of five). Readings draw the CPU's load as a ring in
 * the cap's tone; a clock draws the time (hands, or digits); a picture,
 * slideshow or GIF shows its file; a video its file with a play mark. Off is
 * a dark screen. Used on the PC's card in Personalize.
 */
export function CapMiniScreen({ state, defaultArt = 'omen', size = 24 }: { state: CoolerCapState; defaultArt?: string; size?: number }) {
  const [now, setNow] = useState(() => new Date());
  const isClock = state.on && state.content === 'clock';
  useEffect(() => {
    if (!isClock) return;
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, [isClock]);
  const tones = tonesFor(defaultArt);
  const tone = tones.find((t) => t.id === state.tone) ?? tones[0];
  const box: CSSProperties = { width: size, height: size };
  if (!state.on) return <span className="cap-mini off" style={box} aria-hidden />;
  if (state.content === 'vitals') {
    // The CPU's load, the reading the cap's themes lead with.
    const r = 7;
    const c = 2 * Math.PI * r;
    const load = VITALS.cpu.load / 100;
    return (
      <span className="cap-mini" style={box} aria-hidden>
        <svg viewBox="0 0 24 24" width={size} height={size}>
          <circle cx="12" cy="12" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.4" />
          <circle cx="12" cy="12" r={r} fill="none" stroke={tone.a} strokeWidth="2.4" strokeLinecap="round" strokeDasharray={`${c * load} ${c}`} transform="rotate(-90 12 12)" />
        </svg>
      </span>
    );
  }
  if (state.content === 'clock') {
    const h = now.getHours();
    const m = now.getMinutes();
    if (state.clock === 'digital') {
      return (
        <span className="cap-mini" style={box} aria-hidden>
          <svg viewBox="0 0 24 24" width={size} height={size}>
            <text x="12" y="14.6" textAnchor="middle" fontSize="7" fontFamily="var(--font-mono)" fill="#e9eef3">
              {`${h % 12 || 12}:${String(m).padStart(2, '0')}`}
            </text>
          </svg>
        </span>
      );
    }
    const hourA = ((h % 12) + m / 60) * 30;
    const minA = m * 6;
    const hand = (deg: number, len: number) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return { x2: 12 + Math.cos(rad) * len, y2: 12 + Math.sin(rad) * len };
    };
    return (
      <span className="cap-mini" style={box} aria-hidden>
        <svg viewBox="0 0 24 24" width={size} height={size}>
          <line x1="12" y1="12" {...hand(hourA, 4.2)} stroke="#e9eef3" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="12" y1="12" {...hand(minA, 6.4)} stroke={tone.a} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  // A picture, a slideshow, a GIF or a video: its own file, cropped round.
  const file = contentFile(state);
  return (
    <span className="cap-mini media" style={{ ...box, backgroundImage: `url(${file.src})` }} aria-hidden>
      {state.content === 'video' && (
        <svg viewBox="0 0 24 24" width={size} height={size}>
          <path d="M10 8.5v7l6-3.5z" fill="#fff" opacity="0.9" />
        </svg>
      )}
    </span>
  );
}

/** The art a cap boots to until the player picks their own: the HyperX logo on
 *  a HyperX desktop (lcd-diy.35), the OMEN logo otherwise. */
const DEFAULT_ART: Record<string, { name: string; icon: IconName }> = {
  hyperx: { name: 'HyperX logo', icon: 'platform-hyperx' },
  omen: { name: 'OMEN logo', icon: 'platform-omen' },
};

// ── The cap's faces ─────────────────────────────────────────────────────────
type Tone = { a: string; b: string };

/** System Vitals on the cap, in its theme. Shared by the hero and the theme
 *  tiles, so a tile shows what the cap would. */
function VitalsFace({ theme, tone, slots, unit }: { theme: VitalsTheme; tone: Tone; slots: ReadingSlot[]; unit: 'C' | 'F' }) {
  const views = slots.map((s) => readingView(s, unit));
  const style = { '--cap-a': tone.a, '--cap-b': tone.b } as CSSProperties;
  if (theme === 'ring') {
    const v = views[0];
    const r = 44;
    const len = 2 * Math.PI * r;
    return (
      <div className="pcp-face pcp-face-ring" style={style}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={r} className="pcp-ring-track" />
          <circle cx="50" cy="50" r={r} className="pcp-ring-arc" strokeDasharray={`${(v.pct / 100) * len} ${len}`} transform="rotate(-90 50 50)" />
        </svg>
        <div className="pcp-cap-text">
          <span className="pcp-cap-small">{v.small}</span>
          <span className="pcp-cap-big">{v.big}</span>
        </div>
      </div>
    );
  }
  if (theme === 'list') {
    return (
      <div className="pcp-face pcp-face-list" style={style}>
        {views.map((v, i) => (
          <div key={i} className="pcp-list-row">
            <span className="pcp-list-label">{v.label}</span>
            {v.drives ? (
              <span className="pcp-drives" aria-label={v.drives.map((d) => `${d.letter} ${d.pct}%`).join(', ')}>
                {v.drives.map((d) => (
                  <span key={d.letter} className="pcp-drive">
                    <span>{d.letter}</span>
                    <span className="pcp-drive-bar">
                      <span style={{ width: `${d.pct}%` }} />
                    </span>
                  </span>
                ))}
              </span>
            ) : (
              <span className={i === 0 ? 'pcp-cap-big pcp-list-val' : 'pcp-list-val'}>{v.big}</span>
            )}
          </div>
        ))}
      </div>
    );
  }
  // Classic: a ticked ring, two readings stacked.
  const ticks = Array.from({ length: 48 }, (_, i) => i);
  return (
    <div className="pcp-face pcp-face-classic" style={style}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {ticks.map((i) => (
          <line
            key={i}
            x1="50"
            y1="4"
            x2="50"
            y2={i % 4 === 0 ? 10 : 8}
            className="pcp-tick"
            style={{
              stroke: i < ticks.length / 2 ? 'var(--cap-a)' : 'var(--cap-b)',
              opacity: i / ticks.length < views[0].pct / 100 ? 1 : 0.3,
            }}
            transform={`rotate(${(i / ticks.length) * 360} 50 50)`}
          />
        ))}
      </svg>
      <div className="pcp-classic-stack">
        {views.map((v, i) => (
          <div key={i} className="pcp-cap-text">
            <span className="pcp-cap-small" style={{ color: i === 0 ? 'var(--cap-a)' : 'var(--cap-b)' }}>
              {v.small}
            </span>
            <span className="pcp-cap-big">{v.big}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The cap, drawn round. Brightness and rotation act on the preview as they
 *  act on the cap. `boot` shows the Power On Effect, while it is being set or
 *  while the PC starts. `onPan` lets the player drag a picture to crop it. */
function CapPreview({
  state,
  tone,
  boot,
  phase,
  event,
  onPan,
}: {
  state: CoolerCapState;
  tone: Tone;
  boot?: { src?: string; icon?: IconName; scale: number };
  phase: CapPhase;
  event: string | null;
  onPan?: (x: number, y: number) => void;
}) {
  const { tempUnit } = useSettings();
  useFanKit(); // a renamed fan shows at once on a fan reading
  const [now, setNow] = useState(() => new Date());
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
      setCycle((c) => c + 1);
    }, 3000);
    return () => window.clearInterval(id);
  }, []);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const hourDeg = ((now.getHours() % 12) + now.getMinutes() / 60) * 30;
  const minuteDeg = now.getMinutes() * 6;
  const dark = !state.on || phase === 'display-off' || phase === 'asleep';

  const cropStyle: CSSProperties = {
    objectPosition: `${state.crop.x}% ${state.crop.y}%`,
    transform: `scale(${state.crop.zoom / 100})`,
    transformOrigin: `${state.crop.x}% ${state.crop.y}%`,
  };

  let face: ReactNode;
  if (boot) {
    face = boot.src ? (
      <img className="pcp-cap-img" src={boot.src} alt="" style={{ transform: `scale(${boot.scale / 100})` }} />
    ) : (
      <Icon name={boot.icon ?? 'platform-omen'} size={Math.round((96 * boot.scale) / 100)} />
    );
  } else if (state.content === 'clock') {
    face =
      state.clock === 'digital' ? (
        <div className="pcp-cap-text">
          <span className="pcp-cap-big">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="pcp-cap-small">{now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
      ) : (
        <svg className="pcp-cap-analog" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="44" className="pcp-cap-dial" />
          <line x1="50" y1="50" x2="50" y2="26" className="pcp-cap-hand" transform={`rotate(${hourDeg} 50 50)`} />
          <line x1="50" y1="50" x2="50" y2="14" className="pcp-cap-hand thin" transform={`rotate(${minuteDeg} 50 50)`} />
        </svg>
      );
  } else if (state.content === 'vitals') {
    face = <VitalsFace theme={state.theme} tone={tone} slots={state.slots[state.theme]} unit={tempUnit} />;
  } else if (state.content === 'slideshow') {
    face = <img className="pcp-cap-img" src={SAMPLE_FILES[cycle % SAMPLE_FILES.length].src} alt="" />;
  } else {
    face = <img className="pcp-cap-img" src={contentFile(state).src} alt="" style={state.content === 'picture' ? cropStyle : undefined} draggable={false} />;
  }

  const panning = !!onPan && state.content === 'picture' && !boot && !dark;
  const label = dark
    ? 'Cooler cap, screen dark'
    : boot
    ? 'Cooler cap, showing the Power On Effect'
    : `Cooler cap, showing ${SCREEN_CONTENT_LABEL[state.content]}`;

  return (
    <div
      className={'pcp-cap' + (dark ? ' off' : '') + (panning ? ' pannable' : '')}
      role="img"
      aria-label={label}
      onPointerDown={
        panning
          ? (e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, cx: state.crop.x, cy: state.crop.y };
            }
          : undefined
      }
      onPointerMove={
        panning
          ? (e) => {
              const d = drag.current;
              if (!d) return;
              const size = (e.currentTarget as HTMLElement).clientWidth || 1;
              const k = 100 / size / (state.crop.zoom / 100);
              const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)));
              onPan?.(clamp(d.cx - (e.clientX - d.x) * k), clamp(d.cy - (e.clientY - d.y) * k));
            }
          : undefined
      }
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      {!dark && (
        <div
          className="pcp-cap-face"
          // The player's values, not design values: the preview turns and dims
          // with the cap.
          style={{ transform: `rotate(${state.rotation}deg)`, opacity: 0.25 + (state.brightness / 100) * 0.75 }}
        >
          {face}
          {/* The app's events over the content (lcd-diy.6, lcd-diy.19). */}
          {event && !boot && <div className="pcp-cap-event">{event}</div>}
        </div>
      )}
    </div>
  );
}

// ── Display: the presets ────────────────────────────────────────────────────
const CONTENT_ICON: Record<ScreenContent, IconName> = {
  vitals: 'heartbeat',
  clock: 'hourglass',
  picture: 'image',
  slideshow: 'shuffle',
  gif: 'play',
  video: 'media-player',
};
const CONTENT_OPTIONS = (Object.keys(SCREEN_CONTENT_LABEL) as ScreenContent[]).map((c) => ({
  value: c,
  label: SCREEN_CONTENT_LABEL[c],
}));
const READINGS = Object.keys(SCREEN_READING_LABEL) as ScreenReading[];
const ROTATIONS: Rotation[] = [0, 90, 180, 270];

/** A preset's swatch in the list: its tone, its picture, or a dial. */
function presetSwatch(p: CapLook, tones: ReturnType<typeof tonesFor>): CSSProperties {
  if (p.content === 'vitals') {
    const t = tones.find((x) => x.id === p.tone) ?? tones[0];
    return { background: `linear-gradient(90deg, ${t.a} 0 50%, ${t.b} 50% 100%)` };
  }
  if (p.content === 'clock') return { background: 'radial-gradient(circle, #000 52%, #fff 54% 62%, #000 64%)' };
  const f = contentFile(p);
  return { backgroundImage: `url(${JSON.stringify(f.src)})`, backgroundSize: 'cover', backgroundPosition: 'center' };
}

interface CapEditor {
  preset: CapPreset;
  isNew: boolean;
}

/** OGH's configuration page for one preset: Style, Theme, then what each
 *  place on the face shows. It takes the list's place, as a macro's editor
 *  takes the macro list's (MacroPanel), with "‹ Presets" to go back. */
function CapPresetEditor({
  editor,
  setEditor,
  defaultArt,
  applying,
  state,
  onCancel,
  onApply,
}: {
  editor: CapEditor;
  setEditor: (e: CapEditor) => void;
  defaultArt: string;
  applying: boolean;
  /** How the edit stands: New, Not applied yet, or the preset as saved. */
  state: string;
  onCancel: () => void;
  onApply: () => void;
}) {
  const { tempUnit } = useSettings();
  const kit = useFanKit();
  const p = editor.preset;
  const edit = (patch: Partial<CapPreset>) => setEditor({ ...editor, preset: { ...p, ...patch } });
  const tones = tonesFor(defaultArt);
  const tone = tones.find((t) => t.id === p.tone) ?? tones[0];
  const theme = VITALS_THEMES.find((t) => t.id === p.theme) ?? VITALS_THEMES[0];
  const slots = p.slots[p.theme];
  const setSlot = (i: number, slot: ReadingSlot) => edit({ slots: { ...p.slots, [p.theme]: slots.map((s, j) => (j === i ? slot : s)) } });
  const file = contentFile(p);
  const nextFile = () =>
    edit({
      file: SAMPLE_FILES[(SAMPLE_FILES.indexOf(file) + 1) % SAMPLE_FILES.length].name,
      crop: { zoom: 100, x: 50, y: 50 },
    });
  const fanOptions = kit.fans.map((f) => ({ value: f.id, label: fanName(f) }));

  return (
    <div className="cap-editor" role="group" aria-label={`Customize ${p.name}`}>
      {/* Where you are, as the macro editor says it (MacroPanel): the way back
          to the list, and how this edit stands. The preset's own name is the
          field below, so no second title repeats the panel's. */}
      <div className="cap-editor-head">
        <button type="button" className="cap-back" onClick={onCancel} disabled={applying}>
          <Icon name="chevron-left" size={14} /> Presets
        </button>
        <span className="cap-editor-state">{state}</span>
      </div>
      <div className="cap-editor-body">
        <Ng3Col className="cap-editor-side">
          <Ng3Section>
            <Ng3Label strong>Name</Ng3Label>
            <Input aria-label="Preset name" value={p.name} maxLength={32} onChange={(e) => edit({ name: e.target.value })} />
            <Ng3Label strong>Shows</Ng3Label>
            <Dropdown aria-label="What the screen shows" value={p.content} onChange={(v) => edit({ content: v as ScreenContent })} options={CONTENT_OPTIONS} />
          </Ng3Section>
        </Ng3Col>

        {p.content === 'vitals' && (
          <>
            <Ng3Col className="cap-editor-main">
              <Ng3Section>
                <Ng3Label strong>Style</Ng3Label>
                {/* Always one of the designed themes (lcd-diy.8); each tile
                    draws what the cap would show in it. */}
                <div className="pcp-themes" role="radiogroup" aria-label="Style">
                  {VITALS_THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={p.theme === t.id}
                      className={'pcp-theme' + (p.theme === t.id ? ' selected' : '')}
                      onClick={() => edit({ theme: t.id })}
                    >
                      <span className="pcp-mini" aria-hidden="true">
                        <VitalsFace theme={t.id} tone={tone} slots={p.slots[t.id]} unit={tempUnit} />
                      </span>
                      <span className="pcp-theme-name">{t.label}</span>
                    </button>
                  ))}
                </div>
              </Ng3Section>
              <Ng3Section>
                <Ng3Label strong>Theme</Ng3Label>
                <div className="pcp-tones" role="radiogroup" aria-label="Theme">
                  {tones.map((t) => (
                    <Swatch
                      key={t.id}
                      role="radio"
                      aria-checked={tone.id === t.id}
                      colors={[t.a, t.b]}
                      size={32}
                      selected={tone.id === t.id}
                      label={t.label}
                      onClick={() => edit({ tone: t.id })}
                    />
                  ))}
                </div>
              </Ng3Section>
            </Ng3Col>
            <Ng3Col className="cap-editor-slots">
              {/* What each place on the face shows: OGH's reading buttons, one
                  picked per place, a row per place. */}
              <Ng3Section>
                <Ng3Label strong>Readings</Ng3Label>
                {theme.slots.map((place, i) => {
                  const slot = slots[i] ?? { reading: 'cpu' as const };
                  return (
                    <div key={place} className="pcp-slot" data-slot={place}>
                      <span className="pcp-slot-name">{place}</span>
                      <div className="cap-chips" role="radiogroup" aria-label={`${place} reading`}>
                        {READINGS.map((r) => (
                          <Chip
                            key={r}
                            role="radio"
                            aria-checked={slot.reading === r}
                            selected={slot.reading === r}
                            onClick={() => setSlot(i, { reading: r, fanId: r === 'fan' ? slot.fanId ?? kit.fans[0]?.id : undefined })}
                          >
                            {SCREEN_READING_LABEL[r]}
                          </Chip>
                        ))}
                        {/* A fan reading names its fan as the player named it (lcd-diy.13). */}
                        {slot.reading === 'fan' && (
                          <Dropdown
                            aria-label={`${place} fan`}
                            value={slot.fanId ?? kit.fans[0]?.id}
                            onChange={(v) => setSlot(i, { reading: 'fan', fanId: v })}
                            options={fanOptions}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
                {slots.some((x) => x.reading === 'storage') && DRIVES.length > CAP_MAX_DRIVES && (
                  <span className="pcp-reason">
                    Storage shows the first {CAP_MAX_DRIVES} of your {DRIVES.length} drives.
                  </span>
                )}
              </Ng3Section>
            </Ng3Col>
          </>
        )}

        {p.content === 'clock' && (
          <Ng3Col className="cap-editor-main">
            <Ng3Section>
              <Ng3Label strong>Style</Ng3Label>
              <ToggleButtonGroup
                aria-label="Clock style"
                value={p.clock}
                onChange={(v) => edit({ clock: v as CapLook['clock'] })}
                options={[
                  { value: 'digital', label: 'Digital' },
                  { value: 'analog', label: 'Analog' },
                ]}
                fullWidth
              />
            </Ng3Section>
          </Ng3Col>
        )}

        {(p.content === 'picture' || p.content === 'gif' || p.content === 'video') && (
          <Ng3Col className="cap-editor-main">
            <Ng3Section>
              <Ng3Label strong>File</Ng3Label>
              <Ng3Spec items={[{ label: 'File', value: file.name }]} />
              <div className="pcp-action">
                <Button size="sm" onClick={nextFile}>
                  <Icon name="image-upload" size={16} />
                  Choose another
                </Button>
              </div>
            </Ng3Section>
            {p.content === 'picture' && (
              <Ng3Section>
                {/* Crop (lcd-diy.28): zoom here, position by dragging the cap. */}
                <Ng3Row>
                  <Ng3Label strong>Crop</Ng3Label>
                  <span className="dc-mono-val">{p.crop.zoom}%</span>
                </Ng3Row>
                <div className="dc-slider-row">
                  <Icon name="zoom-out" size={16} aria-hidden />
                  <Slider min={100} max={250} step={5} value={p.crop.zoom} onChange={(zoom) => edit({ crop: { ...p.crop, zoom } })} aria-label="Crop zoom" />
                  <Icon name="zoom-in" size={16} aria-hidden />
                </div>
                <span className="pcp-reason">Drag the cap above to move the picture.</span>
              </Ng3Section>
            )}
          </Ng3Col>
        )}

        {p.content === 'slideshow' && (
          <Ng3Col className="cap-editor-main">
            <Ng3Section>
              <Ng3Label strong>Pictures</Ng3Label>
              <Ng3Spec items={[{ label: 'Pictures', value: `${SAMPLE_FILES.length}, 3 s each` }]} />
            </Ng3Section>
          </Ng3Col>
        )}
      </div>
      <div className="cap-editor-foot">
        <Button variant="default" onClick={onCancel} disabled={applying}>
          <Icon name="close" size="sm" />
          Cancel
        </Button>
        {/* The wait always ends (lcd-diy.39). */}
        <Button variant="accent" onClick={onApply} disabled={applying}>
          <Icon name="check" size="sm" />
          {applying ? 'Applying…' : 'Apply'}
        </Button>
      </div>
    </div>
  );
}

/** The Display tab's body: the brightness rail and the presets, as the Lights
 *  tab lays them out, or the configuration page in their place. */
function CapDisplayBody({ defaultArt, editor, setEditor }: { defaultArt: string; editor: CapEditor | null; setEditor: (e: CapEditor | null) => void }) {
  const [s, set] = useCoolerCap();
  const tones = tonesFor(defaultArt);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // Close the ⋮ menu on any outside pointer-down (the Lights tab's rule).
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.pdm-preset-cmenu, .pdm-preset-menu')) setMenuFor(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuFor]);

  const customize = (p: CapPreset) => {
    setMenuFor(null);
    setEditor({ preset: { ...p, crop: { ...p.crop } }, isNew: false });
  };
  const savedPreset = editor ? s.presets.find((x) => x.id === editor.preset.id) : undefined;
  const editState = !editor
    ? ''
    : editor.isNew
    ? 'New'
    : !sameJson(savedPreset, editor.preset)
    ? 'Not applied yet'
    : editor.preset.id === s.activePreset
    ? 'On the cap'
    : 'Saved';
  const apply = () => {
    if (!editor) return;
    setApplying(true);
    window.setTimeout(() => {
      applyCapPreset({ ...editor.preset, name: editor.preset.name.trim() || 'My display' });
      setApplying(false);
      setEditor(null);
    }, APPLY_MS);
  };

  return (
    <div className="pdm-lights cap-display">
      {editor ? (
        <CapPresetEditor
          editor={editor}
          setEditor={setEditor}
          defaultArt={defaultArt}
          applying={applying}
          state={editState}
          onCancel={() => setEditor(null)}
          onApply={apply}
        />
      ) : (
        <Ng3Grid className="pdm-lights-body">
          <Ng3Section className="pdm-bright">
            <span className="pdm-bright-val">{s.brightness}</span>
            <span className="pdm-bright-icon">
              <Icon name="brightness" size={16} />
            </span>
            <div className="pdm-bright-slider">
              <Slider min={10} max={100} step={5} value={s.brightness} onChange={(brightness) => set({ brightness })} aria-label="Brightness" />
            </div>
          </Ng3Section>

          <Ng3Section className="pdm-presets">
            <div className="pdm-presets-head">
              <Ng3Label strong>Presets</Ng3Label>
              <span className="pdm-presets-count">{s.presets.find((p) => p.id === s.activePreset)?.name ?? 'Customized'} on the cap</span>
            </div>
            <div className="pdm-presets-grid" role="list" aria-label="Presets">
              {s.presets.map((p) => (
                <div
                  key={p.id}
                  role="listitem"
                  data-preset={p.id}
                  className={'pdm-preset' + (p.id === s.activePreset ? ' active' : '') + (menuFor === p.id ? ' menu-open' : '')}
                >
                  <button type="button" className="pdm-preset-pick" aria-pressed={p.id === s.activePreset} onClick={() => showCapPreset(p.id)}>
                    <span className="pdm-preset-swatch" style={presetSwatch(p, tones)} />
                    <Icon name={CONTENT_ICON[p.content]} size={14} className="pdm-preset-fx" />
                    <span>{p.name}</span>
                  </button>
                  {p.id === s.activePreset && (
                    <span className="pdm-preset-order cap-live" role="img" aria-label="On the cap now" title="On the cap now">
                      Live
                    </span>
                  )}
                  <button type="button" className="pdm-preset-menu" aria-label={`${p.name} options`} onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}>
                    <Icon name="more" size={16} />
                  </button>
                  {menuFor === p.id && (
                    <div className="pdm-preset-cmenu">
                      <button type="button" className="pdm-cmenu-item" onClick={() => customize(p)}>
                        <Icon name="edit" size={16} />
                        Customize
                      </button>
                      <button
                        type="button"
                        className="pdm-cmenu-item"
                        onClick={() => {
                          setMenuFor(null);
                          duplicateCapPreset(p.id);
                        }}
                      >
                        <Icon name="duplicate" size={16} />
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="pdm-cmenu-item danger"
                        disabled={s.presets.length < 2}
                        onClick={() => {
                          setMenuFor(null);
                          deleteCapPreset(p.id);
                        }}
                      >
                        <Icon name="trash" size={16} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="pdm-preset-fab"
              aria-label="Create new display"
              onClick={() =>
                setEditor({
                  preset: { ...lookOf(s), id: `cap-${Date.now()}`, name: `My display ${s.presets.length + 1}` },
                  isNew: true,
                })
              }
            >
              <Icon name="add" size={16} />
            </button>
          </Ng3Section>
        </Ng3Grid>
      )}
    </div>
  );
}

// ── Power On ────────────────────────────────────────────────────────────────
function PowerOnTab({ view, edit, defaultArt }: { view: CoolerCapState; edit: (patch: BootEdit) => void; defaultArt: { name: string } }) {
  const files = [null, ...SAMPLE_FILES.map((f) => f.name)];
  const next = () => edit({ bootArt: files[(files.indexOf(view.bootArt) + 1) % files.length] });
  return (
    <Ng3Grid className="cap-grid">
      <Ng3Section>
        <Ng3Label strong info>
          Power On Effect
        </Ng3Label>
        <ToggleButtonGroup
          aria-label="Power On Effect"
          value={view.bootKind}
          onChange={(v) => edit({ bootKind: v as CoolerCapState['bootKind'] })}
          options={[
            { value: 'picture', label: 'Picture' },
            { value: 'gif', label: 'GIF' },
            { value: 'video', label: 'Video' },
          ]}
          fullWidth
        />
        <Ng3Spec items={[{ label: 'File', value: view.bootArt ?? `${defaultArt.name} (default)` }]} />
        <div className="pcp-action">
          <Button size="sm" onClick={next}>
            <Icon name="image-upload" size={16} />
            Choose another
          </Button>
        </div>
      </Ng3Section>
      {view.bootKind !== 'picture' && (
        <Ng3Section>
          {/* A GIF is sized to the screen (lcd-diy.28). */}
          {view.bootKind === 'gif' && (
            <>
              <Ng3Row>
                <Ng3Label strong>Size</Ng3Label>
                <span className="dc-mono-val">{view.bootScale}%</span>
              </Ng3Row>
              <Slider min={50} max={100} step={5} value={view.bootScale} onChange={(bootScale) => edit({ bootScale })} aria-label="GIF size" />
              <span className="dc-divider" />
            </>
          )}
          {/* A picture does not play; a GIF or a video plays once or loops. */}
          <Ng3Label strong>Plays</Ng3Label>
          <ToggleButtonGroup
            aria-label="Power On Effect playback"
            value={view.bootLoop ? 'loop' : 'once'}
            onChange={(v) => edit({ bootLoop: v === 'loop' })}
            options={[
              { value: 'once', label: 'Once' },
              { value: 'loop', label: 'Loop' },
            ]}
            fullWidth
          />
        </Ng3Section>
      )}
    </Ng3Grid>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────
type FirmwareStep = 'idle' | 'checking' | 'offline' | 'available' | 'installing' | 'restart' | 'current';

/** One part's firmware, updated from the app (lcd-diy.23). The button always
 *  answers, offline too (lcd-diy.40), and an update costs one restart at most
 *  (lcd-diy.24). Simulated: the first check finds an update. */
function FirmwareRow({ label, current, next }: { label: string; current: string; next: string }) {
  const [step, setStep] = useState<FirmwareStep>('idle');
  const [version, setVersion] = useState(current);
  const check = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStep('offline');
      return;
    }
    setStep('checking');
    window.setTimeout(() => setStep(version === next ? 'current' : 'available'), 700);
  };
  const install = () => {
    setStep('installing');
    window.setTimeout(() => setStep('restart'), 1200);
  };
  return (
    <Ng3Field className="pcp-firmware" data-firmware={label}>
      <Ng3Row>
        <Ng3Label plain>{label}</Ng3Label>
        <span className="dc-mono-val">v{version}</span>
      </Ng3Row>
      <div className="pcp-action">
        {step === 'available' ? (
          <Button size="sm" variant="accent" onClick={install}>
            Install v{next}
          </Button>
        ) : step === 'restart' ? (
          <Button
            size="sm"
            onClick={() => {
              setVersion(next);
              setStep('current');
            }}
          >
            Restart now
          </Button>
        ) : (
          <Button size="sm" onClick={check} disabled={step === 'checking' || step === 'installing'}>
            <Icon name="refresh" size={16} />
            {step === 'checking' ? 'Checking…' : step === 'installing' ? 'Installing…' : 'Check for updates'}
          </Button>
        )}
        {step === 'current' && (
          <Badge variant="status" tone="positive">
            Up to date
          </Badge>
        )}
        {step === 'offline' && <span className="pcp-reason">You're offline. Connect to the internet and check again.</span>}
        {step === 'available' && <span className="pcp-reason">v{next} is ready.</span>}
        {step === 'restart' && <span className="pcp-reason">Restart once to finish.</span>}
      </div>
    </Ng3Field>
  );
}

function SettingsTab({ sku }: { sku: ResolvedSku }) {
  const [s, set] = useCoolerCap();
  return (
    <Ng3Grid className="cap-grid">
      {/* The device card every Settings tab opens with; the firmware lines
          update the cap and the fan kit's controller from the app. */}
      <DeviceSettingsCard name={sku.name} deviceManager={false}>
        <FirmwareRow label="Cooler cap" current="2.3.1" next="2.4.0" />
        <FirmwareRow label="Fan kit controller" current="1.0.8" next="1.1.0" />
      </DeviceSettingsCard>
      <Ng3Col>
        <Ng3Section>
          {/* Two hands set the cap: the player's content, and what the app
              puts over it (lcd-diy.19). */}
          <Ng3Row>
            <Ng3Label strong info>
              App events
            </Ng3Label>
            <Toggle checked={s.showEvents} onChange={(showEvents) => set({ showEvents })} aria-label="Show the app's events" />
          </Ng3Row>
          {s.showEvents && (
            <>
              <Ng3Row>
                <Ng3Label plain>Keep showing them while playing</Ng3Label>
                <Toggle checked={s.whilePlaying} onChange={(whilePlaying) => set({ whilePlaying })} aria-label="Keep showing events while playing" />
              </Ng3Row>
              <div className="pcp-action">
                <Button size="sm" variant="ghost" onClick={() => showCapEvent('Performance mode')}>
                  <Icon name="play" size={16} />
                  Preview an event
                </Button>
              </div>
            </>
          )}
          <span className="dc-divider" />
          <Ng3Row>
            <Ng3Label strong info>
              Game in play
            </Ng3Label>
            <Toggle checked={s.showGame} onChange={(showGame) => set({ showGame })} aria-label="Show the game you're playing" />
          </Ng3Row>
        </Ng3Section>
        {/* The prototype's stand-in for what the PC does: the cap comes back
            to the player's setting every time (lcd-diy.20) and goes dark with
            the display (lcd-diy.21). */}
        <Ng3Section className="pcp-sim">
          <Ng3Label strong>Simulate</Ng3Label>
          <div className="pcp-action">
            <Button size="sm" variant="ghost" onClick={() => simulateCapPhase('display-off')}>
              Display off
            </Button>
            <Button size="sm" variant="ghost" onClick={() => simulateCapPhase('sleep')}>
              Sleep and wake
            </Button>
            <Button size="sm" variant="ghost" onClick={() => simulateCapPhase('restart')}>
              Restart
            </Button>
          </div>
        </Ng3Section>
      </Ng3Col>
    </Ng3Grid>
  );
}

// ── The cap on the PC's page ───────────────────────────────────────────────
/** The cap's three views, the tabs its window had (deviceTabs). */
export type CapView = 'display' | 'boot' | 'settings';
const CAP_VIEWS: readonly string[] = ['display', 'boot', 'settings'];
export const isCapView = (v: string | null | undefined): v is CapView => !!v && CAP_VIEWS.includes(v);

const PHASE_LABEL: Record<Exclude<CapPhase, 'awake'>, string> = {
  'display-off': 'Display off',
  asleep: 'PC asleep',
  booting: 'Starting up',
};

/**
 * The cap's editing, held by the PC's page for its LCD cooler cap tab (JY,
 * 2026-10-22: every door to the cap, the tab's and its own address, opens
 * that one place). The view the tab shows, the open preset edit and the
 * Power On edit, each waiting for Apply; the preview over the hero and the
 * tab read the same one. Leaving a view, or the tab, cancels what it had
 * open, as closing the cap's window did.
 */
export function useCapSession(sku: ResolvedSku | undefined, initialView: CapView = 'display') {
  const [saved, set] = useCoolerCap();
  const phase = useCapPhase();
  const event = useCapEvent();
  const [view, setViewState] = useState<CapView>(initialView);
  const [editor, setEditor] = useState<CapEditor | null>(null);
  const [boot, setBoot] = useState<BootEdit>({});
  const [applying, setApplying] = useState(false);
  const artKey = String(sku?.features.defaultArt ?? 'omen');
  const defaultArt = DEFAULT_ART[artKey] ?? DEFAULT_ART.omen;
  // What the preview shows: the cap as it is, with the open edit over it.
  // While the PC sleeps or starts, it shows the cap as the PC has it.
  const awake = phase === 'awake';
  const shown: CoolerCapState = awake ? { ...saved, ...(editor ? lookOf(editor.preset) : {}), ...boot } : saved;
  const bootDirty = BOOT_KEYS.some((k) => k in boot && !sameJson(boot[k], saved[k]));
  const editorDirty = !!editor && (editor.isNew || !sameJson(saved.presets.find((x) => x.id === editor.preset.id), editor.preset));
  const reset = () => {
    setEditor(null);
    setBoot({});
  };
  return {
    sku,
    saved,
    set,
    phase,
    event,
    view,
    setView: (v: CapView) => {
      reset();
      setViewState(v);
    },
    reset,
    editor,
    setEditor,
    setBoot,
    bootDirty,
    applying,
    applyBoot: () => {
      setApplying(true);
      window.setTimeout(() => {
        set(boot);
        setBoot({});
        setApplying(false);
      }, APPLY_MS);
    },
    editing: awake && (editorDirty || bootDirty),
    /** Power On has an edit waiting for Apply, or is applying it. */
    applyPending: view === 'boot' && (bootDirty || applying),
    shown,
    artKey,
    defaultArt,
  };
}
export type CapSession = ReturnType<typeof useCapSession>;

/** The cap over the PC page's hero: the cap as it is, or the edit not yet
 *  sent (lcd-diy.27), with the tag that says which. A picture is dragged
 *  here to crop it; Power On shows its effect here. */
export function CapHero({ s }: { s: CapSession }) {
  const tones = tonesFor(s.artKey);
  const tone = tones.find((t) => t.id === s.shown.tone) ?? tones[0];
  const bootFile = SAMPLE_FILES.find((f) => f.name === s.shown.bootArt);
  const showBoot = s.phase === 'booting' || (s.phase === 'awake' && s.view === 'boot');
  const bootArt = {
    ...(bootFile ? { src: bootFile.src } : { icon: s.defaultArt.icon }),
    scale: s.shown.bootKind === 'gif' ? s.shown.bootScale : 100,
  };
  const { editor, setEditor } = s;
  return (
    <div className="pcp-hero cap-hero">
      <CapPreview
        state={s.shown}
        tone={tone}
        phase={s.phase}
        event={s.event}
        boot={showBoot ? bootArt : undefined}
        onPan={
          editor && editor.preset.content === 'picture'
            ? (x, y) => setEditor({ ...editor, preset: { ...editor.preset, crop: { ...editor.preset.crop, x, y } } })
            : undefined
        }
      />
      <span className="pcp-hero-tag">{s.editing ? 'Preview · not applied yet' : 'Live now'}</span>
    </div>
  );
}

/**
 * What the 3D tower's cap screen draws (lightstudio/capScreen.ts, for
 * illustration): the face the preview shows, as plain data, so the 3D side
 * reads no app state. Dark while the screen is off or the PC sleeps; the
 * Power On Effect while `boot`.
 */
export function capScreenLook(
  state: CoolerCapState,
  o: { phase: CapPhase; event: string | null; artKey: string; unit: 'C' | 'F'; boot: boolean },
): CapScreenLook {
  const base = { brightness: state.brightness, rotation: state.rotation };
  if (!state.on || o.phase === 'display-off' || o.phase === 'asleep') return { ...base, face: { kind: 'dark' } };
  if (o.boot) {
    const file = SAMPLE_FILES.find((f) => f.name === state.bootArt);
    const art = DEFAULT_ART[o.artKey] ?? DEFAULT_ART.omen;
    return {
      ...base,
      face: file ? { kind: 'image', srcs: [file.src], play: state.bootKind === 'video' } : { kind: 'logo', text: art.name.replace(/ logo$/i, '') },
    };
  }
  const tones = tonesFor(o.artKey);
  const tone = tones.find((t) => t.id === state.tone) ?? tones[0];
  const event = o.event;
  switch (state.content) {
    case 'vitals':
      return {
        ...base,
        event,
        face: {
          kind: 'readings',
          theme: state.theme,
          a: tone.a,
          b: tone.b,
          rows: state.slots[state.theme].map((slot) => {
            const v = readingView(slot, o.unit);
            return { label: v.label, big: v.big, small: v.small, pct: v.pct };
          }),
        },
      };
    case 'clock':
      return { ...base, event, face: { kind: 'clock', style: state.clock, a: tone.a } };
    case 'slideshow':
      return { ...base, event, face: { kind: 'image', srcs: SAMPLE_FILES.map((f) => f.src) } };
    default:
      return {
        ...base,
        event,
        face: { kind: 'image', srcs: [contentFile(state).src], crop: state.content === 'picture' ? state.crop : undefined, play: state.content === 'video' },
      };
  }
}

/** The cap screen's look for This PC as it is now, for a 3D desk outside the
 *  PC's page (Personalize's Lighting overview); null where This PC has no
 *  cap, a notebook or June 2027 among them. */
export function useLiveCapScreen(): CapScreenLook | null {
  const { thisPc, mvpScope, tempUnit } = useSettings();
  const [state] = useCoolerCap();
  const phase = useCapPhase();
  const event = useCapEvent();
  const pc = getResolvedSku(thisPc);
  const cap = pc?.type === 'desktop' ? partsOf(pc.id, mvpScope).find((p) => p.type === 'desktop-cooler-cap') : undefined;
  if (!cap) return null;
  return capScreenLook(state, { phase, event, artKey: String(cap.features.defaultArt ?? 'omen'), unit: tempUnit, boot: phase === 'booting' });
}

/** The cap's screen in the page's status chips, and while the PC sleeps or
 *  starts, why it is dark. */
export function CapChips({ s }: { s: CapSession }) {
  return (
    <>
      <div className="dc-chip">
        <span className={'dc-chip-dot' + (s.saved.on ? ' dc-chip-dot-on' : '')} aria-hidden="true" />
        <span className="dc-chip-val">{s.saved.on ? 'Screen on' : 'Screen off'}</span>
      </div>
      {s.phase !== 'awake' && (
        <div className="dc-chip">
          <span className="dc-chip-val">{PHASE_LABEL[s.phase]}</span>
        </div>
      )}
    </>
  );
}

/** Beside the title, on Display: the screen's own switch. */
export function CapScreenSwitch({ s }: { s: CapSession }) {
  return s.view === 'display' ? <Toggle checked={s.saved.on} onChange={(on) => s.set({ on })} aria-label="Screen on" /> : null;
}

/** The title row's right end: on Display the quarter turn (lcd-diy.26), then
 *  the three views, the way the Power supply tab switches Status and Fan. */
export function CapActions({ s }: { s: CapSession }) {
  const next = ROTATIONS[(ROTATIONS.indexOf(s.saved.rotation) + 1) % ROTATIONS.length];
  const views = s.sku ? deviceTabs(s.sku) : [];
  return (
    <span className="cap-actions">
      {s.view === 'display' && (
        <button type="button" className="ds-ng3-action cap-rotate" aria-label={`Rotation ${s.saved.rotation}°. Turn to ${next}°`} onClick={() => s.set({ rotation: next })}>
          <Icon name="monitor-pivot" />
          <span className="dc-mono-val">{s.saved.rotation}°</span>
        </button>
      )}
      <ToggleButtonGroup
        aria-label="Cooler cap view"
        value={s.view}
        onChange={(v) => isCapView(v) && s.setView(v)}
        options={views.map((t) => ({ value: t.id, label: t.title }))}
      />
    </span>
  );
}

/** Under the panel, on Power On: Cancel and Apply while an edit waits
 *  (shown while `applyPending`). */
export function CapApplyBar({ s }: { s: CapSession }) {
  return (
    <div className="pcp-apply">
      <Button size="sm" variant="ghost" onClick={() => s.setBoot({})} disabled={s.applying}>
        Cancel
      </Button>
      <Button size="sm" variant="accent" onClick={s.applyBoot} disabled={s.applying}>
        {s.applying ? 'Applying…' : 'Apply'}
      </Button>
    </div>
  );
}

/**
 * The tab's body, the view the switch picked: Display (brightness and the
 * presets, and a line for the DIY fan kit), Power On, or Settings.
 */
export function CoolerCapTab({ s }: { s: CapSession }) {
  const kit = useFanKit();
  const fans = kitFans(kit).length;
  if (s.view === 'boot') return <PowerOnTab view={s.shown} edit={(patch) => s.setBoot((b) => ({ ...b, ...patch }))} defaultArt={s.defaultArt} />;
  if (s.view === 'settings') return s.sku ? <SettingsTab sku={s.sku} /> : null;
  return (
    <div className="cap-tab" data-testid="cooler-cap-tab">
      <CapDisplayBody defaultArt={s.artKey} editor={s.editor} setEditor={s.setEditor} />
      {!s.editor && (
        <Ng3Section className="cap-tab-more">
          <Ng3Row>
            <Ng3Label plain>DIY fan kit</Ng3Label>
            <span className="dc-mono-val">
              {fans} {fans === 1 ? 'fan' : 'fans'} in {kit.groups.length} {kit.groups.length === 1 ? 'group' : 'groups'}
            </span>
          </Ng3Row>
        </Ng3Section>
      )}
    </div>
  );
}

/** For the lab: what the PC does, as the cap lives through it. Sleep and
 *  restart both come back to the player's setting (lcd-diy.20); a restart
 *  plays the Power On Effect on the way. The display going off darkens the
 *  cap with it (lcd-diy.21). */
export function simulateCapPhase(kind: 'sleep' | 'restart' | 'display-off') {
  if (kind === 'display-off') {
    setCapPhase('display-off');
    window.setTimeout(() => setCapPhase('awake'), 3000);
  } else if (kind === 'sleep') {
    setCapPhase('asleep');
    window.setTimeout(() => setCapPhase('awake'), 2500);
  } else {
    setCapPhase('asleep');
    window.setTimeout(() => setCapPhase('booting'), 1200);
    window.setTimeout(() => setCapPhase('awake'), 4000);
  }
}
