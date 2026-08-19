import React from 'react';

export interface ToggleButtonGroupOption {
  label: string;
  value: string;
}

export interface ToggleButtonGroupProps {
  options: ToggleButtonGroupOption[];
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  'aria-label'?: string;
}

/** Thin wrapper over the design system's pill-shaped `.ds-toggle-group`. */
export function ToggleButtonGroup({ options, value, onChange, className, 'aria-label': ariaLabel }: ToggleButtonGroupProps) {
  return (
    <div className={['ds-toggle-group', className].filter(Boolean).join(' ')} role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          className={'ds-toggle-group-btn' + (opt.value === value ? ' active' : '')}
          onClick={() => onChange?.(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
