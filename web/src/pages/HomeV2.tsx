import { DeviceWidget, LastPlayedWidget, SystemVitalsWidget } from '../widgets';
import './home-v2.css';

// ── HomeV2 (#/home-v2) — dashboard concept for the partner comparison ──
// A fixed four-card reading of the home dashboard, put beside the visual
// concepts our partners are working on. Reached from Admin Panel → Dashboard
// Concept; Chris's #/ is untouched.
//
// What it says by what it leaves out: no carousel, so the devices are the first
// thing on the page rather than the second, and no widget gallery or drag
// handles, so the four cards are the argument instead of one arrangement out of
// many. Every card is the SAME widget the real board renders — the comparison
// is about composition, not about a mock, so a card that looks better here than
// it does on #/ would be cheating.
//
// The grid is the board's own grammar (six columns, `--widget-row` rows), which
// is what makes 2/3 and 1/3 land on the same column edges the real dashboard
// uses. Spans live in `home-v2.css` on four named cells rather than inline, so
// the whole layout can be read in one place when the concept is discussed.

/** The four cards, in reading order. */
const CARDS = [
  { key: 'headset', node: <DeviceWidget skuId="cloud-iii" /> },
  { key: 'monitor', node: <DeviceWidget skuId="treehouse-32" /> },
  { key: 'vitals', node: <SystemVitalsWidget /> },
  { key: 'lastplayed', node: <LastPlayedWidget /> },
];

export function HomeV2() {
  return (
    <div className="hv2-root">
      <div className="hv2-grid">
        {CARDS.map((c) => (
          <div className="hv2-cell" data-card={c.key} key={c.key}>
            {c.node}
          </div>
        ))}
      </div>
    </div>
  );
}
