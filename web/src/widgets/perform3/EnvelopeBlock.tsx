import { Badge, Button } from '../../components';
import '../feature-cards.css';
import '../power-thermal.css';
import '../performance-card.css';
import {
  envelopeOccupant,
  type Form,
  type MachineId,
  type ModeChangeEvent,
  type PowerMode,
} from './machine';

// ── Block 2: envelope (mode tiles) ──
// Mounts only where hardware-write capability exists; absent capability means
// the block simply does not exist (no greyed-out placeholder — spec rule).
// When mounted, tiles are ALWAYS visible — never collapsed, never behind a
// click. The AI's "on top" is expressed as attribution on the shared write
// point (the mode enum), not as a cover over the control.

const MODES: { id: PowerMode; label: string; watts: string; variant: string }[] = [
  { id: 'eco', label: 'Eco', watts: '35W', variant: 'batt-mode' },
  { id: 'balanced', label: 'Balanced', watts: '65W', variant: '' },
  { id: 'performance', label: 'Performance', watts: '95W', variant: 'perf-mode' },
  { id: 'unleashed', label: 'Unleashed', watts: '115W', variant: 'unleash-mode' },
];

export interface EnvelopeBlockProps {
  machine: MachineId;
  form: Form;
  current: ModeChangeEvent;
  /** user tile click — recorded with source 'user' upstream */
  onSelect: (mode: PowerMode) => void;
}

export function EnvelopeBlock({ machine, form, current, onSelect }: EnvelopeBlockProps) {
  const occupant = envelopeOccupant(machine);
  // [OPEN] 3rd-party slot: one mount point, occupant TBD (HP tiles / Windows
  // triad / none). Until the Windows power-plan question is answered the slot
  // renders nothing — absent means absent, no placeholder.
  if (occupant === 'none') return null;

  const aiSet = current.source !== 'user';

  return (
    <div className="ds-feature-card pv3-envelope">
      <div className="pv3-block-head">
        <span className="ds-feature-card-title">
          {form === 'form2' ? 'Power Envelope' : 'Power Mode'}
        </span>
        {form === 'form2' && (
          <span className="pv3-block-note">The budget ceiling you hand the AI — it manages inside it.</span>
        )}
      </div>

      <div className="power-modes pm-row">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={[
              'power-mode-btn',
              current.mode === m.id ? 'active' : '',
              current.mode === m.id ? m.variant : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(m.id)}
          >
            <span className="power-mode-dot" />
            <span className="power-mode-label">{m.label}</span>
            <span className="power-mode-watts">{m.watts}</span>
          </button>
        ))}
      </div>

      {/* Attribution — shared write points only; whoever last wrote the knob
          is signed on the knob. Rendered from Form 1 up; the data is recorded
          in every form. */}
      {form !== 'form0' && (
        <div className="pv3-attribution">
          {aiSet ? (
            <>
              <Badge variant="status" tone="info">Set by OMEN AI</Badge>
              {current.game && <span className="pv3-attribution-meta">for {current.game}</span>}
            </>
          ) : (
            <Badge variant="status">Set manually</Badge>
          )}
        </div>
      )}

      {/* Form 2 frame only: manual control becomes an explicit escape hatch.
          Internals deliberately not built. */}
      {form === 'form2' && (
        <div className="pv3-escape">
          <Button size="sm">Take manual control</Button>
          <span className="pv3-block-note">Escape hatch — suspends AI envelope writes. [frame only]</span>
        </div>
      )}

      {/* Entry into the Unleashed detail view hangs off this block.
          [OPEN] the detail view itself is being redesigned — the previous
          exploration (inline collapse sections) lives at #/perform-v2. */}
      {current.mode === 'unleashed' && (
        <div className="pv3-unleash-entry">
          <Button size="sm" disabled>
            Advanced Tuning
          </Button>
          <span className="pv3-block-note">Unleashed detail view — redesign pending</span>
        </div>
      )}
    </div>
  );
}
