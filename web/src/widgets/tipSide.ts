import { useState } from 'react';
import type { TooltipPlacement } from '../components';

/**
 * Which side a library `Tooltip` should open on, picked when the pointer or
 * focus arrives. The library Tooltip has four fixed sides and draws its popup
 * inside its wrapper, so a card or a scroll box that clips its overflow cuts a
 * tip that opens toward its edge (Cindy 10-02 «툴팁 잘리잖아»: the Home card ⋮
 * lost 23px, the monitor window's OLED Care ⓘ 63px). This only chooses among
 * those four — the first that fits inside every clipping box, else the one
 * that loses least. A tip that escapes clipping altogether needs a
 * portal-based Tooltip — asked of Chris (chris-next-outbound.md 10-02); when
 * the library has it, this file goes.
 */

const GAP = 10; // the library popup's offset from its trigger, arrow included

const OPPOSITE: Record<TooltipPlacement, TooltipPlacement> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/** The visible box a popup inside `el` is cut to: the window, narrowed by every
    ancestor that clips its overflow. */
function clipBox(el: HTMLElement) {
  let box = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
    const o = getComputedStyle(a);
    if (!/(hidden|clip|auto|scroll)/.test(o.overflowX + o.overflowY)) continue;
    const r = a.getBoundingClientRect();
    box = { left: Math.max(box.left, r.left), top: Math.max(box.top, r.top), right: Math.min(box.right, r.right), bottom: Math.min(box.bottom, r.bottom) };
  }
  return box;
}

export function roomiestSide(trigger: HTMLElement, pop: HTMLElement, first: TooltipPlacement): TooltipPlacement {
  const order = [first, OPPOSITE[first], ...(['right', 'left', 'top', 'bottom'] as TooltipPlacement[]).filter((s) => s !== first && s !== OPPOSITE[first])];
  const t = trigger.getBoundingClientRect();
  const { width: w, height: h } = pop.getBoundingClientRect();
  const box = clipBox(trigger);
  const cx = t.left + t.width / 2;
  const cy = t.top + t.height / 2;
  const lost = (s: TooltipPlacement) => {
    const r =
      s === 'bottom' ? { l: cx - w / 2, t: t.bottom + GAP }
      : s === 'top' ? { l: cx - w / 2, t: t.top - GAP - h }
      : s === 'right' ? { l: t.right + GAP, t: cy - h / 2 }
      : { l: t.left - GAP - w, t: cy - h / 2 };
    return Math.max(0, box.left - r.l) + Math.max(0, r.l + w - box.right) + Math.max(0, box.top - r.t) + Math.max(0, r.t + h - box.bottom);
  };
  return order.find((s) => lost(s) === 0) ?? order.reduce((a, b) => (lost(b) < lost(a) ? b : a));
}

/** `[side, pick]` — spread `pick` onto the trigger as `onPointerEnter` and
    `onFocus`; pass `side` as the Tooltip's `placement`. */
export function useTipSide(first: TooltipPlacement) {
  const [side, setSide] = useState<TooltipPlacement>(first);
  const pick = (e: React.SyntheticEvent<HTMLElement>) => {
    const trigger = e.currentTarget;
    const pop = trigger.closest('.ds-tooltip-wrap')?.querySelector<HTMLElement>('.ds-tooltip-popup');
    if (pop) setSide(roomiestSide(trigger, pop, first));
  };
  return [side, pick] as const;
}

/** `[side, ref]` — put `ref` on the trigger INSIDE the Tooltip; the side is
    picked once, as the trigger lands in the layout. For the tips no pointer
    ever reaches: ones held `open` (the ⋮ first-run hint) and ones whose
    trigger is `disabled`, which in Chrome fires no pointer event at all. The
    popup keeps its box while hidden (`visibility: hidden`, components.css), so
    it can be measured before it is ever shown. */
export function useTipSideOnShow(first: TooltipPlacement) {
  const [side, setSide] = useState<TooltipPlacement>(first);
  const ref = (trigger: HTMLElement | null) => {
    const pop = trigger?.closest('.ds-tooltip-wrap')?.querySelector<HTMLElement>('.ds-tooltip-popup');
    if (trigger && pop) setSide(roomiestSide(trigger, pop, first));
  };
  return [side, ref] as const;
}

/** `[side, ref]` — put `ref` on an element that CONTAINS the Tooltip, for when
    the trigger is a component that takes no ref of its own (the hero's
    `Callout`). Same arrival timing as `useTipSideOnShow`: the trigger is the
    wrap's first child, the popup its last (`components/Tooltip.tsx`). */
export function useTipSideAround(first: TooltipPlacement) {
  const [side, setSide] = useState<TooltipPlacement>(first);
  const ref = (host: HTMLElement | null) => {
    const wrap = host?.querySelector<HTMLElement>('.ds-tooltip-wrap');
    const trigger = wrap?.firstElementChild as HTMLElement | null;
    const pop = wrap?.querySelector<HTMLElement>('.ds-tooltip-popup');
    if (trigger && pop && trigger !== pop) setSide(roomiestSide(trigger, pop, first));
  };
  return [side, ref] as const;
}
