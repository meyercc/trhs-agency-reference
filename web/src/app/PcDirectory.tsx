import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components';
import type { ResolvedSku } from '../devices/skus';
import { useSettings } from '../state/Settings';
import { pcDirectory, type PcDestination, type PcLive } from '../devices/pcDirectory';

/**
 * This PC in My Devices: the This PC button, then its entries grouped by
 * where each feature lives (pcDirectory.ts). The rows reuse the panel's own
 * `.devp-feature` row, so the PC reads as one more device in the list; they
 * are the tabs of the PC's page, as a peripheral's rows are the tabs of its
 * window. The button wears the panel's action row, the one row
 * that is not a tab.
 *
 * Going to a page closes the panel, since the person is leaving for that page.
 * Opening a window keeps it, so closing the window lands back here
 * (device-panel contract, rule 6).
 */
export function PcDirectory({ pc, live, onLeave }: { pc: ResolvedSku; live: PcLive; onLeave: () => void }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { mvpScope } = useSettings();
  const groups = pcDirectory(pc, live, mvpScope);
  const firmware = typeof pc.features.firmware === 'string' ? pc.features.firmware : null;

  const go = (to: PcDestination) => {
    if (to.kind === 'page') {
      onLeave();
      navigate({ pathname: to.path, search: to.spot ? `?spot=${to.spot}` : '' });
      return;
    }
    const next = new URLSearchParams(params);
    if (to.kind === 'device') {
      next.set('sku', to.sku);
      if (to.tab) next.set('tab', to.tab);
      else next.delete('tab');
    } else {
      next.set('modal', to.modal);
      Object.entries(to.params ?? {}).forEach(([k, v]) => next.set(k, v));
    }
    setParams(next);
  };

  return (
    <div className="devp-features devp-pc">
      {/* The machine itself: its facts, firmware and the support doors. Not a
          tab of the page, so not a row in a group. */}
      <button type="button" className="devp-kvm-cta devp-action devp-pc-about" onClick={() => go({ kind: 'modal', modal: 'about-pc' })}>
        <Icon name="details" size={14} aria-hidden />
        <span>
          <b>This PC</b>
          <span className="devp-action-sub">{firmware ? `${pc.name} · Firmware ${firmware}` : pc.name}</span>
        </span>
        <Icon name="chevron-right" size={14} aria-hidden />
      </button>
      {groups.map((group) => (
        <section key={group.id} className="devp-pc-group" aria-label={group.label}>
          <div className="devp-features-label">{group.label}</div>
          {group.rows.map((row) => {
            const body = (
              <>
                <span className="devp-feature-icon">
                  <Icon name={row.icon} size={16} aria-hidden />
                </span>
                <span className="devp-feature-label">{row.label}</span>
                {row.reading && <span className="devp-feature-reading">{row.reading}</span>}
                {row.to && (
                  <span className="devp-feature-chev" aria-hidden>
                    ›
                  </span>
                )}
              </>
            );
            return row.to ? (
              <button key={row.id} type="button" className="devp-feature" onClick={() => go(row.to!)}>
                {body}
              </button>
            ) : (
              // Reports only: no door, so it does not dress as one.
              <div key={row.id} className="devp-feature devp-feature-static">
                {body}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
