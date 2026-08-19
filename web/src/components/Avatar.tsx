import React from 'react';

export type AvatarVariant = 'empty' | 'wallpaper' | 'app' | 'custom';

export interface AvatarProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Content treatment (Figma: Profile Thumbnail variants). */
  variant?: AvatarVariant;
  /** Image source — required for `app` (inset glyph) and `custom` (cover photo). */
  src?: string;
  /** Alt text for the image variants. */
  alt?: string;
  /** Diameter in px (default 24). */
  size?: number;
}

/**
 * Round profile thumbnail / avatar — a double-ringed circle. Thin wrapper over
 * the design system's `.ds-avatar` (shared/components.css). `app` renders the
 * `src` as a centered inset glyph; `custom` renders it cover-filling.
 */
export function Avatar({ variant = 'empty', src, alt = '', size, className, style, ...rest }: AvatarProps) {
  const classes = ['ds-avatar', variant === 'wallpaper' ? 'wallpaper' : '', className].filter(Boolean).join(' ');
  return (
    <span
      className={classes}
      style={size ? { ...style, ['--avatar-size' as string]: `${size}px` } : style}
      {...rest}
    >
      {variant === 'app' && src && <img className="ds-avatar-icon" src={src} alt={alt} />}
      {variant === 'custom' && src && <img className="ds-avatar-img" src={src} alt={alt} />}
    </span>
  );
}
