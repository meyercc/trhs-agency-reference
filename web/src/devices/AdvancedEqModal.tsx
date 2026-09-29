import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Backdrop,
  Icon,
  IconButton,
  ModalShell,
  Separator,
  Stepper,
  ToggleButtonGroup,
  Tooltip,
} from '../components';
import { useSettings, type CustomEqPreset, type ParametricEqPreset } from '../state/Settings';
import { EQ_DB_MAX, EQ_DB_MIN, EQ_DB_TICKS, formatHz } from './eqData';
import {
  EQ_GAIN_STEP,
  EQ_HZ_MAX,
  EQ_HZ_MIN,
  EQ_Q_MAX,
  EQ_Q_MIN,
  EQ_Q_STEP,
  FILTER_TYPES,
  OCTAVE_UNIT,
  PARAMETRIC_GROUPS,
  PARAMETRIC_HZ_TICKS,
  clampDb,
  clampHz,
  clampQ,
  curveFromParams,
  dbToUnit,
  defaultBand,
  defaultBands,
  filterLabel,
  formatDb,
  formatHzValue,
  formatQ,
  halfOctavesToQ,
  hzStep,
  hzToUnit,
  isFlat,
  parseHz,
  qToHalfOctaves,
  responsePaths,
  unitToDb,
  unitToHz,
  type EqBandParam,
  type EqFilterType,
} from './eqParametric';
import { EqPresetRail, type EqPresetRailHandle } from './EqPresetRail';
import './eq-editor.css';
import './advanced-eq.css';

/**
 * Advanced Equalizer — the parametric preset editor behind "Add Equalizer
 * Preset → Advanced" (Figma Audio 7364:426542 initial, 7364:426556 modified).
 *
 * Built on ModalShell like the Simple Equalizer, sharing its rail
 * (EqPresetRail) and its axis furniture (eq-editor.css), so the two editors
 * are one family. What is new is the graph: ten fixed bands, each a point you
 * drag (frequency across, gain up and down) with a filter type, frequency,
 * gain and Q in the bar underneath. The curve is the real biquad cascade
 * (eqParametric.ts), so the picture is the response, not a sketch of one.
 *
 * Edits live in draft state and are committed to Settings on close — the same
 * rule as the Simple editor: a preset is software, there is nothing to flash.
 * A preset that was never bent is dropped on the way out.
 */
export interface AdvancedEqModalProps {
  onClose: () => void;
  /** Opened via "Add Equalizer Preset" — start on a fresh preset. */
  startNew?: boolean;
}

