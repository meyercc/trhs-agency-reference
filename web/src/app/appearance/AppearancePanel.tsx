// ── Appearance ───────────────────────────────────────────────────────────────
// How the APP looks: theme, density, accent, wallpaper — Settings › App ›
// Appearance, the only home of these controls (the avatar menu's theme switch
// is a shortcut to the same setting).
//
// Fast path: Looks (wallpaper + accent + theme in one click, with Undo).
// Control path: your own image with a focal point, accent from the wallpaper or
// a HEX value. Guard rails: a custom accent must clear WCAG UI contrast, and the
// wallpaper's dim layer keeps text legible over any image.
// The one bridge to the desk: after an accent change, *ask* whether the desk
// lighting should match — app look and desk lighting stay separate settings.
import { useEffect, useRef, useState } from 'react';
import { Button, Icon, Input, Slider, Swatch, Toggle, ToggleButtonGroup } from '../../components';
import { useSettings, type Density, type Theme, type UiScale } from '../../state/Settings';
import { ACCENTS } from '../../state/bindings';
import { deleteImage, downscale, putImage, useStoredImage } from '../../state/imageStore';
import { usePersonalize } from '../../pages/personalize/state';
import { CUSTOM_WALLPAPER_ID, LOOKS, WALLPAPERS, wallpaperImage, type Look } from '../wallpapers';
import { HEX_RE, SURFACE, UI_CONTRAST, contrast, legible, paletteFrom } from '../color';
import { OverrideNote, SettingsRow } from '../../modals/settingsParts';
import '../../widgets/widgets.css'; // wp-thumb / wg-swatch
import './appearance.css';


const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};
/** The hex a token accent resolves to right now (for lighting + contrast). */
const tokenHex = (id: string) => getComputedStyle(document.documentElement).getPropertyValue(`--accent-${id}`).trim();

type Snapshot = { wallpaper: string; accent: string; accentHex: string; theme: Theme };

