import React, { forwardRef, useId } from 'react';
import { Icon } from './Icon';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Error message — switches on the error border and shows a warning row beneath. */
  error?: string;
  /** Class on the wrapping group. */
  wrapClassName?: string;
}

/**
 * Thin wrapper over the design system's `textarea.ds-input`. The multi-line
 * Hadouken field — same double-stroke border, surface, and focus/error states
 * as `Input`, with a custom pill scrollbar and an optional error row.
 *
 * Avalonia: a TextBox ControlTheme with AcceptsReturn + TextWrapping; the error
 * row maps to a DataValidationErrors template.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { error, className, wrapClassName, rows = 6, disabled, ...rest },
  ref,
) {
  const errorId = useId();
  const hasError = error != null && error !== '';

  const classes = ['ds-input', hasError ? 'error' : '', className].filter(Boolean).join(' ');

  return (
    <div className={['ds-input-group', hasError ? 'has-error' : '', wrapClassName].filter(Boolean).join(' ')}>
      <textarea
        ref={ref}
        className={classes}
        rows={rows}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        {...rest}
      />
      {hasError && (
        <span className="ds-input-error" id={errorId}>
          <Icon name="alert" />
          {error}
        </span>
      )}
    </div>
  );
});
