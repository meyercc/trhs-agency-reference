import { useEffect } from 'react';
import { Backdrop, ModalShell } from '../components';
import { EQ_ART } from './eqAssets';
import './choose-eq.css';

export type EqKind = 'simple' | 'advanced';

export interface ChooseEqModalProps {
  onClose: () => void;
  onPick: (kind: EqKind) => void;
}

/**
 * The interstitial behind "Add Equalizer Preset" (Figma Audio 7364:454142):
 * two cards, Simple or Advanced, each a still of the editor it opens. Built on
 * ModalShell's narrow width so it reads as one question rather than a place
 * to stay — the answer replaces it with the editor.
 */
export function ChooseEqModal({ onClose, onPick }: ChooseEqModalProps) {
  // Capture-phase, so Escape closes this and stops there — DeviceModalHost
  // listens on document and would otherwise close the whole device canvas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  const titleFill = { backgroundImage: `url("${EQ_ART.titleGradient}")` };
  return (
    <>
      <Backdrop onClick={onClose} />
      <ModalShell title="Add Equalizer Preset" className="ceq" width="narrow" onClose={onClose}>
        <div className="ceq-cards">
          <button type="button" className="ceq-card" onClick={() => onPick('simple')}>
            <span className="ceq-card-art" style={{ backgroundImage: `url("${EQ_ART.simple}")` }} aria-hidden />
            <span className="ceq-card-info">
              <span className="ceq-card-title" style={titleFill}>Simple</span>
              <span className="ceq-card-sub">5 or 10 band graphic equalizer</span>
            </span>
          </button>
          <button type="button" className="ceq-card" onClick={() => onPick('advanced')}>
            <span className="ceq-card-art" style={{ backgroundImage: `url("${EQ_ART.advanced}")` }} aria-hidden />
            <span className="ceq-card-info">
              <span className="ceq-card-title" style={titleFill}>Advanced</span>
              <span className="ceq-card-sub">Parametric equalizer</span>
            </span>
          </button>
        </div>
      </ModalShell>
    </>
  );
}
