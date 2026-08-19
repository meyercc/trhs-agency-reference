import React, { forwardRef, useId, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Tooltip, type TooltipPlacement } from './Tooltip';

export type InputVariant = 'standard' | 'search' | 'numeric' | 'hex';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visual preset. `search` adds a leading magnifier; `hex` a `#` prefix; `numeric` centers. */
  variant?: InputVariant;
  /** Error message — switches on the error border and shows a warning row beneath. */
  error?: string;
  /** Leading icon (overrides the `search` default). */
  leadingIcon?: IconName;
  /** Trailing icon rendered as a button (e.g. clear, copy). */
  trailingIcon?: IconName;
  /** Accessible label for the trailing icon button. */
  trailingLabel?: string;
  /** Click handler for the trailing icon button. */
  onTrailingClick?: () => void;
  /** When set, a trailing help icon reveals this tooltip on hover/focus. */
  tooltip?: ReactNode;
  /** Where the help tooltip sits relative to its icon. */
  tooltipPlacement?: TooltipPlacement;
  /** Help icon glyph (default `info`). */
  tooltipIcon?: IconName;
  /** Class on the input element itself. */
  className?: string;
  /** Class on the wrapping group. */
  wrapClassName?: string;
}

/**
 * Thin wrapper over the design system's `.ds-input`. Renders the Hadouken text
 * field with optional leading/trailing adornments, a `#` HEX prefix, an error
 * row, and — for variants whose icon carries help — a `Tooltip` shown on
 * hover/focus of that icon.
 *
 * Avalonia: a TextBox ControlTheme with adorner content presenters; the help
 * icon maps to a ToolTip on the trailing button.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    variant = 'standard',
    error,
    leadingIcon,
    trailingIcon,
    trailingLabel,
    onTrailingClick,
    tooltip,
    tooltipPlacement = 'top',
    tooltipIcon = 'info',
    className,
    wrapClassName,
    disabled,
    ...rest
  },
  ref,
) {
  const errorId = useId();
  const hasError = error != null && error !== '';

  const leading: IconName | undefined = leadingIcon ?? (variant === 'search' ? 'search' : undefined);
  const showHexPrefix = variant === 'hex';

  const inputClasses = [
    'ds-input',
    variant === 'numeric' ? 'center' : '',
    variant === 'hex' ? 'upper' : '',
    hasError ? 'error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={['ds-input-group', hasError ? 'has-error' : '', wrapClassName].filter(Boolean).join(' ')}>
      <div className="ds-input-wrap">
        {leading && (
          <span className="ds-input-icon left">
            <Icon name={leading} />
          </span>
        )}
        {showHexPrefix && <span className="ds-input-affix">#</span>}

        <input
          ref={ref}
          className={inputClasses}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          {...rest}
        />

        {tooltip != null ? (
          <Tooltip className="ds-input-icon" content={tooltip} placement={tooltipPlacement}>
            <button type="button" className="ds-tooltip-trigger" aria-label={trailingLabel ?? 'More information'}>
              <Icon name={tooltipIcon} />
            </button>
          </Tooltip>
        ) : (
          trailingIcon && (
            <button
              type="button"
              className="ds-input-icon interactive"
              aria-label={trailingLabel}
              onClick={onTrailingClick}
              disabled={disabled}
            >
              <Icon name={trailingIcon} />
            </button>
          )
        )}
      </div>

      {hasError && (
        <span className="ds-input-error" id={errorId}>
          <Icon name="alert" />
          {error}
        </span>
      )}
    </div>
  );
});
