import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ModalShell, Slider, Toggle, ToggleButtonGroup, Menu, type MenuItem } from '../components';
import { Icon, type IconName } from '../components/Icon';
import { useSettings, type Theme, type Density } from '../state/Settings';
import { WALLPAPERS } from '../app/wallpapers';
import '../widgets/widgets.css'; // wp-thumb / wg-swatch — same controls as the board widgets
import './settings-modal.css';

/** One label/sublabel + control row inside a settings group. */
function SettingsRow({
  label,
  sublabel,
  control,
}: {
  label: string;
  sublabel: string;
  control: React.ReactNode;
}) {
  return (
    <div className="ds-settings-row">
      <div className="ds-settings-row-labels">
        <div className="ds-settings-row-label">{label}</div>
        <div className="ds-settings-row-sublabel">{sublabel}</div>
      </div>
      {control}
    </div>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="ds-settings-group-header stx-static">
      <div className="ds-settings-group-titles">
        <div className="stx-group-title">{children}</div>
      </div>
    </div>
  );
}

// The three personas assembled by onboarding (Settings.persona). Re-picking here
// only retunes recommendations/defaults — it never reshapes the board or modules.
const PERSONA_OPTIONS = [
  { value: 'learner', label: 'Guided' },
  { value: 'tinkerer', label: 'Hands-on' },
  { value: 'minimalist', label: 'Minimal' },
];
const PERSONA_BLURB: Record<string, string> = {
  learner: 'OMEN AI takes the lead, with explanations along the way',
  tinkerer: 'Manual controls and advanced surfaces, front and center',
  minimalist: 'Just your devices — nothing extra',
};

const PREVIEW_TABS: MenuItem[] = [
  { id: 'home', label: 'Dashboard', icon: <Icon name="home" />, active: true },
  { id: 'play', label: 'Play', icon: <Icon name="play" /> },
  { id: 'perform', label: 'Perform', icon: <Icon name="performance" /> },
  { id: 'personalize', label: 'Personalize', icon: <Icon name="profile" /> },
];

const ACCENTS = ['cyan', 'indigo', 'purple', 'orange', 'green', 'red', 'yellow'];

type Section = 'appearance' | 'navigation' | 'setup';
const SECTIONS: { id: Section; label: string; icon: IconName }[] = [
  { id: 'appearance', label: 'Appearance', icon: 'color-palette' },
  { id: 'navigation', label: 'Navigation', icon: 'grid' },
  { id: 'setup', label: 'Setup', icon: 'sparks' },
];

