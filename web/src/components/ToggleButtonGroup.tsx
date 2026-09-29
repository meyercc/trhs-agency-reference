import React from 'react';
import { Icon } from './Icon';
import type { IconName } from './icon-names';

export interface ToggleButtonGroupOption {
  /** The option's name. Shown as text, or as the accessible name when the group is `iconOnly`. */
  label: string;
  value: string;
  /** A sprite icon shown before the label (or alone when the group is `iconOnly`). */
  icon?: IconName;
}

export interface ToggleButtonGroupProps {
  options: ToggleButtonGroupOption[];
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  /**
   * Span the container, options sharing the width evenly. For a group that is
   * the whole control in its row; the default sizes to its content so it reads
   * as a chip beside other things.
   */
  fullWidth?: boolean;
  /** Icons only: each option's `label` becomes its accessible name and tooltip. */
  iconOnly?: boolean;
  'aria-label'?: string;
}

/** Thin wrapper over the design system's pill-shaped `.ds-toggle-group`. */
export function ToggleButtonGroup({ options, value, onChange, className, fullWidth, iconOnly, 'aria-label': ariaLabel }: ToggleButtonGroupProps) {
  return (
    <div className={['ds-toggle-group', fullWidth ? 'full' : '', className].filter(Boolean).join(' ')} role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          className={'ds-toggle-group-btn' + (opt.value === value ? ' active' : '') + (iconOnly ? ' icon-only' : '')}
          aria-label={iconOnly ? opt.label : undefined}
          title={iconOnly ? opt.label : undefined}
          onClick={() => onChange?.(opt.value)}
        >
          {opt.icon && (
            <span className="ds-toggle-group-icon">
              <Icon name={opt.icon} size={16} />
            </span>
          )}
          {!iconOnly && opt.label}
        </button>
      ))}
    </div>
  );
}
