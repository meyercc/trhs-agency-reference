import { CardDoor, Facts, FeatStatus } from './CardKit';

// ── OMEN AI card (PerformV5, 1.0) ──
// A STATUS card, not a control. It shows whether OMEN AI is currently Active;
// if it isn't, that means the automation hasn't been triggered and you resolve
// it in Settings. No on/off toggle on the card — the control lives in the
// Settings modal. Status word + door verb come from CardKit's vocabulary.

export interface OmenAiCardProps {
  on: boolean; // enablement; the control lives in the Settings modal
  gameRunning: boolean; // the trigger — per-game optimization applies at launch
  onConfigure: () => void;
  tracked?: number;
}

export function OmenAiCard({ on, gameRunning, onConfigure, tracked = 5 }: OmenAiCardProps) {
  const optimizing = on && gameRunning;
  return (
    <div className="ds-feature-card pv5-omen-card">
      <div className="ds-feature-card-header">
        <div className="ds-feature-card-title">OMEN AI</div>
        <CardDoor verb="settings" onClick={onConfigure} />
      </div>

      {/* Three states (resting-state principle): Optimizing = a tracked game
          is being optimized NOW · Idle = enabled, waiting for a launch ·
          Inactive = disabled. */}
      <FeatStatus word={optimizing ? 'optimizing' : on ? 'idle' : 'inactive'} />

      {/* Sub status = receipts (industry pattern: armed state carries a proof-
          of-work receipt, never the trigger). "Last optimized" is the receipt.
          No explanatory copy on the card (V5 rule) — tooltip candidates:
          optimizing: "Optimizing this game session."
          idle:       "Enabled — optimizes your tracked games at launch."
          inactive:   "Off — turn it on in Settings to optimize your games per title."
                      INVITE CANDIDATE: re-engage nudge (flow deferred). */}
      {/* Readings persist through Idle AND Inactive — they are history/config
          facts, and disabling the automation doesn't erase the past. Only the
          status word flips (same principle as managed: readout persists). */}
      <Facts
        items={
          optimizing
            ? [
                { label: 'Optimizing', value: 'Cyberpunk 2077' },
                { label: 'Games tracked', value: String(tracked) },
              ]
            : [
                { label: 'Games tracked', value: String(tracked) },
                { label: 'Last optimized', value: 'Cyberpunk 2077 · 2h ago' },
              ]
        }
      />
    </div>
  );
}