const makeId = () => `eq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** A gain's position down the axis, 0% = +12 dB at the top — the same rule the Simple editor uses. */
const dbTop = (db: number) => ((EQ_DB_MAX - db) / (EQ_DB_MAX - EQ_DB_MIN)) * 100;

/** Log width of a named range, for its pill's share of the row. */
const octaves = (from: number, to: number) => Math.log2(to / from);

export function AdvancedEqModal({ onClose, startNew = true }: AdvancedEqModalProps) {
  const { eqPresets, setEqPresets } = useSettings();
  // This editor owns the parametric presets; the simple ones ride along untouched.
  const parametric = eqPresets.filter((p): p is ParametricEqPreset => p.kind === 'parametric');

  const nextName = (list: ParametricEqPreset[], base?: string) => {
    const taken = new Set(list.map((p) => p.label));
    if (base) {
      if (!taken.has(base)) return base;
      let n = 2;
      while (taken.has(`${base} ${n}`)) n += 1;
      return `${base} ${n}`;
    }
    let n = list.length + 1;
    while (taken.has(`Advanced EQ ${n}`)) n += 1;
    return `Advanced EQ ${n}`;
  };
  const make = (list: ParametricEqPreset[]): ParametricEqPreset => ({
    kind: 'parametric',
    id: makeId(),
    label: nextName(list),
    params: defaultBands(),
  });

  const [drafts, setDrafts] = useState<ParametricEqPreset[]>(() =>
    startNew ? [...parametric, make(parametric)] : [...parametric],
  );
  const [selectedId, setSelectedId] = useState<string>(
    () => (startNew ? undefined : parametric[0]?.id) ?? parametric.slice(-1)[0]?.id ?? '',
  );
  useEffect(() => {
    if (!selectedId && drafts.length) setSelectedId(drafts[drafts.length - 1].id);
  }, [selectedId, drafts]);
  const selected = drafts.find((p) => p.id === selectedId) ?? drafts[drafts.length - 1];

  // Which band the parameter bar is about. Null until a point is picked, so
  // the bar starts quiet rather than claiming band 1 before anyone touched it.
  const [band, setBand] = useState<number | null>(null);
  const current = band != null ? selected?.params[band] : undefined;

  const patch = (id: string, next: Partial<ParametricEqPreset>) =>
    setDrafts((list) => list.map((p) => (p.id === id ? { ...p, ...next } : p)));
  const updateBand = useCallback(
    (i: number, next: Partial<EqBandParam>) => {
      if (!selected) return;
      setDrafts((list) =>
        list.map((p) =>
          p.id === selected.id ? { ...p, params: p.params.map((b, k) => (k === i ? { ...b, ...next } : b)) } : p,
        ),
      );
    },
    [selected],
  );

  const addPreset = () => {
    const made = make(drafts);
    setDrafts((list) => [...list, made]);
    setSelectedId(made.id);
    setBand(null);
  };
  const rename = (id: string, label: string) => patch(id, { label });
  const duplicate = (p: CustomEqPreset) => {
    const src = p as ParametricEqPreset;
    const copy: ParametricEqPreset = {
      ...src,
      id: makeId(),
      label: nextName(drafts, `${src.label} copy`),
      params: src.params.map((b) => ({ ...b })),
    };
    setDrafts((list) => [...list, copy]);
    setSelectedId(copy.id);
  };
  const reset = (p: CustomEqPreset) => patch(p.id, { params: defaultBands() });
  const remove = (p: CustomEqPreset) => {
    setDrafts((list) => {
      const next = list.filter((x) => x.id !== p.id);
      if (p.id === selectedId) setSelectedId(next[next.length - 1]?.id ?? '');
      return next;
    });
  };

  // Commit on the way out, whatever closed it. A preset nobody bent is not
  // worth keeping — an accidental "Add" should not litter the list.
  const commitAndClose = () => {
    const kept = drafts.filter((p) => p.label.trim() !== '' && !isFlat(p.params));
    setEqPresets([...eqPresets.filter((p) => p.kind !== 'parametric'), ...kept]);
    onClose();
  };
  const closeRef = useRef(commitAndClose);
  closeRef.current = commitAndClose;
  const railRef = useRef<EqPresetRailHandle>(null);

  // Capture-phase, so Escape closes THIS modal and stops there — DeviceModalHost
  // listens on document and would otherwise close the whole device canvas too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      // Innermost thing first: a row menu, then the modal.
      if (railRef.current?.closeMenu()) return;
      closeRef.current();
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  const left = (
    <EqPresetRail
      ref={railRef}
      presets={drafts}
      selectedId={selected?.id ?? ''}
      onSelect={(id) => {
        setSelectedId(id);
        setBand(null);
      }}
      onAdd={addPreset}
      onRename={rename}
      onDuplicate={duplicate}
      onReset={reset}
      onDelete={remove}
      curve={(p) => curveFromParams((p as ParametricEqPreset).params)}
    />
  );

  return (
    <>
      <Backdrop onClick={commitAndClose} />
      <ModalShell title="Advanced Equalizer" className="aeq" onClose={commitAndClose} left={left}>
        {/* The selected band's color is the editor's color: the curve, its fill
            and the parameter bar's outline all read `--band`, so one variable on
            the column keeps them in agreement. Nothing is colored until a point
            is picked. */}
        <div
          className={'aeq-editor' + (band != null ? ' has-band' : '')}
          style={band != null ? ({ ['--band' as string]: `var(--eq-band-${band + 1})` } as React.CSSProperties) : undefined}
        >
          {/* Named ranges, each as wide as its share of the log scale. */}
          <div className="aeq-refs" aria-hidden="true">
            {PARAMETRIC_GROUPS.map((g) => (
              <span key={g.group} className="seq-group" style={{ flex: octaves(g.from, g.to) }}>
                {g.group}
              </span>
            ))}
          </div>

          <div className="aeq-stage">
            <div className="seq-axis" aria-hidden="true">
              {EQ_DB_TICKS.map((t) => (
                <span key={t} className="seq-tick" style={{ top: `${dbTop(t)}%` }}>
                  {t > 0 ? `+${t}` : t} dB
                </span>
              ))}
            </div>
            {selected && (
              <EqGraph
                bands={selected.params}
                selected={band}
                onSelect={setBand}
                onChange={updateBand}
                presetName={selected.label}
              />
            )}
          </div>

          <div className="aeq-hz" aria-hidden="true">
            {PARAMETRIC_HZ_TICKS.map((hz) => (
              <span key={hz} className="seq-hz-label" style={{ left: `${hzToUnit(hz) * 100}%` }}>
                {formatHz(hz)}
              </span>
            ))}
          </div>

          {/* The selected band's parameters. Quiet until a point is picked. */}
          <div className={'aeq-params' + (current ? ' has-band' : '')} role="group" aria-label="Selected band">
            <div className="aeq-param">
              <span className="aeq-param-label filter">{current ? filterLabel(current.type) : 'Select a band'}</span>
              <ToggleButtonGroup
                iconOnly
                aria-label="Filter type"
                value={current?.type ?? ''}
                onChange={(v) => band != null && updateBand(band, { type: v as EqFilterType })}
                options={FILTER_TYPES.map((f) => ({ label: f.label, value: f.type, icon: f.icon }))}
              />
            </div>
            <Separator orientation="vertical" />
            <div className="aeq-param">
              <span className="aeq-param-label">Freq</span>
              <Stepper
                aria-label="Frequency"
                value={current?.hz ?? 1000}
                min={EQ_HZ_MIN}
                max={EQ_HZ_MAX}
                step={hzStep}
                precision={1}
                format={formatHzValue}
                parse={parseHz}
                disabled={!current}
                onChange={(v) => band != null && updateBand(band, { hz: clampHz(v) })}
              />
            </div>
            <Separator orientation="vertical" />
            <div className="aeq-param">
              <span className="aeq-param-label">Gain</span>
              <Stepper
                aria-label="Gain"
                value={current?.gain ?? 0}
                min={EQ_DB_MIN}
                max={EQ_DB_MAX}
                step={EQ_GAIN_STEP}
                precision={1}
                format={formatDb}
                disabled={!current}
                onChange={(v) => band != null && updateBand(band, { gain: clampDb(v) })}
              />
            </div>
            <Separator orientation="vertical" />
            <div className="aeq-param">
              <span className="aeq-param-label">Q</span>
              <Stepper
                aria-label="Q"
                value={current?.q ?? 0.5}
                min={EQ_Q_MIN}
                max={EQ_Q_MAX}
                step={EQ_Q_STEP}
                precision={2}
                format={formatQ}
                disabled={!current}
                onChange={(v) => band != null && updateBand(band, { q: clampQ(v) })}
              />
            </div>
            <div className="aeq-param-actions">
              <Tooltip content={current?.on === false ? 'Enable band' : 'Bypass band'}>
                <IconButton
                  label={current?.on === false ? 'Enable band' : 'Bypass band'}
                  aria-pressed={current ? !current.on : undefined}
                  disabled={!current}
                  onClick={() => band != null && current && updateBand(band, { on: !current.on })}
                >
                  <Icon name="trash" size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip content="Reset band">
                <IconButton
                  label="Reset band"
                  variant="accent"
                  disabled={!current}
                  onClick={() => band != null && updateBand(band, defaultBand(band))}
                >
                  <Icon name="reset" size={16} />
                </IconButton>
              </Tooltip>
            </div>
          </div>
        </div>
      </ModalShell>
    </>
  );
}

// ── The graph ────────────────────────────────────────────────────────────────

interface EqGraphProps {
  bands: EqBandParam[];
  selected: number | null;
  onSelect: (i: number) => void;
  onChange: (i: number, next: Partial<EqBandParam>) => void;
  presetName: string;
}

/** Minor grid lines: 2..9 in each decade, where there is no labelled tick. */
const MINOR_HZ = [30, 40, 60, 70, 80, 90, 300, 400, 600, 700, 800, 900, 3000, 4000, 6000, 7000, 8000, 9000];
const POINT_R = 6.5;
/* The Q anchors: a small dot at each edge of the selected band, on a hairline
   from the point (Figma Audio "Curve Point" 7364:401339), with a wider unseen
   hit disc so it can be grabbed. */
const ANCHOR_R = 3;
const ANCHOR_HIT_R = 8;

function EqGraph({ bands, selected, onSelect, onChange, presetName }: EqGraphProps) {
  // Measured, not viewBox-scaled: a non-uniform viewBox would stretch the
  // strokes and turn the points into ellipses.
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w, h } = size;
  const paths = w && h ? responsePaths(bands, w, h) : null;

  // Drag: the pointer's position IS the band's frequency and gain — or, from
  // an anchor, its distance from the point IS the band's width (Q).
  const drag = useRef<{ i: number; mode: 'move' | 'q' } | null>(null);
  const toParams = (e: React.PointerEvent) => {
    const r = host.current!.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width;
    const v = (e.clientY - r.top) / r.height;
    return { hz: Math.round(unitToHz(u) * 10) / 10, gain: Math.round(unitToDb(v) * 2) / 2 };
  };
  const onPointerDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    onSelect(i);
    drag.current = { i, mode: 'move' };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onAnchorDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { i, mode: 'q' };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  // An anchor's distance from the point, in octaves, is half the band's width.
  const toQ = (i: number, e: React.PointerEvent) => {
    const r = host.current!.getBoundingClientRect();
    const half = Math.abs((e.clientX - r.left) / r.width - hzToUnit(bands[i].hz)) / OCTAVE_UNIT;
    return Math.round(halfOctavesToQ(half) / EQ_Q_STEP) * EQ_Q_STEP;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const { i, mode } = drag.current;
    if (mode === 'q') onChange(i, { q: clampQ(toQ(i, e)) });
    else onChange(i, toParams(e));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    drag.current = null;
  };
  // The wheel over a point narrows or widens it — Q is the one parameter a
  // drag cannot reach.
  const onWheel = (i: number) => (e: React.WheelEvent) => {
    e.preventDefault();
    onChange(i, { q: clampQ(bands[i].q + (e.deltaY < 0 ? EQ_Q_STEP : -EQ_Q_STEP)) });
  };
  // Keyboard: the point is a slider for gain; left/right walk the frequency,
  // Shift + up/down the Q, Delete bypasses. Same reach as the pointer.
  const onKeyDown = (i: number) => (e: React.KeyboardEvent) => {
    const b = bands[i];
    const step = hzStep(b.hz);
    const map: Record<string, Partial<EqBandParam> | undefined> = {
      ArrowUp: e.shiftKey ? { q: clampQ(b.q + EQ_Q_STEP) } : { gain: clampDb(b.gain + EQ_GAIN_STEP) },
      ArrowDown: e.shiftKey ? { q: clampQ(b.q - EQ_Q_STEP) } : { gain: clampDb(b.gain - EQ_GAIN_STEP) },
      ArrowRight: { hz: clampHz(b.hz + step) },
      ArrowLeft: { hz: clampHz(b.hz - step) },
      Home: { gain: 0 },
      Delete: { on: !b.on },
      Backspace: { on: !b.on },
    };
    const next = map[e.key];
    if (!next) return;
    e.preventDefault();
    onSelect(i);
    onChange(i, next);
  };

  return (
    <div ref={host} className="aeq-plot" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      {w > 0 && h > 0 && (
        <svg width={w} height={h} role="img" aria-label={`${presetName} response curve`}>
          {/* Grid */}
          {EQ_DB_TICKS.map((t) => (
            <line
              key={t}
              className={'aeq-grid-db' + (t === 0 ? ' zero' : '')}
              x1={0}
              x2={w}
              y1={dbToUnit(t) * h}
              y2={dbToUnit(t) * h}
            />
          ))}
          {MINOR_HZ.map((hz) => (
            <line key={hz} className="aeq-grid-hz minor" x1={hzToUnit(hz) * w} x2={hzToUnit(hz) * w} y1={0} y2={h} />
          ))}
          {PARAMETRIC_HZ_TICKS.map((hz) => (
            <line key={hz} className="aeq-grid-hz" x1={hzToUnit(hz) * w} x2={hzToUnit(hz) * w} y1={0} y2={h} />
          ))}
          {/* Response */}
          {paths && <path className="aeq-fill" d={paths.fill} />}
          {paths && <path className="aeq-line" d={paths.line} />}
          {/* Points */}
          {bands.map((b, i) => {
            const cx = hzToUnit(b.hz) * w;
            const cy = dbToUnit(b.gain) * h;
            const classes = ['aeq-point', i === selected ? 'selected' : '', b.on ? '' : 'off'].filter(Boolean).join(' ');
            return (
              <g
                key={i}
                className={classes}
                style={{ ['--band' as string]: `var(--eq-band-${i + 1})` } as React.CSSProperties}
                transform={`translate(${cx} ${cy})`}
                tabIndex={0}
                role="slider"
                aria-label={`Band ${i + 1}, ${filterLabel(b.type)} at ${formatHzValue(b.hz)}${b.on ? '' : ', bypassed'}`}
                aria-valuemin={EQ_DB_MIN}
                aria-valuemax={EQ_DB_MAX}
                aria-valuenow={b.gain}
                aria-valuetext={`${formatDb(b.gain)} at ${formatHzValue(b.hz)}, Q ${formatQ(b.q)}`}
                data-band={i + 1}
                onPointerDown={onPointerDown(i)}
                onWheel={onWheel(i)}
                onKeyDown={onKeyDown(i)}
                onFocus={() => onSelect(i)}
              >
                <circle className="aeq-point-ring" r={POINT_R + 4} />
                <circle className="aeq-point-disc" r={POINT_R} />
                <circle className="aeq-point-color" r={POINT_R - 2} />
              </g>
            );
          })}
          {/* The selected band's width: a hairline to a dot at each edge, at
              f0·2^±half. Pointer-only — the point itself already gives Q to
              the wheel and Shift+arrows, so the dots stay out of the tab order
              rather than adding two more stops per band. */}
          {selected != null && bands[selected] && (() => {
            const b = bands[selected];
            const cx = hzToUnit(b.hz) * w;
            const cy = dbToUnit(b.gain) * h;
            const dx = qToHalfOctaves(b.q) * OCTAVE_UNIT * w;
            const edges = [Math.max(0, cx - dx), Math.min(w, cx + dx)];
            return (
              <g className="aeq-q" aria-hidden="true">
                <line className="aeq-q-line" x1={edges[0]} x2={cx - POINT_R} y1={cy} y2={cy} />
                <line className="aeq-q-line" x1={cx + POINT_R} x2={edges[1]} y1={cy} y2={cy} />
                {edges.map((x, k) => (
                  <g key={k} className="aeq-q-anchor" transform={`translate(${x} ${cy})`} onPointerDown={onAnchorDown(selected)}>
                    <circle className="aeq-q-hit" r={ANCHOR_HIT_R} />
                    <circle className="aeq-q-dot" r={ANCHOR_R} />
                  </g>
                ))}
              </g>
            );
          })()}
        </svg>
      )}
    </div>
  );
}
