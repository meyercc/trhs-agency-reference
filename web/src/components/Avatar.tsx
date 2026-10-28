import React from 'react';

export type AvatarVariant = 'empty' | 'wallpaper' | 'app' | 'custom' | 'initials';

export interface AvatarProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Content treatment (Figma: Profile Thumbnail variants). */
  variant?: AvatarVariant;
  /** Image source — required for `app` (inset glyph) and `custom` (cover photo). */
  src?: string;
  /** Alt text for the image variants. */
  alt?: string;
  /**
   * The monogram for `initials` — a person with no photo (Who Made This's cast
   * rows, 2026-10-26). Two letters; the name itself goes beside the avatar,
   * so the letters are decorative.
   */
  initials?: string;
  /** Diameter in px (default 24). */
  size?: number;
}

/**
 * Round profile thumbnail / avatar — a double-ringed circle. Thin wrapper over
 * the design system's `.ds-avatar` (shared/components.css). `app` renders the
 * `src` as a centered inset glyph; `custom` renders it cover-filling;
 * `initials` a monogram on a solid surface.
 */
export function Avatar({ variant = 'empty', src, alt = '', initials, size, className, style, ...rest }: AvatarProps) {
  const classes = ['ds-avatar', variant === 'wallpaper' ? 'wallpaper' : '', variant === 'initials' ? 'initials' : '', className].filter(Boolean).join(' ');
  return (
    <span
      className={classes}
      style={size ? { ...style, ['--avatar-size' as string]: `${size}px` } : style}
      {...rest}
    >
      {variant === 'app' && src && <img className="ds-avatar-icon" src={src} alt={alt} />}
      {variant === 'custom' && src && <img className="ds-avatar-img" src={src} alt={alt} />}
      {variant === 'initials' && initials && (
        <span className="ds-avatar-initials" aria-hidden="true">
          {initials}
        </span>
      )}
    </span>
  );
}
