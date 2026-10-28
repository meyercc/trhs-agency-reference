import { WidgetShell, ToggleButtonGroup } from '../components';
import { useSettings } from '../state/Settings';

/** The three modes, once — the widget and Nova's live control (TH-437) draw the same list. */
export const POWER_MODE_OPTIONS = [
  { label: 'Eco', value: 'eco' },
  { label: 'Balanced', value: 'balanced' },
  { label: 'Performance', value: 'perf' },
];

export function PowerModeWidget() {
  const { powerMode, setPowerMode } = useSettings();
  return (
    <WidgetShell title="Power Mode">
      <div style={{ marginTop: 'var(--gutter-sm)' }}>
        <ToggleButtonGroup aria-label="Power mode" value={powerMode} onChange={setPowerMode} options={POWER_MODE_OPTIONS} />
      </div>
    </WidgetShell>
  );
}
