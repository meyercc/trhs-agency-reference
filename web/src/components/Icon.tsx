import React from 'react';
import sprite from '../../../shared/icons.svg';
import type { IconName } from './icon-names';

export type { IconName };
export type IconSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<IconSize, number> = { sm: 16, md: 20, lg: 24 };

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name'> {
  /** Icon id from the sprite (without the `icon-` prefix). */
  name: IconName;
  /** Token size (`sm` 16 · `md` 20 · `lg` 24) or an explicit pixel number. */
  size?: IconSize | number;
  /** Accessible name. Omit for decorative icons (rendered `aria-hidden`). */
  label?: string;
}

/**
 * Renders a symbol from `shared/icons.svg`. Inherits color via `currentColor`;
 * `size` controls the box; `label` toggles between meaningful (role=img) and
 * decorative (aria-hidden). The single way to render a set icon.
 *
 * Avalonia: a PathIcon / shared icon resource keyed by name.
 */
export function Icon({ name, size = 'md', label, className, ...rest }: IconProps) {
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  return (
    <svg
      className={['ds-icon', className].filter(Boolean).join(' ')}
      width={px}
      height={px}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      {label && <title>{label}</title>}
      <use href={`${sprite}#icon-${name}`} />
    </svg>
  );
}
