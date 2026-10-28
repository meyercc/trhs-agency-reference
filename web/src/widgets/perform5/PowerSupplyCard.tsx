import {
  PSU_FAN_MODE_LABEL,
  fanRpm,
  psuStatusWord,
  usePsuCleaning,
  usePsuLab,
  usePsuReadings,
  usePsuSettings,
  type PsuStatusWord,
} from '../../devices/pcParts';
import { CardDoor } from './CardKit';

// ── Power supply card (PerformV7, Performance) ──
// The desktop's OMEN power supply, on the page. The supply has a fan control,
// which System Vitals' tab does not (System Vitals only watches), so it is a
// card of its own, in the family of Booster / Network Booster / Fan Cleaner:
// title + door, the big status word, then rows (designer, 2026-10-22).
//
// It SHOWS and does not set. The fan mode and speed are edited in the power
// supply's window alone; this card and its Fan row are doors to that window
// (lcd-diy.25: every door to a part opens its one window — shown in two places,
// edited in one). The numbers are the window's: the same readings, the same
// settings, the same fanRpm(). JY, 2026-10-22.

export interface PowerSupplyCardProps {
  /** Its rated power, W — fanRpm() works in load against it. */
  capacityW: number;
  /** The title row's door: the PC's page at the Power supply tab (Status). */
  onSettings: () => void;
  /** The Fan row: the same tab, on its Fan view. */
  onFan: () => void;
}

const TONE: Record<PsuStatusWord, 'positive' | 'muted' | 'attention'> = {
  Good: 'positive',
  'Running hot': 'attention',
  'High current': 'attention',
  'No readings': 'muted',
};

export function PowerSupplyCard({ capacityW, onSettings, onFan }: PowerSupplyCardProps) {
  // Subscribed so the card moves with the supply every 2 s; the word itself
  // is the one the PC's entry and the window say (psuStatusWord).
  const r = usePsuReadings();
  const [s] = usePsuSettings();
  const lab = usePsuLab();
  const cleaning = usePsuCleaning();
  const word = psuStatusWord();
  // A supply with no link has nothing to read; the fan then runs by itself
  // (lcd-diy.38). A clean drives the fan while it runs, and every view says so
  // (lcd-diy.18).
  const speed = !lab.usb ? null : cleaning ? 'Cleaning' : `${fanRpm(s, r, capacityW).toLocaleString()} RPM`;
  const fan = speed ? `${PSU_FAN_MODE_LABEL[s.fanMode]} · ${speed}` : PSU_FAN_MODE_LABEL[s.fanMode];

  return (
    <div className="ds-feature-card pv5-psu-card">
      <div className="ds-feature-card-header">
        <div className="ds-feature-card-title">Power supply</div>
        <CardDoor verb="settings" onClick={onSettings} />
      </div>
      <div className={`pv5-feat-status pv5-feat-status--${TONE[word]}`}>{word}</div>
      <div className="pv5-facts">
        <div className="pv5-fact">
          <span className="pv5-fact-l">Total power</span>
          <span className="pv5-fact-v">{lab.usb ? `${r.watts} W` : '—'}</span>
        </div>
        {/* The Fan row is a door, not a control. */}
        <button type="button" className="pv5-fact pv5-fact--door" onClick={onFan} title="Open the fan settings">
          <span className="pv5-fact-l">Fan</span>
          <span className="pv5-fact-v">
            {fan} <span aria-hidden="true">→</span>
          </span>
        </button>
      </div>
    </div>
  );
}
