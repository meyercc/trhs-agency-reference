import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ContextMenu, ContextMenuLabel, ListItem, Separator, Toggle, ToggleButtonGroup, Icon } from '../components';
import { useSettings, type Theme } from '../state/Settings';
import { UserAvatar } from './UserAvatar';

const AdminGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8.5 2.5a3 3 0 0 0-4 4L2 9l1.5 1.5 2.5-2.5a3 3 0 0 0 4-4L8.5 5.5 7 4l1.5-1.5z" />
  </svg>
);
const SignOutGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h2M10 10l3-3-3-3M13 7H5" />
  </svg>
);

/**
 * Account avatar + dropdown in the top-right of the nav (ports vanilla `user-menu`).
 *
 * Named Account, not Profile: everything in it is about the signed-in ACCOUNT
 * (identity, sign out, admin). The app's *profiles* live in their own switcher
 * to the left of this one, so the two must not share a word.
 */
export function AccountMenu() {
  const { setTheme, useSystemTheme, setUseSystemTheme, themeChoice, displayName, showSimulator, setShowSimulator } = useSettings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // Admin submenu (hover/focus flyout off the "Admin Panel" row).
  const [adminOpen, setAdminOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const wrap = useRef<HTMLDivElement>(null);

  const openModal = (id: string, tab?: string) => {
    setOpen(false);
    const p = new URLSearchParams(params);
    p.set('modal', id);
    if (tab) p.set('tab', tab);
    else p.delete('tab');
    setParams(p);
  };
  // One Settings modal: the header opens Account › Profile, "Settings" the App side.
  const openSettings = () => openModal('settings', 'appearance');

  // Admin submenu actions: close the whole dropdown, then act.
  const goAdmin = (fn: () => void) => {
    setOpen(false);
    setAdminOpen(false);
    fn();
  };

  // Collapse the admin submenu whenever the whole dropdown closes.
  useEffect(() => {
    if (!open) setAdminOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="account-menu-wrap" ref={wrap}>
      <button
        type="button"
        className={'account-menu-btn' + (open ? ' active' : '')}
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <UserAvatar size={30} />
      </button>

      {open && (
        <ContextMenu className="account-menu">
          <button type="button" className="am-header" onClick={() => openModal('settings', 'profile')}>
            <UserAvatar size={36} />
            <div>
              <div className="am-name">{displayName}</div>
              <div className="am-email">View profile</div>
            </div>
          </button>

          <ListItem
            label="Settings"
            leading={<Icon name="settings" size={14} />}
            onClick={openSettings}
          />

          <Separator />
          {/* Two questions, asked in order: follow the OS, or — if not — which
              of the two. The Dark/Light group is hidden while the system is
              answering, and comes back on the user's last pick. */}
          <ContextMenuLabel>Appearance</ContextMenuLabel>
          <ListItem
            label="Use system theme"
            trailing={<Toggle checked={useSystemTheme} onChange={setUseSystemTheme} aria-label="Use system theme" />}
            onClick={() => setUseSystemTheme(!useSystemTheme)}
          />
          {!useSystemTheme && (
            <div className="am-appearance">
              <ToggleButtonGroup
                aria-label="Theme"
                value={themeChoice}
                onChange={(v) => setTheme(v as Theme)}
                options={[
                  { label: 'Dark', value: 'dark' },
                  { label: 'Light', value: 'light' },
                ]}
              />
            </div>
          )}

          <Separator />
          <div
            className="am-admin-wrap"
            onMouseEnter={() => setAdminOpen(true)}
            onMouseLeave={() => setAdminOpen(false)}
            onFocus={() => setAdminOpen(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setAdminOpen(false);
            }}
          >
            <ListItem
              className="am-accent am-admin-trigger"
              label="Admin Panel"
              leading={<AdminGlyph />}
              trailing={<Icon name="chevron-left" size={14} />}
              aria-haspopup="menu"
              aria-expanded={adminOpen}
              onClick={() => setAdminOpen((o) => !o)}
            />
            {adminOpen && (
              <ContextMenu className="am-submenu" aria-label="Admin">
                <ListItem
                  label="Admin Settings"
                  leading={<Icon name="settings" size={14} />}
                  onClick={() => goAdmin(() => openModal('admin'))}
                />
                <ListItem
                  label="Atlas"
                  leading={<Icon name="share" size={14} />}
                  onClick={() => goAdmin(() => navigate('/map'))}
                />
                <ListItem
                  label="Metro"
                  leading={<Icon name="grid" size={14} />}
                  onClick={() => goAdmin(() => navigate('/metro'))}
                />
                {/* The four-card dashboard concept we put beside our partners'
                    visual concepts. Sits next to Metro because it answers the
                    same question — what else could the dashboard be. */}
                <ListItem
                  label="Dashboard Concept"
                  leading={<Icon name="home" size={14} />}
                  onClick={() => goAdmin(() => navigate('/home-v2'))}
                />
                <ListItem
                  label="SKU Registry"
                  leading={<Icon name="devices" size={14} />}
                  onClick={() => goAdmin(() => navigate('/registry'))}
                />
                {/* The review's switches (Machine, Scope, OMEN AI, Session):
                    off until someone asks, so a first look is the product. */}
                <ListItem
                  label="Simulator"
                  leading={<Icon name="eq" size={14} />}
                  trailing={<Toggle checked={showSimulator} onChange={setShowSimulator} aria-label="Show the Simulator" />}
                  onClick={() => setShowSimulator(!showSimulator)}
                />
              </ContextMenu>
            )}
          </div>
          <Separator />
          <ListItem
            className="am-danger"
            label="Sign Out"
            leading={<SignOutGlyph />}
            onClick={() => setOpen(false)}
          />
        </ContextMenu>
      )}
    </div>
  );
}
