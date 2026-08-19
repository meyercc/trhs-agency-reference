import { useEffect, useState } from 'react';
import { Button } from '../../components';

// ── Clean progress Dialogue (PerformV5) ──
// The third modal template = Dialogue: a small, centered, transient surface for
// a PROCESS (not a control console, not content). Shows the clean running with
// animation (spinner ring + bar), then the result. Both cleaners use it.

const STEPS = ['Scanning…', 'Cleaning…', 'Done'];

export interface CleanProgressDialogProps {
  title: string;
  result?: string;
  onClose?: () => void;
}

export function CleanProgressDialog({ title, result = 'Done', onClose }: CleanProgressDialogProps) {
  const [step, setStep] = useState(0);
  const done = step >= STEPS.length - 1;

  useEffect(() => {
    if (done) return;
    const id = window.setTimeout(() => setStep((s) => s + 1), 1400);
    return () => window.clearTimeout(id);
  }, [step, done]);

  const pct = done ? 100 : (step + 1) * 40; // 40 → 80 → 100

  return (
    <div className="pv5-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pv5-dialog-title">{title}</div>
      <div className={'pv5-dialog-ring' + (done ? ' pv5-dialog-ring-done' : '')}>
        <span className="pv5-dialog-ring-label">{done ? '✓' : `${pct}%`}</span>
      </div>
      <div className="pv5-dialog-status">{done ? result : STEPS[step]}</div>
      <div className="pv5-dialog-bar">
        <i style={{ width: pct + '%' }} />
      </div>
      <div className="pv5-dialog-foot">
        <Button variant={done ? 'accent' : 'ghost'} size="sm" onClick={onClose}>
          {done ? 'Done' : 'Cancel'}
        </Button>
      </div>
    </div>
  );
}
