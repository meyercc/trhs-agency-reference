import { CardDoor, Facts, FeatStatus } from './CardKit';

// ── Booster card (PerformV5) ──
// A STATUS card (R6). Booster is the OGH optimization pack (44 settings),
// carried into 1.0 as its own feature beside Network Booster — the same
// trajectory NB already logs: 1.0 independent feature · 2.0 folds under the
// OMEN AI umbrella (requirements DR-1.1b retires the top-level name there).
// The toggle it has is a TRIGGER toggle (arm the automation), not an
// activation toggle — it lives in the Manage modal, same nature as the AI's
// enablement. The card only shows whether the condition has fired.

export interface BoosterCardProps {
  armed: boolean; // trigger toggle, set in the Manage modal
  triggered: boolean; // the condition fired (a game session is running)
  onManage: () => void;
  /**
   * The pack as it stands, from the page's record of changes: how many items
   * are applied, for which game. Null when nothing is applied — the player
   * reverted it mid-game, or the game closed and Booster put it back. Left out,
   * the card reads the trigger alone, as it did before the record.
   */
  applied?: { game: string; items: number } | null;
  /** The receipt of the last boost once it is over: "Cyberpunk 2077 · 2 min ago". */
  lastBoost?: string | null;
}

// Three states (resting-state principle): Optimizing = the pack is applied
// for a running session · Idle = armed, `Starts` says when · Inactive = not
// armed. No explanatory copy on the card (R5) — tooltip candidates:
//   optimizing: "Optimization pack applied for this game session."
//   idle:       "Armed — applies the pack when a game launches."
//   inactive:   "Off — arm it in Manage to boost your games automatically."
//               INVITE CANDIDATE: light re-engage nudge on the inactive card
//               (flow deferred — see decision log).
export function BoosterCard({ armed, triggered, onManage, applied, lastBoost }: BoosterCardProps) {
  const optimizing = armed && triggered && applied !== null;

  return (
    <div className="ds-feature-card pv5-booster-card">
      <div className="ds-feature-card-header">
        <div className="ds-feature-card-title">Booster</div>
        <CardDoor verb="manage" onClick={onManage} />
      </div>

      <FeatStatus word={optimizing ? 'optimizing' : armed ? 'idle' : 'inactive'} />

      {/* "3 applied/selected" = OGH's default selection (3 of 77 across the
          four groups) — the modal's live counts are the source of truth. */}
      <Facts
        items={
          optimizing
            ? [
                { label: 'Optimizations', value: `${applied?.items ?? 3} applied` },
                { label: 'Session', value: `${applied?.game ?? 'Cyberpunk 2077'} · 2h` },
              ]
            : [
                { label: 'Starts', value: armed ? 'When a game launches' : '—' },
                // The receipt takes the second row once there is one to show.
                lastBoost ? { label: 'Last boost', value: lastBoost } : { label: 'Optimizations', value: '3 selected' },
              ]
        }
      />
    </div>
  );
}
