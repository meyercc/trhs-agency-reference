import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Pixel-height container (the Power Mode growth grammar): content grows out
 *  from under the selector instead of snapping. Reuses the pv5 grow classes. */
export function GrowArea({ children }: { children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const next = inner.offsetHeight;
    if (next !== h) setH(next);
  });
  return (
    <div className="pv5-pm-grow" style={h === null ? undefined : { height: h }}>
      <div className="pv5-pm-grow-inner" ref={innerRef}>
        {children}
      </div>
    </div>
  );
}
