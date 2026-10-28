import { Icon } from './Icon';

export type RatingSize = 'sm' | 'md' | 'lg';

export interface RatingProps {
  /** 0–5. Fractions fill part of a star. */
  value: number;
  size?: RatingSize;
  /**
   * Makes it an input: a radiogroup of five star buttons. Without it the stars
   * are a single image announced as "4.3 out of 5 stars".
   */
  onChange?: (stars: number) => void;
  /** The radiogroup's name — required for the input, ignored for display. */
  label?: string;
  /** Per-star wording for the input ("Excellent"); index 0 is one star. */
  starLabels?: string[];
  disabled?: boolean;
  className?: string;
}

const SIZE_CLASS: Record<RatingSize, string> = { sm: 'sm', md: '', lg: 'lg' };

/**
 * Thin wrapper over `.ds-rating` / `.ds-rating-input` (shared/components.css).
 *
 * Display draws a filled row clipped over an outline row, so a partial star
 * reads by shape rather than only by color. Input is a WAI-ARIA radiogroup:
 * each star is a `role="radio"` button and Arrow keys move the choice.
 *
 * Avalonia: a `RatingControl`-style ItemsControl of five PathIcons — display
 * as a Grid with the filled row in a clipped Border over the outline row;
 * input as a ListBox with SelectionMode=Single and a star ItemTemplate.
 */
export function Rating({ value, size = 'md', onChange, label, starLabels, disabled, className }: RatingProps) {
  const stars = [1, 2, 3, 4, 5];
  if (onChange) {
    const pick = (n: number) => !disabled && onChange(Math.min(5, Math.max(1, n)));
    return (
      <div className={['ds-rating-input', className].filter(Boolean).join(' ')} role="radiogroup" aria-label={label}>
        {stars.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            className={k <= value ? 'on' : undefined}
            aria-checked={k === Math.round(value)}
            aria-label={`${k} star${k > 1 ? 's' : ''}${starLabels?.[k - 1] ? `: ${starLabels[k - 1]}` : ''}`}
            // Roving tabindex: one stop for the group, on the checked star.
            tabIndex={k === (Math.round(value) || 1) ? 0 : -1}
            disabled={disabled}
            onClick={() => pick(k)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                pick(k + 1);
                (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus();
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                pick(k - 1);
                (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus();
              }
            }}
          >
            <Icon name={k <= value ? 'star-fill' : 'star'} aria-hidden />
          </button>
        ))}
      </div>
    );
  }
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={['ds-rating', SIZE_CLASS[size], className].filter(Boolean).join(' ')} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      <span className="ds-rating-row" aria-hidden>
        {stars.map((k) => (
          <Icon key={k} name="star" />
        ))}
      </span>
      <span className="ds-rating-row ds-rating-fill" style={{ width: `${pct}%` }} aria-hidden>
        {stars.map((k) => (
          <Icon key={k} name="star-fill" />
        ))}
      </span>
    </span>
  );
}
