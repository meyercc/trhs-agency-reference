import { useEffect, useRef, useState } from 'react';
import {
  Backdrop, ModalShell, ToggleButtonGroup, VerticalSlider,
} from '../components';
import { useSettings, type CustomEqPreset, type SimpleEqPreset } from '../state/Settings';
import {
  EQ_DB_MAX,
  EQ_DB_MIN,
  EQ_DB_TICKS,
  type BandCount,
  bandGroups,
  bandsFor,
  curveFromGains,
  formatHz,
  resampleGains,
} from './eqData';
import { EqPresetRail, type EqPresetRailHandle } from './EqPresetRail';
import './eq-editor.css';
import './simple-eq.css';

/**
 * Simple Equalizer — the preset creation flow behind "Add Equalizer Preset" on
 * the headset Audio panel (Figma Audio 7557:272603).
 *
 * Built on ModalShell rather than reproducing the Figma chrome: the design's
 * left rail, title row and footer band are exactly ModalShell's `left`,
 * `title` and `footer` slots, so the modal inherits the app's modal behavior
 * instead of forking it. The stray Search field in the frame is a leftover
 * instance, not part of the design, and is not built.
 *
 * Edits live in draft state and are committed to Settings on close — a preset
 * is software, so there is no flash to write and no Save button to press. The
 * band count is a property OF a preset, not a mode of the editor, so switching
 * it resamples that preset's curve rather than resetting it.
 *
 * Advanced EQ is a later job; this modal is deliberately only the simple one.
 */
export interface SimpleEqModalProps {
  onClose: () => void;
  /** Opened via "Add Equalizer Preset" — start on a fresh preset. */
  startNew?: boolean;
}