export function AppearancePanel() {
  const s = useSettings();
  const p = usePersonalize();
  const upload = useStoredImage('wallpaper');
  const fileRef = useRef<HTMLInputElement>(null);
  const [undo, setUndo] = useState<{ label: string; prev: Snapshot } | null>(null);
  const [palette, setPalette] = useState<string[]>([]);
  const [hexDraft, setHexDraft] = useState(s.accentHex.replace('#', ''));
  const [offerLight, setOfferLight] = useState<{ hex: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const custom = s.wallpaper === CUSTOM_WALLPAPER_ID;
  const currentImage = custom ? upload : wallpaperImage(s.wallpaper, s.isLight);
  const surface = s.isLight ? SURFACE.light : SURFACE.dark;

  useEffect(() => {
    if (!currentImage) return setPalette([]);
    let alive = true;
    paletteFrom(currentImage)
      .then(c => alive && setPalette(c))
      .catch(() => alive && setPalette([]));
    return () => {
      alive = false;
    };
  }, [currentImage]);

  const snapshot = (): Snapshot => ({
    wallpaper: s.wallpaper,
    accent: s.accent,
    accentHex: s.accentHex,
    theme: s.theme,
  });
  const restore = (x: Snapshot) => {
    s.setWallpaper(x.wallpaper);
    s.setAccent(x.accent);
    s.setAccentHex(x.accentHex);
    s.setTheme(x.theme);
  };
  const remember = (label: string) => setUndo({ label, prev: snapshot() });

  const pickAccent = (id: string, name: string, hex?: string) => {
    remember(`Accent: ${name}`);
    if (hex) {
      s.setAccentHex(hex);
      s.setAccent('custom');
    } else s.setAccent(id);
    setOfferLight({ hex: hex ?? tokenHex(id), name });
  };

  const applyLook = (look: Look) => {
    remember(`Look: ${look.name}`);
    s.setWallpaper(look.wallpaper);
    s.setAccent(look.accent);
    s.setTheme(look.theme);
    setOfferLight({ hex: tokenHex(look.accent), name: look.name });
  };
  const lookActive = (look: Look) =>
    look.wallpaper === s.wallpaper && look.accent === s.accent && look.theme === s.theme;

  const onUpload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      await putImage('wallpaper', await downscale(file, 2560));
      remember('Wallpaper: your image');
      s.setWpFocus({ x: 50, y: 50 });
      s.setWallpaper(CUSTOM_WALLPAPER_ID);
    } finally {
      setBusy(false);
    }
  };
  const removeUpload = async () => {
    await deleteImage('wallpaper');
    if (custom) s.setWallpaper(WALLPAPERS[0].id);
  };

  // These rows write the baseline, so they must show the baseline; OverrideNote
  // explains the gap when a profile is winning.
  const baseAccent = s.getBaseline<string>('accent');
  const baseWallpaper = s.getBaseline<string>('wallpaper');

  const hex = `#${hexDraft}`;
  const hexValid = HEX_RE.test(hex);
  const hexRatio = hexValid ? contrast(hex, surface) : 0;
  const hexReadable = hexRatio >= UI_CONTRAST;

  return (
    <div className="appearance-panel">
      {/* Looks */}
      <div className="stx-block">
        <div className="stx-preview-label">Looks</div>
        <div className="ap-looks" role="group" aria-label="Looks">
          {LOOKS.map(look => (
            <button
              key={look.id}
              type="button"
              className={lookActive(look) ? 'wp-thumb is-active' : 'wp-thumb'}
              aria-pressed={lookActive(look)}
              onClick={() => applyLook(look)}
              style={{ backgroundImage: `url("${wallpaperImage(look.wallpaper, look.theme === 'light')}")` }}
            >
              <span className="ap-look-dot" style={{ background: `var(--accent-${look.accent})` }} aria-hidden />
              <span className="wp-thumb-name">{look.name}</span>
            </button>
          ))}
        </div>
        {undo && (
          <div className="ap-undo" role="status">
            <span>{undo.label}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                restore(undo.prev);
                setUndo(null);
                setOfferLight(null);
              }}
            >
              <Icon name="undo" size="sm" /> Undo
            </Button>
          </div>
        )}
      </div>

      {/* Two questions rather than three options: whether the system answers,
          and — only if it does not — which theme. Same split as the avatar
          menu, same remembered pick (`themeChoice`). */}
      <SettingsRow
        label="Use system theme"
        sublabel="Follow your operating system's light or dark setting"
        control={<Toggle checked={s.useSystemTheme} onChange={s.setUseSystemTheme} aria-label="Use system theme" />}
      />
      {!s.useSystemTheme && (
        <SettingsRow
          label="Theme"
          sublabel="Dark or light, whichever the app should stay on"
          control={
            <ToggleButtonGroup
              aria-label="Theme"
              value={s.themeChoice}
              onChange={v => s.setTheme(v as Theme)}
              options={[
                { label: 'Dark', value: 'dark' },
                { label: 'Light', value: 'light' },
              ]}
            />
          }
        />
      )}
      <SettingsRow
        label="Density"
        sublabel="How much breathing room the layout gets"
        control={
          <ToggleButtonGroup
            aria-label="Density"
            value={s.density}
            onChange={v => s.setDensity(v as Density)}
            options={[
              { label: 'Comfortable', value: 'comfortable' },
              { label: 'Compact', value: 'compact' },
            ]}
          />
        }
      />
      {/* The root zoom (tokens.css, INTERFACE SIZE). Auto is 100%, or 150% on a
          4K-class screen at native scale, where 15px text is half the size it
          was drawn at. The same control Steam and Discord give a 4K owner. */}
      <SettingsRow
        label="Interface size"
        sublabel="Auto scales up on a 4K screen at native resolution"
        control={
          <ToggleButtonGroup
            aria-label="Interface size"
            value={s.uiScale}
            onChange={v => s.setUiScale(v as UiScale)}
            options={[
              { label: 'Auto', value: 'auto' },
              { label: '100%', value: '100' },
              { label: '125%', value: '125' },
              { label: '150%', value: '150' },
            ]}
          />
        }
      />

      {/* Accent */}
      <div className="stx-block">
        <div className="stx-preview-label">
          Accent color
          <OverrideNote name="accent" />
        </div>
        <div className="ds-settings-row-sublabel">Used for selection, focus, and highlights across the app</div>
        <div className="ap-rows">
          <div className="ap-inline">
            <span className="ap-row-label">Presets</span>
            <div className="ap-row-controls" role="group" aria-label="Accent presets">
              {ACCENTS.map(id => {
                const name = id[0].toUpperCase() + id.slice(1);
                return (
                  <Swatch
                    key={id}
                    color={`var(--accent-${id})`}
                    label={name}
                    selected={baseAccent === id}
                    onClick={() => pickAccent(id, name)}
                  />
                );
              })}
            </div>
          </div>
          {palette.length > 0 && (
            <div className="ap-inline">
              <span className="ap-row-label">Match wallpaper</span>
              <div className="ap-row-controls" role="group" aria-label="Accents from your wallpaper">
                {palette.map(c => (
                  <Swatch
                    key={c}
                    color={c}
                    label={`Accent ${c}`}
                    selected={s.accent === 'custom' && s.accentHex.toLowerCase() === c.toLowerCase()}
                    onClick={() => {
                      setHexDraft(c.slice(1));
                      pickAccent('custom', 'from wallpaper', c);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="ap-inline">
            <span className="ap-row-label">Your own</span>
            <div className="ap-row-controls">
              <Input
                variant="hex"
                aria-label="Accent HEX"
                value={hexDraft}
                maxLength={6}
                placeholder="00C8D7"
                wrapClassName="ap-hex"
                onChange={e => setHexDraft(e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6))}
                error={
                  hexValid && !hexReadable
                    ? `Too dark to see on the app (${hexRatio.toFixed(1)}:1, needs 3:1)`
                    : undefined
                }
              />
              {hexValid && !hexReadable ? (
                <Button size="sm" onClick={() => setHexDraft(legible(hex).slice(1))}>
                  Use a lighter shade
                </Button>
              ) : (
                <Button size="sm" disabled={!hexValid} onClick={() => pickAccent('custom', hex.toUpperCase(), hex)}>
                  Apply
                </Button>
              )}
            </div>
          </div>
        </div>
        {offerLight && (
          <div className="ap-offer" role="status">
            <Swatch color={offerLight.hex} size={20} label="" aria-hidden />
            <span>Match your desk lighting to this color?</span>
            <Button
              size="sm"
              variant="accent"
              onClick={() => {
                const k = p.desk.lighting.keyboard;
                p.setLighting([], { color: rgbOf(offerLight.hex), ...(k.effect === 'off' ? { effect: 'solid' } : {}) });
                setOfferLight(null);
              }}
            >
              Match lighting
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOfferLight(null)}>
              Not now
            </Button>
          </div>
        )}
      </div>

      {/* Wallpaper */}
      <div className="stx-wallpaper">
        <div className="stx-preview-label">
          Wallpaper
          <OverrideNote name="wallpaper" />
        </div>
        <div className="wp-thumbs">
          {WALLPAPERS.map(wp => {
            const active = baseWallpaper === wp.id;
            return (
              <button
                key={wp.id}
                type="button"
                className={active ? 'wp-thumb is-active' : 'wp-thumb'}
                aria-label={wp.name}
                aria-pressed={active}
                onClick={() => {
                  remember(`Wallpaper: ${wp.name}`);
                  s.setWallpaper(wp.id);
                }}
                style={{ backgroundImage: `url("${(s.isLight ? wp.light : wp.dark).img}")` }}
              >
                <span className="wp-thumb-name">{wp.name}</span>
              </button>
            );
          })}
          {upload && (
            <button
              type="button"
              className={custom ? 'wp-thumb is-active' : 'wp-thumb'}
              aria-label="Your image"
              aria-pressed={custom}
              onClick={() => {
                remember('Wallpaper: your image');
                s.setWallpaper(CUSTOM_WALLPAPER_ID);
              }}
              style={{ backgroundImage: `url("${upload}")`, backgroundPosition: `${s.wpFocus.x}% ${s.wpFocus.y}%` }}
            >
              <span className="wp-thumb-name">Your image</span>
            </button>
          )}
          <button type="button" className="wp-thumb ap-upload" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Icon name="image-upload" size="lg" />
            <span>{busy ? 'Adding…' : upload ? 'Replace image' : 'Upload image'}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={e => {
              onUpload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        <div className="ds-settings-row-sublabel">Your image stays in this browser — nothing is uploaded anywhere.</div>

        {custom && upload && (
          <div className="ap-focus">
            <button
              type="button"
              className="ap-focus-stage"
              aria-label="Set the focal point — the part of the image kept in view"
              style={{ backgroundImage: `url("${upload}")` }}
              onClick={e => {
                const r = e.currentTarget.getBoundingClientRect();
                s.setWpFocus({
                  x: Math.round(((e.clientX - r.left) / r.width) * 100),
                  y: Math.round(((e.clientY - r.top) / r.height) * 100),
                });
              }}
            >
              <span className="ap-focus-dot" style={{ left: `${s.wpFocus.x}%`, top: `${s.wpFocus.y}%` }} aria-hidden />
            </button>
            <div className="ap-focus-side">
              <div className="ds-settings-row-label">Focal point</div>
              <div className="ds-settings-row-sublabel">
                Click the part of the image to keep in view on any window size.
              </div>
              <Button size="sm" variant="ghost" onClick={removeUpload}>
                <Icon name="trash" size="sm" /> Remove image
              </Button>
            </div>
          </div>
        )}

        <div className="wp-effect-row">
          <span className="wp-effect-label">Blur</span>
          <Slider min={0} max={60} step={2} value={s.wpBlur} onChange={s.setWpBlur} aria-label="Wallpaper blur" />
          <span className="wp-effect-val">{s.wpBlur}px</span>
        </div>
        <div className="wp-effect-row">
          <span className="wp-effect-label">Opacity</span>
          <Slider
            min={0}
            max={100}
            step={5}
            value={s.wpOpacity}
            onChange={s.setWpOpacity}
            aria-label="Wallpaper opacity"
          />
          <span className="wp-effect-val">{s.wpOpacity}%</span>
        </div>
      </div>
    </div>
  );
}
