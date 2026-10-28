import { useSettings } from '../state/Settings';
import { AD_OPTION_BY_VALUE } from './ads';
import { AdSlot } from './AdSlot';
import './ads.css';

/**
 * The fixed placements — the ones that follow every page. Mounted once, in the
 * app shell, beside the other floating chrome. Renders nothing unless Admin has
 * chosen a fixed placement, so a fresh install carries no ad markup at all.
 *
 * The inline placement (Banner Below Carousel) is NOT here: it belongs to the
 * home dashboard and `Home` renders it in flow, between the carousel and the
 * board, where "below the carousel" actually means something.
 */
export function AdHost() {
  const { adPlacement, adObscure, adUnlocked } = useSettings();
  // Gated on the unlock as well as the placement: a placement left in storage
  // from before the row was locked must not keep rendering with no visible
  // control over it.
  if (!adUnlocked) return null;
  const option = AD_OPTION_BY_VALUE[adPlacement];
  if (option.where !== 'fixed' || !option.size) return null;

  const banner = adPlacement === 'bottom-banner';
  return (
    <>
      {/* The "Obscure background" strip: full width, the banner's height, behind
          the ad and above the content. It blurs what scrolls under the banner so
          the ad reads on a quiet ground. Its look is deliberately its own rule in
          ads.css — Chris may swap the blur for a solid fill later — and it is
          `aria-hidden` because it carries no content of its own. */}
      {banner && adObscure && <div className="ad-obscure" aria-hidden="true" />}
      <div className={'ad-host ad-host--' + adPlacement} data-ad-placement={adPlacement}>
        <AdSlot size={option.size} />
      </div>
    </>
  );
}
