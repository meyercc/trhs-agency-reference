import { Badge, Toggle } from '../../components';
import { MACHINES, type AiState, type Form, type MachineId } from './machine';

// ── Block 1: OMEN AI header / status bar (Form 1+) ──
// States what the AI is currently managing on THIS machine. Scope copy varies
// by capability — never overclaim on reduced-capability machines. In Form 0
// this block does not render; the AI appears as a peer card instead.

export const OmenAiIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
    <path
      d="M24 12L12 24L0 12L12 0L24 12ZM3 12L12 21L21 12L12 3L3 12ZM16.2861 12L12 16.2861L7.71484 12L12 7.71387L16.2861 12Z"
      fill="var(--accent-color)"
    />
  </svg>
);

/** what the AI manages, per (machine capability × engine version) */
export function scopeCopy(machine: MachineId, ai: AiState, form: Form): string {
  if (form === 'form2') {
    return 'Managing power, thermals and optimization inside the envelope you set below.';
  }
  const hw = MACHINES[machine].caps.hardwareWrite;
  if (!hw) {
    // 3rd-party: software scope only — do not overclaim.
    return 'Managing game optimization and CPU scheduling on this machine.';
  }
  if (ai === 'v1') {
    // Form 1 · narrow — single shared write point (launch-time mode flip).
    return 'Optimizing supported games; switches performance mode at game launch.';
  }
  // Form 1 · full — 2.0 engine.
  return 'Managing performance mode at launch, boosters, CPU scheduling and network.';
}

const ENGINE_LABEL: Record<AiState, string> = { off: '', v1: 'v1', v2: '2.0', thermal: '3.0' };

export interface OmenAiHeaderProps {
  machine: MachineId;
  ai: AiState;
  form: Form;
  /** turning the AI off drops the page back to Form 0 */
  onToggle: (on: boolean) => void;
}

export function OmenAiHeader({ machine, ai, form, onToggle }: OmenAiHeaderProps) {
  return (
    <div className="pv3-ai-header">
      <div className="ds-feature-card-icon">
        <OmenAiIcon />
      </div>
      <div className="pv3-ai-header-main">
        <span className="pv3-ai-header-title">
          OMEN AI
          <Badge variant="status" tone="info">{ENGINE_LABEL[ai]}</Badge>
        </span>
        <span className="pv3-ai-header-scope">{scopeCopy(machine, ai, form)}</span>
      </div>
      <Toggle checked onChange={(on) => onToggle(on)} aria-label="OMEN AI" />
    </div>
  );
}
