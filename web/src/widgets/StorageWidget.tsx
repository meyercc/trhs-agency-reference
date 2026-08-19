import { useNavigate } from 'react-router-dom';
import { WidgetShell, Button } from '../components';
import './widgets.css';

const DRIVES = [
  { name: 'C: · NVMe SSD', pct: 68, used: '347 GB used', color: 'var(--cyan)' },
  { name: 'D: · HDD', pct: 41, used: '820 GB used', color: 'var(--purple)' },
];

/** Drive usage bars + junk cleaner. Ported from vanilla `w-storage`. */
export function StorageWidget() {
  const navigate = useNavigate();
  const clean = () => navigate('/perform');
  return (
    <WidgetShell title="Storage" action={{ label: 'System Cleaner', onClick: clean }}>
      <div style={{ marginTop: 'var(--gutter-sm)' }}>
        {DRIVES.map((d) => (
          <div className="wg-drive" key={d.name}>
            <div className="wg-drive-top">
              <span className="wg-drive-name">{d.name}</span>
              <span className="wg-drive-pct">
                {d.pct}% · {d.used}
              </span>
            </div>
            <div className="wg-bar">
              <div className="wg-bar-fill" style={{ width: `${d.pct}%`, background: d.color }} />
            </div>
          </div>
        ))}
      </div>
      <div className="wg-foot" style={{ alignItems: 'center' }}>
        <span>7.04 GB junk &amp; temp files</span>
        <Button size="sm" onClick={clean}>
          Quick Clean
        </Button>
      </div>
    </WidgetShell>
  );
}
