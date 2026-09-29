/**
 * What is on each screen of the desk pictures — every computer's own desktop,
 * laid out the way the Treehouse 32 is dividing its panel (2026-09-23, Cindy:
 * «맥북이 있는 것도 그 배경 화면이 보여야 … Picture in Picture 했을 때 어느 배경
 * 화면이 어떻게 보이는지 … 맵 뷰에서도»). The OS display settings both do this:
 * each display in the arrangement shows its own wallpaper, so "which one is
 * which" is answered by the picture, not by a label.
 *
 * Why this is not the 08-20 drawing coming back: that one drew the split as a
 * white line and the PIP window as an outline on the render (retired 09-22 —
 * the same layout the tiles already draw, and a straight line on a photograph
 * read as pasted on). What it could not say was WHICH computer is in which pane,
 * because that was undecided then. It is decided now (`Main screen` / `Left
 * screen`, `viewingMode.left`), so the panes carry the computers themselves.
 *
 * Read by both desk pictures — the monitor window's hero and the Personalize
 * DESK card — from the same Settings, so they cannot disagree. Only the hero
 * passes `live`: it sits beside the Viewing Mode tiles, so it also shows the
 * layout a tile is being pointed at (`viewingPreview`).
 *
 * Boxes are measured off the render files (they are tight-cropped, so the file
 * IS the hardware box and percentages hold at any tile size):
 *   treehouse32-front-tight.png 979×727 → lit area x 16..962 · y 10..533
 *   macbook-front-generic.png  1268×937 → screen   x 121..1147 · y 31..692
 *   omen-oled27-front.png      1477×965 → screen   x 12..1458 · y 6..754
 * The OMEN OLED 27 is the MacBook's screen on this desk (MonitorTabs.tsx, the
 * Connectivity note; OPEN.md 09-22) — so it shows the MacBook's desktop too.
 * Until 2026-09-24 it kept its render's own blue wave, on the false claim that
 * nothing recorded what feeds it (Cindy: «배경화면 한 개는 안 맞는 것 같은데»).
 */
import type { CSSProperties } from 'react';
import { DEFAULT_VIEWING_MODE, useSettings } from '../state/Settings';
import { deskHosts, deskPcs } from './arrangement';
import { screenLayout } from './monitor/ViewingModeTiles';
import { useViewingPreview } from './monitor/viewingPreview';
import './screen-content.css';

/** Which desktop each computer shows, by its host index (0 = MacBook, 1 = OMEN 35L). */
const WALL = ['mac', 'win'] as const;

/** The inset's share of the panel per `PIP size` — the tiles' own 18×10 / 24×14 /
    30×18 insets on a 72×40 screen, so the tile and the picture draw one window. */
const PIP_SHARE: Record<string, [number, number]> = { Small: [25, 25], Medium: [33.3, 35], Large: [41.7, 45] };

type Pane = { host: 0 | 1; style: CSSProperties; inset?: boolean };

/**
 * A pane is a whole desktop, not a swatch of one (2026-09-24, Cindy on PBP: «이미지가
 * 안 맞는다, 너무 이상해»). Split in half, a bare gradient reads as a random cut of a
 * picture; the OS's own chrome is what makes each half read as that computer's
 * screen, the way the X-ray's Windows desktop carries its taskbar. Sizes are
 * shares of the pane, so an inset window keeps the same cues, smaller.
 */
function Desktop({ host }: { host: 0 | 1 }) {
  return host === 0 ? (
    <>
      <span className="scr-menubar" />
      <span className="scr-dock" />
    </>
  ) : (
    <span className="scr-taskbar" />
  );
}

export function ScreenContent({ id, live }: { id: string; live?: boolean }) {
  const { viewingMode, kvm, deskDevices } = useSettings();
  const preview = useViewingPreview();
  void deskDevices; // `deskPcs()` reads storage; this subscribes the render to it
  if (id !== 'treehouse-32' && id !== 'builtin' && id !== 'oled-27') return null;
  const pcs = deskPcs();
  if (id === 'builtin' || id === 'oled-27') {
    // The laptop's own lid, and the OMEN OLED 27 it drives: the laptop's desktop.
    if (id === 'oled-27' && !pcs.includes(0)) return null;
    return (
      <span className="scr" data-screen={id} aria-hidden="true">
        <span className="scr-pane" data-wall={WALL[0]} style={{ inset: 0 }}>
          <Desktop host={0} />
        </span>
      </span>
    );
  }
  if (!pcs.length) return null;

  const vm = viewingMode ?? DEFAULT_VIEWING_MODE;
  // Names come from the SKU (SPEC: desk-stage 12) — `viewingMode.left` stores one.
  const hosts = deskHosts();
  const idx = (name: string | undefined): 0 | 1 | undefined => {
    const i = name ? hosts.indexOf(name) : -1;
    return i === 0 || i === 1 ? i : undefined;
  };
  const two = pcs.length > 1;
  const activeHost: 0 | 1 = kvm?.activePc === 'pc2' ? 1 : 0;
  // A split needs two computers on the desk — with one, the tiles lock too.
  const layout = screenLayout(two ? (live && preview) || vm.current : 'Full Screen');
  const main: 0 | 1 = (two ? idx(vm.left) : undefined) ?? pcs[0];
  const other: 0 | 1 = main === 0 ? 1 : 0;

  const panes: Pane[] = [];
  if (layout?.units && layout.split) {
    const cut = (layout.split / layout.units) * 100;
    panes.push({ host: main, style: { left: 0, top: 0, bottom: 0, width: `${cut}%` } });
    panes.push({ host: other, style: { left: `${cut}%`, top: 0, bottom: 0, right: 0 } });
  } else if (layout?.pip) {
    const [w, h] = PIP_SHARE[vm.pipSize ?? 'Medium'] ?? PIP_SHARE.Medium;
    const [hz, vt] = layout.pip;
    panes.push({ host: main, style: { inset: 0 } });
    panes.push({
      host: other,
      inset: true,
      style: {
        width: `${w}%`,
        height: `${h}%`,
        [hz === 'l' ? 'left' : 'right']: '8.3%',
        [vt === 't' ? 'top' : 'bottom']: '15%',
      },
    });
  } else {
    // Full screen: with Gear Switch on, switching computers moves the screen too
    // (`moved` in GearSwitchSection), so the panel shows the active computer.
    const shown: 0 | 1 = two && kvm?.configured ? activeHost : pcs[0];
    panes.push({ host: shown, style: { inset: 0 } });
  }
  // Which pane the keyboard & mouse are on — only a question when the screen
  // shows both computers and Gear Switch is moving them between the two. The
  // OTHER pane dims; nothing is added. An outline was tried first and, on a PIP
  // whose main pane is the active one, ringed the whole screen like a selection
  // — and the DESK card already says this fact twice (the gear pill and the
  // accent on the computer's name; Cindy cut it from five to two on 09-13).
  const marked = panes.length > 1 && two && kvm?.configured ? activeHost : undefined;

  return (
    <span className="scr" data-screen="treehouse-32" aria-hidden="true">
      {panes.map((p) => (
        <span
          key={`${p.host}${p.inset ? 'i' : ''}`}
          className={'scr-pane' + (p.inset ? ' is-inset' : '') + (marked != null && p.host !== marked ? ' is-idle' : '')}
          data-wall={WALL[p.host]}
          style={p.style}
        >
          <Desktop host={p.host} />
        </span>
      ))}
    </span>
  );
}
