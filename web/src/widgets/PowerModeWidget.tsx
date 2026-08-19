import { WidgetShell, ToggleButtonGroup } from '../components';
import { useSettings } from '../state/Settings';

export function PowerModeWidget() {
  const { powerMode, setPowerMode } = useSettings();
  return (
    <WidgetShell title="Power Mode">
      <div style={{ marginTop: 'var(--gutter-sm)' }}>
        <ToggleButtonGroup
          aria-label="Power mode"
          value={powerMode}
          onChange={setPowerMode}
          options={[
            { label: 'Eco', value: 'eco' },
            { label: 'Balanced', value: 'balanced' },
            { label: 'Performance', value: 'perf' },
          ]}
        />
      </div>
    </WidgetShell>
  );
}
