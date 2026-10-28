import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ModalShell, Toggle, ToggleButtonGroup, Menu, type MenuItem } from '../components';
import { Icon, type IconName } from '../components/Icon';
import { useSettings } from '../state/Settings';
import { AppearancePanel } from '../app/appearance/AppearancePanel';
import { GroupTitle, SettingsRow } from './settingsParts';
import { DEVICES_ITEM, useVisibleNavTabs } from '../app/navItems';
import { AccountsSection, ProfileSection } from './accountSections';
import './settings-modal.css';

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

export type SettingsSection = 'profile' | 'accounts' | 'appearance' | 'navigation' | 'setup';
// Two groups, one modal: Account is who you are, App is how Treehouse behaves.
const GROUPS: { label: string; sections: { id: SettingsSection; label: string; icon: IconName }[] }[] = [
  {
    label: 'Account',
    sections: [
      { id: 'profile', label: 'Profile', icon: 'profile' },
      { id: 'accounts', label: 'Linked accounts', icon: 'link-on' },
    ],
  },
  {
    label: 'App',
    sections: [
      { id: 'appearance', label: 'Appearance', icon: 'color-palette' },
      { id: 'navigation', label: 'Navigation', icon: 'grid' },
      { id: 'setup', label: 'Setup', icon: 'sparks' },
    ],
  },
];
const ALL_SECTIONS = GROUPS.flatMap((g) => g.sections);

/**
 * The one Settings modal (`?modal=settings&tab=<section>`) on the sectioned
 * modal pattern (ModalShell + `.ds-modal-nav` in the left slot, like the
 * Module Browser), in two groups:
 *   Account — Profile (avatar, name) and Linked accounts. The avatar menu opens
 *             here (`tab=profile`); `?modal=profile` is kept as an alias.
 *   App     — Appearance (theme / accent / wallpaper / Looks), Navigation,
 *             Setup (experience style + redo).
 * Every setting has exactly one home. Modes are not here — they live with the
 * desk in Personalize; the avatar menu's theme switch is a shortcut to the
 * same setting as Appearance.
 */
export function SettingsModal({ onClose, initialSection = 'appearance' }: { onClose: () => void; initialSection?: string }) {
  const { hideNavLabels, setHideNavLabels, hideNavIcons, setHideNavIcons, persona, setPersona, getBaseline } = useSettings();
  // The preview is the real nav (same items, same order, same module gating),
  // stripped of links so clicking it can't navigate away from Settings.
  const navItems = [...useVisibleNavTabs(), DEVICES_ITEM];
  const previewTabs: MenuItem[] = navItems.map(({ to: _to, end: _end, ...item }, i) => ({
    ...item,
    active: i === 0,
  }));
  const navNames = navItems.map((t) => t.label);
  const navList = `${navNames.slice(0, -1).join(', ')}, and ${navNames[navNames.length - 1]}`;
  const navigate = useNavigate();
  const [section, setSection] = useState<SettingsSection>(
    ALL_SECTIONS.some((s) => s.id === initialSection) ? (initialSection as SettingsSection) : 'appearance',
  );

  // These rows write the baseline, so they must render the baseline — showing
  // the resolved value would make an overridden control look unresponsive.
  // `OverrideNote` is what explains the gap.
  const accent = getBaseline<string>('accent');
  const wallpaper = getBaseline<string>('wallpaper');
  const wpBlur = getBaseline<number>('wpBlur');
  const wpOpacity = getBaseline<number>('wpOpacity');

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
      {GROUPS.map((g) => (
        <div key={g.label} role="group" aria-label={g.label} className="stx-nav-group">
          <div className="ds-modal-nav-label">{g.label}</div>
          {g.sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={'ds-modal-nav-item' + (section === s.id ? ' active' : '')}
              aria-current={section === s.id ? 'page' : undefined}
              onClick={() => setSection(s.id)}
            >
              <Icon name={s.icon} size={15} aria-hidden />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <ModalShell title="Settings" className="stx-modal settings-modal" onClose={onClose} left={nav}>
      {section === 'profile' && (
        <div className="ds-settings-group expanded">
          <GroupTitle>Profile</GroupTitle>
          <div className="ds-settings-group-items">
            <ProfileSection onClose={onClose} />
          </div>
        </div>
      )}

      {section === 'accounts' && (
        <div className="ds-settings-group expanded">
          <GroupTitle>Linked accounts</GroupTitle>
          <div className="ds-settings-group-items">
            <AccountsSection />
          </div>
        </div>
      )}

      {section === 'appearance' && (
        <div className="ds-settings-group expanded">
          <GroupTitle>Appearance</GroupTitle>
          <div className="ds-settings-group-items">
            <AppearancePanel />
          </div>
        </div>
      )}

      {section === 'navigation' && (
        <div className="ds-settings-group expanded">
          <GroupTitle>Navigation</GroupTitle>
          <div className="ds-settings-group-items">
            <SettingsRow
              label="Show Nav Labels"
              sublabel={`Display text labels on ${navList}`}
              control={<Toggle checked={!hideNavLabels} onChange={onShowLabels} />}
            />
            <SettingsRow
              label="Show Nav Icons"
              sublabel={`Display icons on ${navList}`}
              control={<Toggle checked={!hideNavIcons} onChange={onShowIcons} />}
            />
            <div className="stx-preview">
              <div className="stx-preview-label">Preview</div>
              <Menu
                items={previewTabs}
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
