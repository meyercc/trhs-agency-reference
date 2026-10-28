import { CardDoor, Facts, FeatStatus } from './CardKit';

// ── Network Booster card (PerformV5) ──
// A STATUS card, not a control. It shows whether the automation is currently
// Active (Off/Auto/Custom is set in the Manage modal, not on the card). Its
// glance surfaces the live network throughput — the data is bound to the feature
// that shapes it, so this is where you read it (it is no longer a System Vitals
// gauge). Anatomy per CardKit: status word → sub status as Facts list rows.

export type NbMode = 'off' | 'auto' | 'custom';

export interface NetworkBoosterCardProps {
  mode: NbMode; // armed state; the control lives in the Manage modal
  gameRunning: boolean; // the trigger — prioritization works during a session
  onManage: () => void;
  /**
   * Who set the mode, when it was not the player: signed beside the mode
   * (network-booster.6). Touching the mode in Manage makes the player the last
   * writer, and the signature goes (network-booster.7).
   */
  setBy?: string | null;
}

// Three states (resting-state principle): Optimizing = a session is being
// prioritized NOW · Idle = armed, the `Starts` fact says when · Inactive =
// off by choice. No explanatory copy on the card (V5 rule) — tooltip
// candidates:
//   optimizing: "Prioritizing game traffic; capping background apps."
//   idle:       "Armed — starts prioritizing when a game launches."
//   inactive:   "Off — turn it on in Manage to prioritize game traffic."
//               INVITE CANDIDATE: the inactive card could carry a light
//               re-engage nudge (flow deferred — see decision log).
export function NetworkBoosterCard({ mode, gameRunning, onManage, setBy }: NetworkBoosterCardProps) {
  const armed = mode !== 'off';
  const optimizing = armed && gameRunning;

  return (
    <div className="ds-feature-card pv5-nb-card">
      <div className="ds-feature-card-header">
        <div className="ds-feature-card-title">Network Booster</div>
        <CardDoor verb="manage" onClick={onManage} />
      </div>

      <FeatStatus word={optimizing ? 'optimizing' : armed ? 'idle' : 'inactive'} />

      <Facts
        items={
          optimizing
            ? [
                { label: 'Download', value: '229.3 Mbps' },
                { label: 'Upload', value: '13.0 Mbps' },
              ]
            : [
                { label: 'Starts', value: armed ? 'When a game launches' : '—' },
                {
                  label: 'Mode',
                  value: (armed ? (mode === 'auto' ? 'Auto' : 'Custom') : 'Off') + (setBy ? ` · Set by ${setBy}` : ''),
                },
              ]
        }
      />
    </div>
  );
}
