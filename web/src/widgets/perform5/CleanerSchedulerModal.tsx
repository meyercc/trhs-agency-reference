import { useState } from 'react';
import { Button, ModalShell, Toggle, ToggleButtonGroup } from '../../components';

// ── Cleaner Scheduler modal (PerformV5) ──
// The scheduler that both cleaners share (per the OGH "Dust Removal Scheduler"
// screenshot). Control-and-Status modal, NO left navigation → single page (per
// the rule: left nav only when you actually navigate between sections). Opened
// from a cleaner card's "Schedule →". Includes an Analytics placeholder (recent
// cleanings) per the earlier decision.

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FREQ = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

export interface CleanerSchedulerModalProps {
  title: string; // "System Cleaner" / "Fan Cleaner"
  onClose?: () => void;
}

export function CleanerSchedulerModal({ title, onClose }: CleanerSchedulerModalProps) {
  const [on, setOn] = useState(true);
  const [freq, setFreq] = useState('weekly');
  const [days, setDays] = useState<string[]>(['Sun']);
  const [notify, setNotify] = useState(false);

  const toggleDay = (d: string) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  return (
    <ModalShell title={`${title} — Schedule`} onClose={onClose} className="pv5-sched">
      <div className="pv5-sched-main">
        <div>
          <div className="pv5-sched-label">Scheduled cleaning</div>
          <div className="pv5-sched-meta">Run {title.toLowerCase()} automatically.</div>
        </div>
        <Toggle checked={on} onChange={setOn} aria-label="Scheduled cleaning" />
      </div>

      {on && (
        <div className="pv5-sched-body">
          <div className="pv5-sched-row">
            <span className="pv5-sched-k">Time</span>
            <span className="pv5-sched-time">12:00 PM</span>
          </div>
          <div className="pv5-sched-row">
            <span className="pv5-sched-k">Frequency</span>
            <ToggleButtonGroup options={FREQ} value={freq} onChange={setFreq} aria-label="Frequency" />
          </div>
          {freq === 'weekly' && (
            <div className="pv5-sched-row pv5-sched-days-row">
              <span className="pv5-sched-k">Days</span>
              <div className="pv5-sched-days">
                {DAYS.map((d) => (
                  <button key={d} type="button" className={'pv5-sched-day' + (days.includes(d) ? ' active' : '')} onClick={() => toggleDay(d)}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="pv5-sched-row">
            <span className="pv5-sched-k">Show notifications</span>
            <Toggle checked={notify} onChange={setNotify} aria-label="Show notifications" />
          </label>

          <div className="pv5-sched-logs">
            <div className="pv5-sched-logs-head">Recent cleanings</div>
            <div className="pv5-sched-log-empty">Cleaning history will appear here.</div>
          </div>
        </div>
      )}

      <div className="pv5-sched-foot">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="accent" size="sm" onClick={onClose}>Save</Button>
      </div>
    </ModalShell>
  );
}
