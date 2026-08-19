import type { CarouselSlide } from '../components';
import render01 from '../../../Assets/hero/evgeny-rodygin-render01.gif';
import headsetSale from '../../../Assets/hero/hyperx-headset-sale.webp';
import controlResonant from '../../../Assets/hero/control-resonant.webp';
import omen45max from '../../../Assets/hero/omen45max.webp';
import fanaticalSale from '../../../Assets/hero/fanatical-sale.webp';

/** The five home hero slides (content only — the page wires CTA navigation). */
export const HOME_SLIDES: CarouselSlide[] = [
  {
    image: render01,
    title: (
      <>
        OMEN AI
        <br />
        Is Here
      </>
    ),
    desc: 'Adaptive tuning. OMEN AI learns the best configurations specifically for your machine.',
    primary: { label: 'Try It Now' },
    ghost: { label: 'Learn More' },
  },
  {
    image: headsetSale,
    title: (
      <>
        Wireless Play Starts
        <br />
        with No Compromises
      </>
    ),
    desc: "When it's time to squad up, don't compromise with the HyperX Cloud Stinger 3 wireless headset.",
    primary: { label: 'Shop Now' },
    ghost: { label: 'Learn More' },
  },
  {
    image: controlResonant,
    title: (
      <>
        PC Game Pass
        <br />
        $1 First Month
      </>
    ),
    desc: 'Over 100 high-quality PC games. Day-one releases, EA Play included. Exclusive deal for HyperX VIP members.',
    primary: { label: 'Claim Offer' },
    ghost: { label: 'Browse Library' },
  },
  {
    image: omen45max,
    title: (
      <>
        Win the
        <br />
        OMEN Max 45L
      </>
    ),
    desc: 'Enter for a chance to win a OMEN Max 45L desktop + full HyperX setup worth $4,200. One entry per day.',
    primary: { label: 'Enter to Win' },
    ghost: { label: 'Rules & Details' },
  },
  {
    image: fanaticalSale,
    title: (
      <>
        Fanatical
        <br />
        Summer Sale
      </>
    ),
    desc: 'Up to 96% off 500+ PC titles. HyperX VIP members get an extra 10% stacked discount. Ends Sunday.',
    primary: { label: 'Browse Deals' },
    ghost: { label: 'View All Partners' },
  },
];
