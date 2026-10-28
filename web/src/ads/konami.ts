import { useEffect, useRef } from 'react';

/**
 * ↑ ↑ ↓ ↓ ← → ← → B A Enter — as `KeyboardEvent.key` values. "Start" is Enter.
 * Letters are compared case-insensitively, so Shift or Caps Lock cannot break it.
 */
export const KONAMI: readonly string[] = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a', 'Enter',
];

const norm = (k: string) => (k.length === 1 ? k.toLowerCase() : k);

/**
 * Calls `onEnter` when the Konami code is typed while the caller is mounted.
 *
 * It fires when the LAST eleven keys typed are the code — a ring buffer of
 * recent keys compared against the sequence on every keydown. That is what a
 * cheat code means, and it makes stray keys before it harmless by
 * construction: ↑↑↑↓↓←→←→BA⏎ completes, because its last eleven keys are the
 * code. This replaced a progress counter that reset to 1 on a mismatch; after
 * ↑↑↑ that counter sat at 1, the real code's second ↑ mismatched the expected
 * ↓ and reset it again, and the sequence was lost on precisely the input the
 * suite was written to catch (verify-ads, 2026-09-29).
 *
 * Listens on `document` in the CAPTURE phase, so a key reaches it before any
 * control that would otherwise swallow it — a focused Dropdown trigger, an
 * open list. It never stops propagation: the app keeps every key. The one
 * thing it does is prevent the default of the completing Enter, so finishing
 * the code cannot also press whichever button happens to have focus (in the
 * Admin modal that would be "Launch" onboarding). Held keys are ignored
 * (`repeat`), so a long press cannot count as two.
 *
 * Mount it only where the code should be live; unmounting removes the listener.
 */
export function useKonami(onEnter: () => void) {
  const recent = useRef<string[]>([]);
  const cb = useRef(onEnter);
  cb.current = onEnter;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const buf = recent.current;
      buf.push(norm(e.key));
      if (buf.length > KONAMI.length) buf.splice(0, buf.length - KONAMI.length);
      if (buf.length === KONAMI.length && buf.every((k, i) => k === norm(KONAMI[i]))) {
        e.preventDefault();
        buf.length = 0;
        cb.current();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);
}
