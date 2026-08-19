import React from 'react';

export type ButtonVariant = 'default' | 'accent' | 'ghost';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. `default` is the base `.ds-btn`. */
  variant?: ButtonVariant;
  /** `sm` adds the compact `.ds-btn.sm` modifier. */
  size?: ButtonSize;
  /**
   * For buttons sitting on artwork (carousel CTAs, hero overlays). Artwork is
   * dark in both themes, so this keeps the dark treatment in light theme
   * instead of letting the button follow the page and go near-invisible.
   */
  onImage?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: '',
  accent: 'accent',
  ghost: 'ghost',
};

/**
 * Thin wrapper over the design system's `.ds-btn`. Renders the same classes
 * the prototype uses, so the look stays sourced from components.css.
 */
export function Button({ variant = 'default', size = 'md', onImage, className, children, ...rest }: ButtonProps) {
  const classes = ['ds-btn', VARIANT_CLASS[variant], size === 'sm' ? 'sm' : '', onImage ? 'on-image' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
