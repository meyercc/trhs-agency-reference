// ── PerformV3 machine simulator — capability ladder + form determination ──
// From performance-page-ia-spec.md: every machine sits on a three-layer
// capability ladder (read telemetry / software write / hardware write), and
// the page's form is a pure function of (capability, AI write authority).
// Spec build guidance: capability→block mounting is one declarative rule
// table, form determination is one function, arbitration is one strategy
// point. All conditional rendering flows from this file — no scattered
// conditionals in the components.

export type MachineId = 'hp-old' | 'hp-nova' | 'third-party';
export type AiState = 'off' | 'v1' | 'v2' | 'thermal';
export type Form = 'form0' | 'form1' | 'form2';
export type ModeSource = 'user' | 'omen_ai' | 'smart_sense';
export type PowerMode = 'eco' | 'balanced' | 'performance' | 'unleashed';

export interface Capabilities {
  /** silicon-vendor sensor APIs — OEM-independent, every machine has this */
  telemetry: true;
  /** Windows + game-level optimization, no OEM interface needed */
  softwareWrite: boolean;
  /** HP BIOS/WMI/EC — proprietary, HP-only and SKU-conditional */
  hardwareWrite: boolean;
}

export interface MachineProfile {
  label: string;
  sub: string;
  caps: Capabilities;
  /** which AI states are real for this machine (the seven real cells of the
   *  machine × AI-state matrix; struck cells are [ENG] facts, not choices) */
  aiStates: AiState[];
}

// Declarative rule table — the single place capability facts live.
export const MACHINES: Record<MachineId, MachineProfile> = {
  'hp-old': {
    label: 'HP — old platform',
    sub: 'Full HW write · v1 engine ceiling (no 2.0 backward compat)',
    caps: { telemetry: true, softwareWrite: true, hardwareWrite: true },
    aiStates: ['off', 'v1'],
  },
  'hp-nova': {
    label: 'HP — Nova Lake+',
    sub: 'Full HW write · ships with the 2.0 engine',
    caps: { telemetry: true, softwareWrite: true, hardwareWrite: true },
    // 'thermal' is the Form 2 trigger — explicitly below-the-line per [ENG],
    // simulated here only so the Form 2 frame can be seen.
    aiStates: ['off', 'v2', 'thermal'],
  },
  'third-party': {
    label: '3rd-party (Dell / Razer …)',
    sub: 'Read + SW write only · no HP hardware interface',
    caps: { telemetry: true, softwareWrite: true, hardwareWrite: false },
    aiStates: ['off', 'v2'],
  },
};

/** Form determination — one function of (capability, AI write authority). */
export function formOf(machine: MachineId, ai: AiState): Form {
  if (ai === 'off') return 'form0';
  if (ai === 'thermal' && MACHINES[machine].caps.hardwareWrite) return 'form2';
  return 'form1';
}

/** Envelope-slot occupant. One mount point, three possible occupants —
 *  [OPEN] on 3rd-party machines: HP tiles / Windows power triad / nothing.
 *  Leaning (b) per the spec, but Windows power-plan write access is an
 *  unconfirmed [ENG] fact — so the slot renders empty until answered.
 *  Do NOT invent 3rd-party envelope content. */
export type EnvelopeOccupant = 'hp-tiles' | 'windows-triad' | 'none';
export function envelopeOccupant(machine: MachineId): EnvelopeOccupant {
  return MACHINES[machine].caps.hardwareWrite ? 'hp-tiles' : 'none';
}

/** Attribution event — recorded on EVERY mode change, in every form
 *  including Form 0. This enum field is the single load-bearing data
 *  dependency of the whole plan: Form 1's attribution UI displays this
 *  history; if it isn't recorded from MVP, Form 1 launches with nothing. */
export interface ModeChangeEvent {
  mode: PowerMode;
  source: ModeSource;
  /** present when an AI set the mode for a specific title */
  game?: string;
}

/** TODO(arbitration-semantics) — [OPEN, do not invent]
 *  When the user manually changes mode while the AI is active, the system's
 *  response is UNDEFINED: pause AI writes? this-game-session only? sticky
 *  until reboot? This is the single strategy point where that answer will
 *  live; until it's defined in writing, a manual override only re-signs the
 *  knob ("whoever last wrote the knob is signed on the knob"). */
export type ArbitrationStrategy = 'undefined' | 'pause-ai' | 'session-only' | 'sticky-until-reboot';
export const ARBITRATION: ArbitrationStrategy = 'undefined';
export function arbitrateManualOverride(event: ModeChangeEvent): ModeChangeEvent {
  return event;
}
