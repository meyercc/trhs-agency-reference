import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar, ContextMenu, ContextMenuLabel, ListItem, Separator, ToggleButtonGroup, Icon } from '../components';
import { useSettings, type Theme } from '../state/Settings';
// Stand-in profile photo (custom avatar variant). Figma's asset URLs expire.
import profilePhoto from '../../../Assets/wallpapers/purple-dark.webp';

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
 * (identity, sign out, admin). The app's *profiles* — Gaming, Work, Music — are
 * a different concept entirely, and they now sit in their own switcher to the
 * left of this one, so the two must not share a word.
 */
export function AccountMenu() {
  const { theme, setTheme } = useSettings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // Admin submenu (hover/focus flyout off the "Admin Panel" row).
  const [adminOpen, setAdminOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const wrap = useRef<HTMLDivElement>(null);

  const openModal = (id: string) => {
    setOpen(false);
    const p = new URLSearchParams(params);
    p.set('modal', id);
    setParams(p);
  };
  const openSettings = () => openModal('settings');

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
        <Avatar variant="custom" src={profilePhoto} alt="" size={30} />
      </button>

      {open && (
        <ContextMenu className="account-menu">
          <div className="am-header">
            <Avatar variant="custom" src={profilePhoto} alt="" size={36} />
            <div>
              <div className="am-name">UserName</div>
              <div className="am-email">arcanerider@xyz.com</div>
            </div>
          </div>

          <ListItem
            label="Settings"
            leading={<Icon name="settings" size={14} />}
            onClick={openSettings}
          />

          <ContextMenuLabel>Appearance</ContextMenuLabel>
          <div className="am-appearance">
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
          </div>

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
