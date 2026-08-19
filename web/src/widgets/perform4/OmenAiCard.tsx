import { Badge, Toggle } from '../../components';
import { OmenAiIcon, scopeCopy } from '../perform3/OmenAiHeader';
import { formOf, type AiState, type MachineId } from '../perform3/machine';

// ── OMEN AI as a standard feature card (Form 0 peer) ──
// Same card anatomy as every other control card (Optimization etc.):
// .ds-feature-card → header (icon + control) → title → sub → meta.
// In Form 1+ this card morphs into the slim management strip
// (perform3/OmenAiHeader) docked above what it manages — same element,
// different density.

const ENGINE_LABEL: Record<AiState, string> = { off: '', v1: 'v1', v2: '2.0', thermal: '3.0' };

export interface OmenAiCardProps {
  machine: MachineId;
  ai: AiState;
  onToggle: (on: boolean) => void;
}

export function OmenAiCard({ machine, ai, onToggle }: OmenAiCardProps) {
  const on = ai !== 'off';
  return (
    <div className="ds-feature-card pv4-ai-card">
      <div className="ds-feature-card-header">
        <div className="ds-feature-card-icon">
          <OmenAiIcon />
        </div>
        <Toggle checked={on} onChange={onToggle} aria-label="OMEN AI" />
      </div>
      <div className="ds-feature-card-title">
        OMEN AI
        {on && (
          <Badge variant="status" tone="info">
            {ENGINE_LABEL[ai]}
          </Badge>
        )}
      </div>
      <div className="ds-feature-card-sub">
        {on
          ? scopeCopy(machine, ai, formOf(machine, ai))
          : 'Turn on to let OMEN AI manage optimization on this machine.'}
      </div>
    </div>
  );
}
