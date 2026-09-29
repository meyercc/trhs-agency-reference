// Lighting presets — NGENUITY's list, in its order, as swatch + effect glyph +
// name rows. One component for every place lighting is chosen (the Lighting
// modal's Light Studio and each mode in the Modes modal), so they look and act
// the same. No three.js here: it only describes device states.
import { Icon } from '../components';
import type { PresetPatch } from './presets';
import { DESK_PRESETS, presetPatch } from './presets';
import './light-controls.css';

export { presetPatch, wornPresetId, type PresetPatch } from './presets';

export function LightPresets({
  activeId,
  onPick,
}: {
  activeId?: string;
  onPick: (patch: PresetPatch) => void;
}) {
  return (
    <div className="ls-presets-grid" role="radiogroup" aria-label="Lighting preset">
      {DESK_PRESETS.map((p) => {
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={'ls-preset' + (active ? ' active' : '')}
            onClick={() => onPick(presetPatch(p))}
          >
            <span className="ls-preset-swatch" style={{ background: p.swatch }} />
            <Icon name={p.fx} size={16} className="ls-preset-fx" />
            <span className="ls-preset-name">{p.name}</span>
            {active && <Icon name="check" size={16} className="ls-preset-check" />}
          </button>
        );
      })}
    </div>
  );
}
