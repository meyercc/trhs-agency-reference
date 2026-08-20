import { useState } from 'react';
import { Button, ModalShell, Toggle, ToggleButtonGroup } from '../../components';

// ── Cleaner Scheduler modal (PerformV7) ──
// V7 fork of the V5 modal. Two changes, nothing else:
//   1. width="narrow" — single subject, so the shell stops spanning the window
//      and centres on both axes.
//   2. The "Scheduled cleaning" master toggle moves OUT of the first body row
//      and INTO the header's right-hand end. It is the one control that governs
//      the whole modal — everything below it only exists while it is on — so it
//      belongs in the surface-scope position rather than as the first item of
//      content. That also removes the odd read where a row could switch off the
//      rows beneath it.
// Everything else is the V5 content unchanged.

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

  const headerControl = <Toggle checked={on} onChange={setOn} aria-label="Scheduled cleaning" />;

  return (
    <ModalShell
      title={`${title} — Schedule`}
      onClose={onClose}
      className="pv5-sched"
      width="narrow"
      headerControl={headerControl}
      footer={
        <div className="pv5-sched-foot">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="accent" size="sm" onClick={onClose}>Save</Button>
        </div>
      }
    >
      {on ? (
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
      ) : (
        <div className="pv7-sched-off">Scheduled cleaning is off. {title} runs only when you start it.</div>
      )}
    </ModalShell>
  );
}
