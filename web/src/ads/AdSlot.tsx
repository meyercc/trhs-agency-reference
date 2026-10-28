import { adLabel, type AdSize } from './ads';
import './ads.css';

export interface AdSlotProps {
  /** The ad unit: a 300×250 tile or a 728×90 banner. */
  size: AdSize;
  className?: string;
}

/**
 * One ad unit, at its fixed IAB dimensions. Until there is real creative it
 * renders a plain fill with the unit's size as its caption — `300x250` — so a
 * screenshot says what the slot is without anyone measuring it. Placement is
 * the caller's job: `AdHost` fixes it to the viewport, `Home` sets it inline.
 *
 * Marked as complementary content with a label, so a screen reader announces
 * an advertisement region rather than a mystery box.
 */
export function AdSlot({ size, className }: AdSlotProps) {
  const label = adLabel(size);
  return (
    <aside
      className={['ad-slot', `ad-slot--${size}`, className].filter(Boolean).join(' ')}
      aria-label={`Advertisement, ${label}`}
      data-ad-size={label}
    >
      <span className="ad-slot-label" aria-hidden="true">
        {label}
      </span>
    </aside>
  );
}