/**
 * App preferences modal (`?modal=settings`) on the sectioned modal pattern
 * (ModalShell + `.ds-modal-nav` in the left slot, like the Module Browser).
 * Sections hold only what exists today: Appearance (theme / accent /
 * wallpaper — the app-appearance controls that used to sit on the Personalize
 * page), Navigation (nav label/icon toggles + live preview), Setup (experience
 * style + redo). New sections drop into SECTIONS with their content below.
 */
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const {
    theme, setTheme, accent, setAccent, density, setDensity,
    wallpaper, setWallpaper, wpBlur, setWpBlur, wpOpacity, setWpOpacity, isLight,
    hideNavLabels, setHideNavLabels, hideNavIcons, setHideNavIcons,
    persona, setPersona,
  } = useSettings();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('appearance');

  // Leaving for the full-screen flow: the route change drops ?modal=settings.
  const redoSetup = () => navigate('/onboarding');

  // Never let both labels and icons be hidden — that leaves empty nav items.
  // Hiding one forces the other visible.
  const onShowLabels = (show: boolean) => {
    setHideNavLabels(!show);
    if (!show && hideNavIcons) setHideNavIcons(false);
  };
  const onShowIcons = (show: boolean) => {
    setHideNavIcons(!show);
    if (!show && hideNavLabels) setHideNavLabels(false);
  };

  const nav = (
    <nav className="ds-modal-nav" aria-label="Settings sections">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          className={'ds-modal-nav-item' + (section === s.id ? ' active' : '')}
          onClick={() => setSection(s.id)}
        >
          <Icon name={s.icon} size={15} aria-hidden />
          <span>{s.label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <ModalShell title="Settings" className="settings-modal" onClose={onClose} left={nav}>
      {section === 'appearance' && (
        <div className="ds-settings-group expanded">
          <GroupTitle>Appearance</GroupTitle>
          <div className="ds-settings-group-items">
            <SettingsRow
              label="Theme"
              sublabel="Dark, light, or follow the system"
              control={
                <ToggleButtonGroup
                  aria-label="Theme"
                  value={theme}
                  onChange={(v) => setTheme(v as Theme)}
                  options={[
                    { label: 'Dark', value: 'dark' },
                    { label: 'Light', value: 'light' },
                    { label: 'System', value: 'system' },
                  ]}
                />
              }
            />
            <SettingsRow
              label="Density"
              sublabel="How much breathing room the layout gets"
              control={
                <ToggleButtonGroup
                  aria-label="Density"
                  value={density}
                  onChange={(v) => setDensity(v as Density)}
                  options={[
                    { label: 'Comfortable', value: 'comfortable' },
                    { label: 'Compact', value: 'compact' },
                  ]}
                />
              }
            />
            <SettingsRow
              label="Accent Color"
              sublabel="Used for selection, focus, and highlights across the app"
              control={
                <div className="wg-swatch-row" role="group" aria-label="Accent color">
                  {ACCENTS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-label={id}
                      aria-pressed={accent === id}
                      className="wg-swatch"
                      onClick={() => setAccent(id)}
                      style={{
                        background: `var(--accent-${id})`,
                        borderColor: accent === id ? 'var(--text-primary)' : undefined,
                        transform: accent === id ? 'scale(1.12)' : undefined,
                      }}
                    />
                  ))}
                </div>
              }
            />
            <div className="stx-wallpaper">
              <div className="stx-preview-label">Wallpaper</div>
              <div className="wp-thumbs">
                {WALLPAPERS.map((wp) => {
                  const img = (isLight ? wp.light : wp.dark).img;
                  const active = wallpaper === wp.id;
                  return (
                    <button
                      key={wp.id}
                      type="button"
                      className={active ? 'wp-thumb is-active' : 'wp-thumb'}
                      aria-label={wp.name}
                      aria-pressed={active}
                      onClick={() => setWallpaper(wp.id)}
                      style={{ backgroundImage: `url("${img}")` }}
                    >
                      <span className="wp-thumb-name">{wp.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="wp-effect-row">
                <span className="wp-effect-label">Blur</span>
                <Slider min={0} max={60} step={2} value={wpBlur} onChange={setWpBlur} aria-label="Wallpaper blur" />
                <span className="wp-effect-val">{wpBlur}px</span>
              </div>
              <div className="wp-effect-row">
                <span className="wp-effect-label">Opacity</span>
                <Slider min={0} max={100} step={5} value={wpOpacity} onChange={setWpOpacity} aria-label="Wallpaper opacity" />
                <span className="wp-effect-val">{wpOpacity}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'navigation' && (
        <div className="ds-settings-group expanded">
          <GroupTitle>Navigation</GroupTitle>
          <div className="ds-settings-group-items">
            <SettingsRow
              label="Show Nav Labels"
              sublabel="Display text labels on the Dashboard, Play, Perform, Personalize, and Shop tabs"
              control={<Toggle checked={!hideNavLabels} onChange={onShowLabels} />}
            />
            <SettingsRow
              label="Show Nav Icons"
              sublabel="Display icons on the Dashboard, Play, Perform, Personalize, and Shop tabs"
              control={<Toggle checked={!hideNavIcons} onChange={onShowIcons} />}
            />
            <div className="stx-preview">
              <div className="stx-preview-label">Preview</div>
              <Menu
                items={PREVIEW_TABS}
                orientation="horizontal"
                hideLabels={hideNavLabels}
                hideIcons={hideNavIcons}
                aria-label="Navigation preview"
              />
            </div>
          </div>
        </div>
      )}

      {section === 'setup' && (
        <div className="ds-settings-group expanded">
          <GroupTitle>Setup</GroupTitle>
          <div className="ds-settings-group-items">
            <SettingsRow
              label="Experience Style"
              sublabel={
                PERSONA_BLURB[persona] ??
                'Pick how Treehouse tailors itself — or redo setup to be guided through it'
              }
              control={
                <ToggleButtonGroup
                  options={PERSONA_OPTIONS}
                  value={persona}
                  onChange={setPersona}
                  aria-label="Experience style"
                />
              }
            />
            <SettingsRow
              label="Redo Setup"
              sublabel="Re-run first-time setup to re-pick your style, modules, and dashboard from scratch"
              control={
                <Button size="sm" onClick={redoSetup}>
                  Redo setup
                </Button>
              }
            />
          </div>
        </div>
      )}
    </ModalShell>
  );
}
