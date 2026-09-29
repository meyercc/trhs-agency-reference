import React from 'react';
import { Icon, type IconName } from './Icon';
import { Tooltip } from './Tooltip';

export interface Ng3ToolProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  /** Glyph for the tab. */
  icon: IconName;
  /** The tab's name — its accessible label *and* its tooltip copy. */
  title: string;
  /** Selected tab. Carried by the icon's fill as well as its color, never color alone. */
  active?: boolean;
  /** Force the tooltip open (for the catalog); otherwise it shows on hover/focus. */
  tooltipOpen?: boolean;
}

/**
 * One tool in an `Ng3Panel`'s chamfered top tab — an icon-only tab button over
 * `.ds-ng3-tool`, wrapped in a `Tooltip` that names it on hover/focus.
 *
 * The icons are unlabelled, so the name has to arrive on demand: `title` feeds
 * both `aria-label` and the tooltip, which is what keeps the two from drifting.
 * Every device canvas renders its tab strip from `deviceTabs`, so they all get
 * the same affordance from one place.
 *
 * Avalonia: a ToggleButton in the tab ItemsControl with a ToolTip on the same
 * bound title, `IsChecked` driving the Active ControlTheme.
 */
export function Ng3Tool({ icon, title, active, tooltipOpen, className, ...rest }: Ng3ToolProps) {
  const classes = ['ds-ng3-tool', active ? 'active' : '', className].filter(Boolean).join(' ');
  return (
    <Tooltip content={title} placement="top" open={tooltipOpen}>
      <button type="button" className={classes} aria-label={title} aria-pressed={active} {...rest}>
        <Icon name={icon} />
      </button>
    </Tooltip>
  );
}
