import React, { type ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './icon-names';

export type StatTileTone = 'accent' | 'neutral' | 'positive';

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The stat's name — mono, uppercase, above the number. */
  label: string;
  /** The number, already formatted ("12.4k", "$0.42", "73"). */
  value: ReactNode;
  /** A unit after the number, small and dim ("Wh", "%"). */
  unit?: string;
  /** A line under the number: the change, the period, a caveat ("estimated"). */
  delta?: ReactNode;
  /** Color of the number. `accent` is the stat display's default. */
  tone?: StatTileTone;
  /** A small icon beside the label. */
  icon?: IconName;
  /** The HUD size: tighter padding, a smaller number, no delta line (TH-438). */
  compact?: boolean;
}

const TONE_CLASS: Record<StatTileTone, string> = { accent: '', neutral: 'neutral', positive: 'positive' };

/**
 * One number with its name — the design system's `.ds-stat-tile`
 * (shared/components.css), composing the stat typography the dashboards
 * already use (`.ds-stat-val` / `-unit` / `-lbl`). The host sets the number's
 * size with `--ds-stat-tile-size` when the default is wrong for the room.
 *
 * Avalonia: a Border with a vertical StackPanel — TextBlock (label style),
 * TextBlock (stat style, tone brush), TextBlock (caption).
 */
export function StatTile({ label, value, unit, delta, tone = 'accent', icon, compact, className, ...rest }: StatTileProps) {
  const classes = ['ds-stat-tile', TONE_CLASS[tone], compact ? 'compact' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      <div className="ds-stat-tile-head">
        {icon && <Icon name={icon} size="sm" />}
        <span className="ds-stat-lbl">{label}</span>
      </div>
      <div className="ds-stat-val">
        {value}
        {unit && <span className="ds-stat-unit">{unit}</span>}
      </div>
      {delta != null && <div className="ds-stat-tile-delta">{delta}</div>}
    </div>
  );
}
