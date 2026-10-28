import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { motion, useDragControls, useMotionValue } from 'framer-motion';
import { Hud, StatTile } from '../components';
import { isBespokeControl, LiveControl } from '../controls/LiveControl';
import { BoundItem } from '../controls/BoundItem';
import { CardBlock } from '../widgets/CardBlocks';
import { useSettings } from '../state/Settings';
import { METRIC_META, type OverlayItem, type OverlayMetric, type OverlaySpec } from '../state/overlays';
import { useVitalsStream, type VitalsSnapshot, type VitalsStream } from '../modals/vitalsData';
import './overlays.css';

const NUDGE = 8;
const NUDGE_BIG = 32;

/**
 * The overlays on screen (TH-438) — one layer over the whole window, each
 * overlay a Hud the person drags anywhere and keeps where it lands. Mounted
 * once in the shell beside the other floating chrome; renders nothing when
 * nothing is visible, so a fresh install carries no overlay markup.
 *
 * Position is a motion value during a drag and Settings afterwards — the
 * store is written on release, not per frame. The grip is also a keyboard
 * handle: arrow keys move the card by a step, Shift by a bigger one, so
 * "place anywhere" is true for everyone, not only for a pointer.
 *
 * One telemetry stream feeds every overlay, started only while one shows,
 * so three overlays agree with each other and cost one ticker.
 */
export function OverlayHost() {
  const { overlays } = useSettings();
  const visible = overlays.filter((o) => o.visible);
  const stream = useVitalsStream(visible.length > 0);
  const layer = useRef<HTMLDivElement>(null);
  if (!visible.length) return null;
  return (
    <div className="overlay-layer" ref={layer} aria-label="Overlays">
      {visible.map((o) => (
        <Overlay key={o.id} spec={o} stream={stream} layer={layer} />
      ))}
    </div>
  );
}

function metricValue(s: VitalsSnapshot, m: OverlayMetric): number {
  switch (m) {
    case 'fps':
      return s.fps;
    case 'cpu':
      return s.cpu.usage;
    case 'cpu-temp':
      return s.cpu.temp;
    case 'gpu':
      return s.gpu.usage;
    case 'gpu-temp':
      return s.gpu.temp;
    case 'ram':
      return s.ram.percent;
  }
}

/** A fifth item kind is a type error here, not a silent fall-through into the wrong arm (TH-452). */
function exhaustive(x: never): null {
  return x;
}

/** The items of one overlay — tiles, bound controls and app panels — also what a Nova reply previews (TH-439). */
export function OverlayItems({ items, stream }: { items: OverlayItem[]; stream: VitalsStream }) {
  return (
    <>
      {items.map((it, i) =>
        it.kind === 'metric' ? (
          <StatTile
            key={i}
            compact
            label={METRIC_META[it.metric].label}
            value={metricValue(stream.snapshot, it.metric)}
            unit={METRIC_META[it.metric].unit || undefined}
            tone={it.metric === 'fps' ? 'accent' : 'neutral'}
            data-metric={it.metric}
          />
        ) : it.kind === 'control' ? (
          // A legacy control id (TH-450): the bespoke ones keep their renderer;
          // the rest are registry rows (TH-452).
          isBespokeControl(it.control) ? <LiveControl key={i} kind={it.control} /> : <BoundItem key={i} item={{ kind: 'bound', bind: it.control }} />
        ) : it.kind === 'block' ? (
          // An app panel (TH-450) — full width in both homes, like a control.
          <CardBlock key={i} item={it} />
        ) : it.kind === 'bound' ? (
          // A registry-bound item (TH-452): the generic renderer resolves the
          // row and the form, from the host's one stream (history too, TH-454).
          <BoundItem key={i} item={it} stream={stream} />
        ) : (
          exhaustive(it)
        ),
      )}
    </>
  );
}

function Overlay({ spec, stream, layer }: { spec: OverlaySpec; stream: VitalsStream; layer: React.RefObject<HTMLDivElement> }) {
  const { patchOverlay } = useSettings();
  const x = useMotionValue(spec.x);
  const y = useMotionValue(spec.y);
  const [dragging, setDragging] = useState(false);
  // The drag starts from the grip, not the whole card — a slider or a chip
  // inside the body must keep its own pointer (the Metro sections do the same).
  const controls = useDragControls();
  // A store change from elsewhere (a keyboard nudge, Nova moving it) lands
  // on the motion values; a drag writes the store on release.
  useEffect(() => {
    x.set(spec.x);
    y.set(spec.y);
  }, [spec.x, spec.y, x, y]);

  const clampToWindow = (nx: number, ny: number, el: HTMLElement | null) => {
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    return { x: Math.max(0, Math.min(window.innerWidth - w, Math.round(nx))), y: Math.max(0, Math.min(window.innerHeight - h, Math.round(ny))) };
  };
  const ref = useRef<HTMLElement>(null);

  const onGripKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? NUDGE_BIG : NUDGE;
    const d = e.key === 'ArrowLeft' ? [-step, 0] : e.key === 'ArrowRight' ? [step, 0] : e.key === 'ArrowUp' ? [0, -step] : e.key === 'ArrowDown' ? [0, step] : null;
    if (!d) return;
    e.preventDefault();
    patchOverlay(spec.id, clampToWindow(spec.x + d[0], spec.y + d[1], ref.current));
  };

  return (
    <motion.div
      className="overlay-item"
      style={{ x, y }}
      drag
      dragListener={false}
      dragControls={controls}
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={layer}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false);
        patchOverlay(spec.id, clampToWindow(x.get(), y.get(), ref.current));
      }}
      data-overlay-id={spec.id}
    >
      <Hud
        ref={ref}
        title={spec.title}
        dragging={dragging}
        onClose={() => patchOverlay(spec.id, { visible: false })}
        gripProps={{ onKeyDown: onGripKey, onPointerDown: (e) => controls.start(e) }}
      >
        <OverlayItems items={spec.items} stream={stream} />
      </Hud>
    </motion.div>
  );
}