const flat = (n: number) => Array(n).fill(0) as number[];
const makeId = () => `eq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
/** A gain's position down the rail, 0% = +12 dB at the top. Rails and axis are
 *  both 100% of the stage (simple-eq.css), so a percentage is true for both. */
const dbTop = (db: number) => ((EQ_DB_MAX - db) / (EQ_DB_MAX - EQ_DB_MIN)) * 100;

export function SimpleEqModal({ onClose, startNew = true }: SimpleEqModalProps) {
  const { eqPresets, setEqPresets } = useSettings();
  // This editor owns the simple presets; the parametric ones ride along untouched.
  const simple = eqPresets.filter((p): p is SimpleEqPreset => p.kind === 'simple');

  // Unique display name. `base` lets a duplicate keep its parent's name and
  // take the next free number rather than colliding with it.
  const nextName = (list: SimpleEqPreset[], base?: string) => {
    const taken = new Set(list.map((p) => p.label));
    if (base) {
      if (!taken.has(base)) return base;
      let n = 2;
      while (taken.has(`${base} ${n}`)) n += 1;
      return `${base} ${n}`;
    }
    let n = list.length + 1;
    while (taken.has(`Simple EQ ${n}`)) n += 1;
    return `Simple EQ ${n}`;
  };
  const make = (list: SimpleEqPreset[]): SimpleEqPreset => ({
    kind: 'simple',
    id: makeId(),
    label: nextName(list),
    bands: 5,
    gains: flat(5),
  });

  // Draft copy — the modal edits freely and commits once, so an abandoned
  // fiddle never half-writes the stored list.
  const [drafts, setDrafts] = useState<SimpleEqPreset[]>(() =>
    startNew ? [...simple, make(simple)] : [...simple],
  );
  const [selectedId, setSelectedId] = useState<string>(
    () => (startNew ? undefined : simple[0]?.id) ?? simple.slice(-1)[0]?.id ?? '',
  );
  // The freshly-made preset is the one to land on.
  useEffect(() => {
    if (!selectedId && drafts.length) setSelectedId(drafts[drafts.length - 1].id);
  }, [selectedId, drafts]);

  const selected = drafts.find((p) => p.id === selectedId) ?? drafts[drafts.length - 1];
  const bands = bandsFor((selected?.bands ?? 5) as BandCount);

  const patch = (id: string, next: Partial<SimpleEqPreset>) =>
    setDrafts((list) => list.map((p) => (p.id === id ? { ...p, ...next } : p)));

  const setGain = (i: number, v: number) => {
    if (!selected) return;
    const gains = [...selected.gains];
    gains[i] = v;
    patch(selected.id, { gains });
  };

  const setBandCount = (count: BandCount) => {
    if (!selected) return;
    patch(selected.id, { bands: count, gains: resampleGains(selected.gains, count) });
  };

  const addPreset = () => {
    const made = make(drafts);
    setDrafts((list) => [...list, made]);
    setSelectedId(made.id);
  };

  // Commit on the way out, whatever closed it. Empty untouched presets are not
  // worth keeping — an accidental "Add" should not litter the list.
  const commitAndClose = () => {
    const kept = drafts.filter((p) => p.label.trim() !== '' && p.gains.some((g) => g !== 0));
    setEqPresets([...eqPresets.filter((p) => p.kind !== 'simple'), ...kept]);
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
      // Innermost thing first: a row menu, then the modal. Without this the
      // whole editor closes while a menu is open, losing the work behind it.
      if (railRef.current?.closeMenu()) return;
      closeRef.current();
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  // ── Row actions (the rail draws them; the drafts change here) ────────────
  const rename = (id: string, label: string) => patch(id, { label });
  const duplicate = (p: CustomEqPreset) => {
    const src = p as SimpleEqPreset;
    const copy: SimpleEqPreset = { ...src, id: makeId(), label: nextName(drafts, `${src.label} copy`) };
    setDrafts((list) => [...list, copy]);
    setSelectedId(copy.id);
  };
  const reset = (p: CustomEqPreset) => patch(p.id, { gains: flat((p as SimpleEqPreset).gains.length) });
  const remove = (p: CustomEqPreset) => {
    setDrafts((list) => {
      const next = list.filter((x) => x.id !== p.id);
      if (p.id === selectedId) setSelectedId(next[next.length - 1]?.id ?? '');
      return next;
    });
  };

  const left = (
    <EqPresetRail
      ref={railRef}
      presets={drafts}
      selectedId={selected?.id ?? ''}
      onSelect={setSelectedId}
      onAdd={addPreset}
      onRename={rename}
      onDuplicate={duplicate}
      onReset={reset}
      onDelete={remove}
      curve={(p) => curveFromGains((p as SimpleEqPreset).gains)}
    />
  );

  return (
    <>
      <Backdrop onClick={commitAndClose} />
      <ModalShell
        title="Simple Equalizer"
        className="seq"
        onClose={commitAndClose}
        left={left}
      >
        <div
          className={'seq-editor' + (bands.length === 10 ? ' is-10' : '')}
          style={{ ['--seq-bands' as string]: bands.length }}
        >
          {/* Named frequency ranges. At 10 bands each range spans two columns —
              the names describe ranges, so they survive the subdivision. */}
          <div className="seq-groups" aria-hidden="true">
            {bandGroups(bands).map((g) => (
              <span key={g.group} className="seq-group" style={{ gridColumn: `span ${g.span}` }}>
                {g.group}
              </span>
            ))}
          </div>

          <div className="seq-stage">
            <div className="seq-axis" aria-hidden="true">
              {EQ_DB_TICKS.map((t) => (
                <span key={t} className="seq-tick" style={{ top: `${dbTop(t)}%` }}>
                  {t > 0 ? `+${t}` : t} dB
                </span>
              ))}
            </div>
            <div className="seq-bands">
              {bands.map((b, i) => (
                <div className="seq-band" key={b.hz}>
                  <VerticalSlider
                    center
                    min={EQ_DB_MIN}
                    max={EQ_DB_MAX}
                    step={1}
                    value={selected?.gains[i] ?? 0}
                    onChange={(v) => setGain(i, v)}
                    formatValue={(v) => `${v > 0 ? '+' : ''}${v} dB`}
                    aria-label={`${formatHz(b.hz)} — ${b.group}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="seq-hz" aria-hidden="true">
            {bands.map((b) => (
              <span key={b.hz} className="seq-hz-label">{formatHz(b.hz)}</span>
            ))}
          </div>

          {/* Band count belongs to the editor, not the modal: it changes what
              the stage above shows, so it sits with it rather than in a
              full-width footer that would also run under the preset rail. */}
          <div className="seq-band-count">
            <span className="seq-band-count-label">Simple Equalizer Bands</span>
            <ToggleButtonGroup
              aria-label="Simple equalizer bands"
              value={String(selected?.bands ?? 5)}
              onChange={(v) => setBandCount(Number(v) as BandCount)}
              options={[
                { label: '5', value: '5' },
                { label: '10', value: '10' },
              ]}
            />
          </div>
        </div>
      </ModalShell>
    </>
  );
}
