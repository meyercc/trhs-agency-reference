// ── CardKit (PerformV5) — the standardized feature-card vocabulary ──
// DRAFT CANON for the Performance feature-card family (Network Booster /
// OMEN AI / System Cleaner / Fan Cleaner / Top Processes). V5-local; does not
// touch shared components.
//
// CONTENT-AREA ANATOMY (the card below its header, in order):
//   1 · PRIMARY STATEMENT — exactly one of:
//         hero control (the card IS a control surface — Power Mode's tiles;
//         its selection state carries the status, so no status word), or
//         status word (<FeatStatus> — everything else).
//   2 · SUB ROWS — sub controls (.ut-row list items) or sub status (<Facts>
//       list rows). Everything below the primary statement is a LIST.
//   3 · ACTIONABLE ITEMS — footer, immediate actions only (Clean).
// (System Vitals is exempt: it is a dashboard/cockpit card, not a feature card.)
//
// Two controlled vocabularies, enforced by type:
//
// 1 · STATUS words — the card's headline reading (big bold word, weighted like
//     the System Vitals gauge value). One word per card, from this table only:
//       optimizing  automation is triggered and doing its job NOW (green)
//       idle        armed — waiting for its trigger; the card must
//                   say WHEN it starts (a `Starts` fact)          (grey)
//       inactive    automation is off — user's choice, not an error (grey)
//       ready       a manual action is available and safe to run (green)
//       good        health reading is fine                       (green)
//       quiet       monitoring: nothing needs attention          (green)
//       heavy       monitoring: N things need attention — pass `count` (orange)
//     RESTING-STATE PRINCIPLE (Juntao 2026-07-23): an automation's normal
//     state is Idle — working is the exception, not the ambient claim.
//     "Active" retired: it asserted ongoing work the feature wasn't doing.
//
// 2 · DOOR verbs — the header-right config/navigation door. Doors take you
//     somewhere; actions (footer) do something now. Verb by destination:
//       manage    feature configuration        (Network Booster)
//       settings  agent configuration          (OMEN AI)
//       schedule  automation timing            (Cleaners)
//       more      read-only detail             (System Vitals)
//       configure deep config, from a list row (Advanced Tuning row)
//       open      leaves the app — pass `target`, renders "Open X ↗"
//     NOTE for the vocabulary discussion: configure vs manage overlap — pin
//     the boundary (header door = manage, in-body row door = configure?).

export type StatusTone = 'positive' | 'muted' | 'attention';

export const STATUS_VOCAB = {
  optimizing: { label: 'Optimizing', tone: 'positive' },
  idle: { label: 'Idle', tone: 'muted' },
  inactive: { label: 'Inactive', tone: 'muted' },
  ready: { label: 'Ready', tone: 'positive' },
  good: { label: 'Good', tone: 'positive' },
  quiet: { label: 'Quiet', tone: 'positive' },
  heavy: { label: 'heavy', tone: 'attention' },
} as const satisfies Record<string, { label: string; tone: StatusTone }>;

export type StatusWord = keyof typeof STATUS_VOCAB;

export interface FeatStatusProps {
  word: StatusWord;
  /** monitoring counts quantify the word: word="heavy" count={3} → "3 heavy" */
  count?: number;
}

export function FeatStatus({ word, count }: FeatStatusProps) {
  const v = STATUS_VOCAB[word];
  const text = count != null ? `${count} ${v.label}` : v.label;
  return <div className={`pv5-feat-status pv5-feat-status--${v.tone}`}>{text}</div>;
}

const DOOR_LABEL = {
  manage: 'Manage',
  settings: 'Settings',
  schedule: 'Schedule',
  more: 'More',
  configure: 'Configure',
} as const;

export type DoorVerb = keyof typeof DOOR_LABEL | 'open';

export interface CardDoorProps {
  verb: DoorVerb;
  /** for verb="open": what it opens, e.g. "Task Manager" */
  target?: string;
  onClick?: () => void;
}

export function CardDoor({ verb, target, onClick }: CardDoorProps) {
  const external = verb === 'open';
  const label = external ? `Open ${target ?? ''}`.trim() : DOOR_LABEL[verb];
  return (
    <button type="button" className="pv5-card-door" onClick={onClick}>
      {label} <span aria-hidden="true">{external ? '↗' : '→'}</span>
    </button>
  );
}

// ── Sub status = Facts rows ──
// ALL card data readings render as list rows (label left · mono value right)
// for now — unified per Juntao 2026-07-23. (Metric/Level reading forms are
// candidates for later; today the list is the one sanctioned form.)
export interface Fact {
  label: string;
  value: string;
}

export function Facts({ items }: { items: Fact[] }) {
  return (
    <div className="pv5-facts">
      {items.map((f) => (
        <div className="pv5-fact" key={f.label}>
          <span className="pv5-fact-l">{f.label}</span>
          <span className="pv5-fact-v">{f.value}</span>
        </div>
      ))}
    </div>
  );
}
