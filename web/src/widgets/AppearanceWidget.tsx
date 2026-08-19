import { useSettings, type Theme } from '../state/Settings';
import { WidgetShell, ToggleButtonGroup } from '../components';
import './widgets.css';

const ACCENTS = ['cyan', 'indigo', 'purple', 'orange', 'green', 'red', 'yellow'];

/** Theme + accent quick-picker — re-themes the app live. Ported from vanilla `w-accent`. */
export function AppearanceWidget() {
  const { theme, setTheme, accent, setAccent } = useSettings();
  return (
    <WidgetShell title="Appearance">
      <div className="wg-sub" style={{ marginTop: 'var(--gutter-sm)' }}>
        Theme
      </div>
      <ToggleButtonGroup
        aria-label="Theme"
        value={theme}
        onChange={(v) => setTheme(v as Theme)}
        options={[
          { label: 'Dark', value: 'dark' },
          { label: 'Light', value: 'light' },
          { label: 'System', value: 'system' },
        ]}
      />
      <div className="wg-sub" style={{ marginTop: 'var(--gutter)' }}>
        Accent Color
      </div>
      <div className="wg-swatch-row">
        {ACCENTS.map((id) => (
          <button
            key={id}
            type="button"
            aria-label={id}
            aria-pressed={accent === id}
            className="wg-swatch"
            onClick={() => setAccent(id)}
            style={{
              background: `var(--accent-${id})`,
              borderColor: accent === id ? 'var(--text-primary)' : undefined,
              transform: accent === id ? 'scale(1.12)' : undefined,
            }}
          />
        ))}
      </div>
    </WidgetShell>
  );
}
