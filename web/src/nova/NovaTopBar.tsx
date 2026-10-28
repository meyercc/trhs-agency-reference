import type { RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon, IconButton, ToggleButtonGroup, Tooltip } from '../components';
import { atLeast, usePageStep } from '../app/breakpoints';
import { NovaPopover } from './NovaPopover';
import { TokenomicsPopover } from './TokenomicsPopover';
import { NovaSettingsPopover } from './NovaSettingsPopover';
import type { NovaView } from './view';

const VIEWS: { label: string; value: NovaView }[] = [
  { label: 'Chat', value: 'chat' },
  { label: 'Agents', value: 'agents' },
];

/**
 * The bar under the shell nav: Nova's own views on the left, its two
 * popovers on the right. A plain flex row on purpose — see NovaPopover.
 */
export interface DrawerToggle {
  /** Open as a drawer (narrow widths). */
  open: boolean;
  /** Shown as a column (wide widths) — the show/hide preference (2026-10-20). */
  shown: boolean;
  toggle: () => void;
  ref: RefObject<HTMLButtonElement>;
  controls: string;
}

export function NovaTopBar({
  view,
  onView,
  conversations,
  context,
}: {
  view: NovaView;
  onView: (v: NovaView) => void;
  /** The rails' toggles — a drawer's open/close when narrow, the column's show/hide when wide. */
  conversations?: DrawerToggle;
  context?: DrawerToggle;
}) {
  const [, setParams] = useSearchParams();
  // Whether the rails are drawers right now — the page below `expanded`, the
  // same step nova.css queries (2026-10-20; they used to split at 900/1024
  // of WINDOW, and a page beside the Devices panel is narrower than its window).
  const drawer = !atLeast(usePageStep(), 'expanded');
  const leftDrawer = drawer;
  const rightDrawer = drawer;
  const expanded = (t: DrawerToggle, drawer: boolean) => (drawer ? t.open : t.shown);
  const tip = (t: DrawerToggle, drawer: boolean, what: string) => (drawer ? what.charAt(0).toUpperCase() + what.slice(1) : `${t.shown ? 'Hide' : 'Show'} ${what}`);
  const openForge = () =>
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('modal', 'agents');
      return p;
    });
  return (
    <div className="nova-topbar">
      <div className="nova-topbar-lead">
        {conversations && (
          <Tooltip content={tip(conversations, leftDrawer, 'conversations')} placement="bottom" className="nova-drawer-btn nova-drawer-btn-left">
            {/* `details` (a list), not `message`: since TH-434 the speech bubble
                is the shell's "Ask Nova" rail toggle, and one glyph naming two
                things in one view is how an icon language rots. */}
            <IconButton
              ref={conversations.ref}
              label={tip(conversations, leftDrawer, 'conversations')}
              aria-expanded={expanded(conversations, leftDrawer)}
              aria-controls={conversations.controls}
              onClick={conversations.toggle}
            >
              <Icon name="details" size={16} />
            </IconButton>
          </Tooltip>
        )}
        <ToggleButtonGroup
          aria-label="Nova views"
          options={VIEWS}
          value={view}
          onChange={(v) => onView(v as NovaView)}
        />
      </div>
      <div className="nova-topbar-actions">
        {context && (
          <Tooltip content={tip(context, rightDrawer, 'Treehouse context')} placement="bottom" className="nova-drawer-btn nova-drawer-btn-right">
            <IconButton
              ref={context.ref}
              label={tip(context, rightDrawer, 'Treehouse context')}
              aria-expanded={expanded(context, rightDrawer)}
              aria-controls={context.controls}
              onClick={context.toggle}
            >
              <Icon name="devices" size={16} />
            </IconButton>
          </Tooltip>
        )}
        {/* Forge, as the sidebar's header carries it. Until 2026-10-20 the
            shell's util slot showed Forge on this page; that slot is now
            "Back to sidebar", so the page carries its own. */}
        <Tooltip content="Forge" placement="bottom">
          <IconButton label="Forge" onClick={openForge}>
            <Icon name="ai" size={16} />
          </IconButton>
        </Tooltip>
        <NovaPopover id="nova-tokenomics" label="Tokenomics" icon="tokens">
          <TokenomicsPopover />
        </NovaPopover>
        <NovaPopover id="nova-settings" label="Nova settings" icon="settings">
          <NovaSettingsPopover />
        </NovaPopover>
      </div>
    </div>
  );
}
