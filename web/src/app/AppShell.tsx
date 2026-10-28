import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, Icon, IconButton, Tooltip, type MenuItem } from '../components';
import { DeviceModalHost } from '../devices/DeviceModalHost';
import { DeviceSimHud } from '../devices/DeviceSimHud';
import { SimulatorRig } from './SimulatorRig';
import { FeatureModalHost } from '../modals/FeatureModalHost';
import { PowerModeBridge } from '../state/powerMode';
import { useSettings } from '../state/Settings';
import { useModules } from '../state/Modules';
import { useDeviceSim } from '../state/DeviceSim';
import { useNova } from '../state/Nova';
import { useProfiles } from '../state/Profiles';
import { DEVICES_ITEM, useVisibleNavTabs } from './navItems';
import { AccountMenu } from './AccountMenu';
import { ProfileSwitcher } from './ProfileSwitcher';
import { DevicePanel } from './DevicePanel';
import { GamePanel } from './GamePanel';
import { NovaPanel } from './NovaPanel';
import { NovaFab } from './NovaFab';
import { WallpaperLayer } from './WallpaperLayer';
import { PersonalizeProvider } from '../pages/personalize/state';
import { AdHost } from '../ads/AdHost';
import { OverlayHost } from '../overlays/OverlayHost';
import { NovaContextBridge } from '../nova/grounding';
import { applyLayout, type LayoutContext } from '../widgets/layout';
import { cardMetas } from '../widgets/cardMeta';
import { deskDeviceIds } from '../devices/connectedDevices';
import { getResolvedSku } from '../devices/skus';
import { DEFAULT_LAYOUT, META_BY_ID } from '../widgets/catalog';
import { onCloseDevicePanel } from './devicePanelRequest';
import { useSectionParam } from './useSectionParam';
import { useTrackerRegion } from './useTrackerRegion';
import { recipeWatchers, useRecipeDemoResets } from '../agents/recipes';
import { useLaunchGame } from '../state/launchGame';
import { useAgents } from '../state/Agents';
import { sessionSecondsOf, useAutocast } from '../state/Autocast';
import { useGallery } from '../state/Gallery';
import { usePlaytime } from '../state/Playtime';
import { AUTOCAST_AGENT, AUTOCAST_VERSION } from '../nova/autocast';
import { toUserClips } from '../nova/autocastMedia';
import { AUTOCAST_GAME } from '../data/autocast';
import { SPEED } from '../nova/scripts';
import { ToastHost } from './ToastHost';
import { NavOverflow } from './NavOverflow';
import { BP, PageSizeContext, mediaQuery, useContainerSize, useMediaQuery, warnIfBreakpointsUnexpanded } from './breakpoints';
import './shell.css';

/** Routes that own the whole viewport below the nav — their body is the
    scroller, not the window (shell.css `.page-full`). */
const FULL_BLEED_PATHS = new Set(['/nova']);

/** Routes where the pinned Nova panel stands down — the page is the chat. */
const NOVA_PATHS = new Set(['/nova']);

/** Routes whose content grows by whole widgets on a wide page (shell.css
    `.page-wide`, 2026-10-21): the board gains two columns per step while the
    carousel keeps its 1100px box, left-aligned. Route-scoped like `page-full`,
    so no other page changes, and unlike Play's `100vw` trick it keeps the
    devices-open reservation. */
const WIDE_PATHS = new Set(['/']);


// The Nova panel's width bounds (px). MIN is the narrowest the chat column was
// drawn for (nova-panel.css); DEFAULT is what a fresh install gets and the most
// the page ever reserves (shell.css `--nova-panel-default-w`); PAGE_PEEK is
// how much of the page must stay in view beside the widest sidebar — the page
// no longer has to survive the squeeze, only to be seen; EDGE is the shell's
// gutters either side; SNAP_PAST is how far beyond the widest sidebar a drag
// must go to mean "full screen".
const NOVA_W_KEY = 'novaPanelW';
const NOVA_DEFAULT_W = 380;
const NOVA_MIN_W = 320;
const NOVA_PAGE_PEEK = 320;
const NOVA_EDGE = 72;
const NOVA_SNAP_PAST = 48;
/**
 * The Nova WINDOW's own remembered width (TH-507) — the floating chat the FAB
 * opens. Same handle, bounds and snap as the rail; a separate value, so
 * switching Admin → Nova entry never hands one surface the other's size.
 * DEFAULT is nova-panel.css's drawn window width.
 */
const NOVA_WINDOW_W_KEY = 'novaWindowW';
const NOVA_WINDOW_DEFAULT_W = 400;
/**
 * …and its height, from its top edge (Chris, October 27): the bottom stays on
 * the button, so it grows upward. MIN keeps the header, a reply and the
 * composer in view; DEFAULT is the drawn 640; CHROME is what the window never
 * covers — the top bar (64), a gutter under it (24) and the button's clearance
 * (shell.css `--nova-fab-clear`, 96 at desktop). The CSS clamps to the window
 * as well, so a gutter step on a tablet costs a few px, never the top bar.
 */
const NOVA_WINDOW_H_KEY = 'novaWindowH';
const NOVA_WINDOW_DEFAULT_H = 640;
const NOVA_WINDOW_MIN_H = 360;
const NOVA_WINDOW_CHROME_H = 184;
const readNovaW = (key: string, fallback: number, min = NOVA_MIN_W) => {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v >= min ? v : fallback;
  } catch {
    return fallback;
  }
};
/** The Devices panel's width — shell.css `--devices-panel-w`. */
const DEVICES_W = 340;
/** The game detail panel's width — shell.css `--game-panel-w` (TH-504). */
const GAME_W = 340;
/**
 * The right rail holds ONE panel: the Devices flyout or a game's detail
 * panel (TH-504). One variable, so the two cannot both be open — 340px of
 * rail beside another is not a layout either was designed for (see the
 * Devices nav item).
 */
type Rail = 'devices' | 'game' | null;
/** The shell's gutters around a page beside a rail: two outside, two inside (`--gutter` × 4). */
const PAGE_CHROME = 96;
/** The bottom nav's slots on a compact window: this many fit a 360px phone with labels on. */
const NAV_SLOTS = 5;
export function AppShell() {
  const { hideNavLabels, hideNavIcons, adPlacement, adUnlocked, novaPinned, setNovaPinned, novaEntry, upsertOverlay, removeOverlay, cards, addCard, deskDevices, boardLayout, setBoardLayout, showSimulator } = useSettings();
  const { has } = useModules();
  // AppShell sits below DeviceSimProvider (main.tsx), so the simulator's
  // plugged-in truth is reachable here — it is not from inside NovaProvider.
  const { simState } = useDeviceSim();
  const nova = useNova();
  const { registerActions } = nova;
  // Autocast's session moves (TH-509): read through a ref at the press, so
  // the registration does not rebuild on every tick of its clock.
  const agents = useAgents();
  const autocast = useAutocast();
  const gallery = useGallery();
  const playtime = usePlaytime();
  const acRef = useRef({ nova, agents, autocast, gallery, playtime });
  acRef.current = { nova, agents, autocast, gallery, playtime };
  const launchGame = useLaunchGame();
  const { selectProfile, gameLaunched } = useProfiles();
  const navigate = useNavigate();
  // Deep-linkable open state: `?devices=1` opens it on load (used by the App
  // Atlas preview + shareable links). After mount it's plain local state, so it
  // persists across page navigation (page NavLinks drop the query string).
  const [searchParams, setSearchParams] = useSearchParams();
  const pathname = useLocation().pathname;
  const pageFull = FULL_BLEED_PATHS.has(pathname);
  const pageWide = WIDE_PATHS.has(pathname);
  useSectionParam();
  useTrackerRegion();
  // `?demo=<id>` — a Nova recipe's demo start position (`?demo=catch-up`,
  // `?demo=refund`; agents/recipes.tsx), then the param goes so a reload
  // mid-demo does not reset the stage under the presenter.
  const demoResets = useRecipeDemoResets();
  const demo = searchParams.get('demo');
  useEffect(() => {
    const reset = demo ? demoResets[demo] : undefined;
    if (!reset) return;
    reset();
    const p = new URLSearchParams(searchParams);
    p.delete('demo');
    setSearchParams(p, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);
  const gameParam = searchParams.get('game');
  const [rail, setRail] = useState<Rail>(() => (gameParam ? 'game' : searchParams.get('devices') === '1' ? 'devices' : null));
  const devicesOpen = rail === 'devices';
  const gameOpen = rail === 'game';
  // The Devices flyout's old switch, over the rail: opening it also takes the
  // game panel's param away, so a reload does not bring the game back.
  const setDevicesOpen = (v: boolean | ((open: boolean) => boolean)) => {
    const open = typeof v === 'function' ? v(rail === 'devices') : v;
    if (open && searchParams.has('game')) {
      const p = new URLSearchParams(searchParams);
      p.delete('game');
      setSearchParams(p, { replace: true });
    }
    setRail(open ? 'devices' : rail === 'devices' ? null : rail);
  };
  // `?game=<id>` opens the game panel (gamePanelRequest.ts sets it); clearing
  // the param closes it. Opening unpins Nova, as the Devices nav item does.
  useEffect(() => {
    if (gameParam) {
      setRail('game');
      setNovaPinned(false);
    } else setRail((r) => (r === 'game' ? null : r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameParam]);
  const closeGame = () => {
    const p = new URLSearchParams(searchParams);
    p.delete('game');
    setSearchParams(p, { replace: true });
  };
  // One rail: a panel row that pins Nova ("Catch me up") hands it the rail,
  // so the reply is read beside the page and not under the panel.
  useEffect(() => {
    if (novaPinned && rail === 'game') closeGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novaPinned]);
  // Nova pinned to the right rail (TH-434). The PREFERENCE lives in Settings so
  // it survives a reload; whether the panel is actually on screen is narrower
  // than the preference in two ways:
  //   · the module can be uninstalled under a pinned preference — Nova is
  //     opt-in (`defaultInstalled: false`), and a pin must not resurrect a
  //     surface the Module Browser removed;
  //   · on /nova the page wins. Drawing the same log twice, side by side,
  //     reads as a bug rather than as two views of one conversation, so the
  //     panel stands down and slides back when you leave.
  const hasNova = has('nova');
  const onNovaRoute = NOVA_PATHS.has(pathname);
  const novaOpen = novaPinned && hasNova && !onNovaRoute;
  // Admin → Nova entry (TH-507): behind a floating button, Nova opens as a
  // window over the page instead of the right rail. Same `novaPinned`, so
  // every door that opens Nova opens the window; it reserves no room, so the
  // page never reflows under it.
  const fabMode = novaEntry === 'fab' && hasNova;
  const novaRail = novaOpen && !fabMode;
  const novaWindow = novaOpen && fabMode;

  // ── The panel's width (Chris, 2026-10-20) ─────────────────────────────
  // Resizable from its left edge, remembered, and bounded by the WINDOW: it
  // stops where only PAGE_PEEK of page would remain beside it. Pulled past
  // that by SNAP_PAST and released, the sidebar becomes the full page — and
  // the width it had before the drag comes back with the next sidebar.
  // The width rides on the shell as --nova-panel-w; the page reserves at most
  // the DEFAULT of it (shell.css), and anything wider floats over the page.
  const [railW, setRailW] = useState(() => readNovaW(NOVA_W_KEY, NOVA_DEFAULT_W));
  const [windowW, setWindowW] = useState(() => readNovaW(NOVA_WINDOW_W_KEY, NOVA_WINDOW_DEFAULT_W));
  // Whichever surface Nova is drawn as owns the width being dragged.
  const [windowH, setWindowH] = useState(() => readNovaW(NOVA_WINDOW_H_KEY, NOVA_WINDOW_DEFAULT_H, NOVA_WINDOW_MIN_H));
  const novaW = fabMode ? windowW : railW;
  const setNovaW = fabMode ? setWindowW : setRailW;
  const [viewportW, setViewportW] = useState(() => window.innerWidth);
  const [viewportH, setViewportH] = useState(() => window.innerHeight);
  useEffect(() => {
    const on = () => {
      setViewportW(window.innerWidth);
      setViewportH(window.innerHeight);
    };
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const novaMaxW = Math.max(NOVA_MIN_W, viewportW - NOVA_PAGE_PEEK - NOVA_EDGE);
  const [novaResizing, setNovaResizing] = useState(false);
  const [novaSnap, setNovaSnap] = useState(false);
  const dragFrom = useRef(novaW);
  const shownNovaW = Math.max(NOVA_MIN_W, Math.min(novaMaxW, novaW));
  // The window's height, bounded by the window (TH-507). Past the tallest, a
  // released drag means "full screen", as past the widest does.
  const windowMaxH = Math.max(NOVA_WINDOW_MIN_H, viewportH - NOVA_WINDOW_CHROME_H);
  const shownWindowH = Math.max(NOVA_WINDOW_MIN_H, Math.min(windowMaxH, windowH));
  const dragFromH = useRef(windowH);
  const resizeWindowH = (asked: number) => {
    setNovaSnap(asked > windowMaxH + NOVA_SNAP_PAST);
    setWindowH(Math.max(NOVA_WINDOW_MIN_H, Math.min(windowMaxH, asked)));
  };
  const releaseWindowH = (asked: number) => {
    const full = asked > windowMaxH + NOVA_SNAP_PAST;
    setNovaSnap(false);
    const keep = full ? dragFromH.current : Math.max(NOVA_WINDOW_MIN_H, Math.min(windowMaxH, asked));
    setWindowH(keep);
    try {
      localStorage.setItem(NOVA_WINDOW_H_KEY, String(keep));
    } catch {
      /* storage unavailable */
    }
    if (full) navigate('/nova');
  };
  // ── Where the rails stand (2026-10-20) ───────────────────────────────────
  // A rail reserves room beside the page only while the page keeps at least
  // its `medium` layout; narrower than that it floats over the page instead
  // (shell.css `.rail-overlay`). Decided here because it takes the window AND
  // the reservation, which a media query cannot read together. Nova reserves
  // its default width at most, so the test uses that, not the dragged width.
  const reserveW = novaRail ? Math.min(shownNovaW, NOVA_DEFAULT_W) : devicesOpen ? DEVICES_W : gameOpen ? GAME_W : 0;
  const railOverlay = reserveW > 0 && viewportW - reserveW - PAGE_CHROME < BP.medium;
  // The panel floats over the page when nothing is reserved for it, or when
  // it is wider than what is; it takes a shadow to say so (nova-panel.css).
  const novaFloating = railOverlay || shownNovaW > NOVA_DEFAULT_W;
  // Compact windows: the nav goes to the bottom edge, as a tab bar.
  const compact = useMediaQuery(mediaQuery('compact'));
  const [moreOpen, setMoreOpen] = useState(false);
  // The PAGE's size — the box the page CSS queries as `@container page`; the
  // board reads its width to pack as many columns as the CSS draws.
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageSize = useContainerSize(scrollRef);
  useEffect(warnIfBreakpointsUnexpanded, []);
  const resizeNova = (asked: number) => {
    setNovaSnap(asked > novaMaxW + NOVA_SNAP_PAST);
    setNovaW(Math.max(NOVA_MIN_W, Math.min(novaMaxW, asked)));
  };
  const releaseNova = (asked: number) => {
    const full = asked > novaMaxW + NOVA_SNAP_PAST;
    setNovaSnap(false);
    const keep = full ? dragFrom.current : Math.max(NOVA_MIN_W, Math.min(novaMaxW, asked));
    setNovaW(keep);
    try {
      localStorage.setItem(fabMode ? NOVA_WINDOW_W_KEY : NOVA_W_KEY, String(keep));
    } catch {
      /* storage unavailable */
    }
    if (full) navigate('/nova');
  };
  // Where "Back to sidebar" returns from the full page: the last page that was not Nova.
  // In sessionStorage, not only memory: a reload on /nova must not forget it.
  const lastPage = useRef<string>((() => {
    try {
      return sessionStorage.getItem('novaLastPage') || '/';
    } catch {
      return '/';
    }
  })());
  const { search: locSearch } = useLocation();
  useEffect(() => {
    if (onNovaRoute) return;
    lastPage.current = pathname + locSearch;
    try {
      sessionStorage.setItem('novaLastPage', lastPage.current);
    } catch {
      /* storage unavailable */
    }
  }, [pathname, locSearch, onNovaRoute]);
  // The Agent Catalog lives in the panel's header; the nav keeps it wherever
  // there is no panel that could host it — Nova uninstalled, or the one route
  // where the panel stands down. On /nova this also spares the util slot a
  // dead click: "Ask Nova" there would toggle a preference and change nothing
  // on screen, which is the same bug the Devices toggle carries a comment
  // about (Cindy, 2026-08-03).
  // Behind the FAB the top bar has no Nova button to offer: the slot goes back
  // to the catalog, the same fallback as above.
  const novaToggleInNav = hasNova && !onNovaRoute && !fabMode;
  // Device the panel should select when Devices closes a device modal (below).
  // `n` changes on every request, so asking for the device already focused still re-selects it.
  const [panelFocus, setPanelFocusState] = useState<{ sku?: string; n: number }>({ n: 0 });
  const setPanelFocus = (sku?: string) => setPanelFocusState((f) => ({ sku, n: f.n + 1 }));

  // A device window that sends the person to a page (the PC's Performance tab)
  // asks for the panel behind it to go, as the directory's own page rows do.
  useEffect(() => onCloseDevicePanel(() => setDevicesOpen(false)), []);

  const openModules = () => {
    const p = new URLSearchParams(searchParams);
    p.set('modal', 'modules');
    setSearchParams(p);
  };
  const openAgents = () => {
    const p = new URLSearchParams(searchParams);
    p.set('modal', 'agents');
    setSearchParams(p);
  };

  // Esc closes whichever rail panel is open — the Devices flyout or a game's.
  useEffect(() => {
    if (!rail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (rail === 'game') closeGame();
      else setDevicesOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rail, searchParams]);

  // Esc unpins Nova. Escape inside the panel is already stopped by the pieces
  // that own it — the composer with a draft (gotcha 5) and the conversations
  // popover — so this only ever sees an Escape nothing else wanted.
  useEffect(() => {
    if (!novaOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNovaPinned(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [novaOpen, setNovaPinned]);

  // The window's focus (TH-507). Opened from its button, focus goes to the
  // composer — you pressed "Ask Nova", so you are about to type. Closed with
  // focus inside (Esc, Minimize), it returns to the button, rather than to
  // <body> when the window's contents unmount. Opened any other way (Catch me
  // up), focus stays where the person is.
  const fabRef = useRef<HTMLButtonElement>(null);
  const focusComposerOnOpen = useRef(false);
  useEffect(() => {
    if (!fabMode) return;
    if (novaWindow) {
      if (!focusComposerOnOpen.current) return;
      focusComposerOnOpen.current = false;
      // The window mounts its contents a render after it opens (NovaPanel's
      // lingering), so the composer may be a frame or two away.
      let raf = 0;
      let tries = 0;
      const tryFocus = () => {
        const t = document.querySelector<HTMLElement>('#nova-panel textarea');
        if (t) t.focus({ preventScroll: true });
        else if (++tries < 10) raf = requestAnimationFrame(tryFocus);
      };
      raf = requestAnimationFrame(tryFocus);
      return () => cancelAnimationFrame(raf);
    }
    if (document.getElementById('nova-panel')?.contains(document.activeElement)) fabRef.current?.focus();
  }, [novaWindow, fabMode]);
  const toggleNovaWindow = () => {
    if (!novaPinned) {
      // Asking for Nova puts the rails away, as the top-bar button does.
      setDevicesOpen(false);
      if (gameOpen) closeGame();
      focusComposerOnOpen.current = true;
    }
    setNovaPinned(!novaPinned);
  };

  // Nova's scripted replies act on the app — navigate, open a modal, switch
  // the profile — and need the router to do it. The Nova PAGE used to lend
  // those actions while it was mounted, which left a reply sent from the
  // pinned panel on any other page unable to act (TH-434). The shell is
  // mounted for every route, so the registration lives here now and the page
  // no longer makes one.
  // What is renderable right now (widgets/layout.ts). Built at press time rather
  // than memoized, so a chip pressed after a module was removed sees that.
  const layoutCtx = (): LayoutContext => ({
    cards: cardMetas(cards),
    gate: {
      has,
      desk: deskDevices,
      connected: (sku: string) => simState(sku).connected,
      // The roster's types, resolved the way `LiveControl.usePrimary` resolves them (TH-450).
      deviceTypes: deskDeviceIds(deskDevices).map((id) => getResolvedSku(id)?.type ?? ''),
    },
  });

  useEffect(() => {
    registerActions({
      navigate,
      openModal: (id, extra) => {
        const p = new URLSearchParams(searchParams);
        p.set('modal', id);
        for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
        setSearchParams(p);
      },
      selectProfile,
      // Placing is an upsert with `visible` forced on, so the chip also brings
      // back one the person hid with its ✕.
      placeOverlay: (spec) => upsertOverlay({ ...spec, visible: true }),
      removeOverlay,
      // A card Nova built (TH-443). One Settings call, not two: the spec and the
      // board entry have to land together or the new id is normalized away —
      // see `addCard` in `state/Settings.tsx`.
      // It appends, so on a full board it lands rows down; bring it into view
      // (2026-10-20), so a demo can keep the person's own board.
      addCard: (spec) => {
        addCard(spec);
        let tries = 0;
        const find = () => {
          const el = document.querySelector(`.wb-cell[data-widget="${CSS.escape(spec.id)}"]`);
          if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
          else if (++tries < 20) requestAnimationFrame(find);
        };
        requestAnimationFrame(find);
      },
      // Off the board only, which is what the cell's own ✕ does — the spec
      // stays, so the picker's "Custom" group can put it back.
      takeCardOff: (id) => setBoardLayout((boardLayout ?? DEFAULT_LAYOUT).filter((i) => i.id !== id)),
      // ADDITIVE, unlike `applyLayout` — see the note on the call in scripts.ts.
      addWidget: (id) => {
        const prev = boardLayout ?? DEFAULT_LAYOUT;
        const meta = META_BY_ID[id];
        if (!meta || prev.some((i) => i.id === id)) return;
        setBoardLayout([...prev, { id, span: meta.span, rows: meta.rows }]);
      },
      // MERGE, never assign. The board hides rather than deletes a widget whose
      // module was removed or whose device is away, and promises it comes back
      // at its saved position — a proposal only ever names the visible ones, so
      // assigning would silently delete the rest (TH-442).
      applyLayout: (items) => setBoardLayout(applyLayout(boardLayout ?? DEFAULT_LAYOUT, items, layoutCtx())),
      // The undo assigns exactly: it is restoring a board that really existed.
      restoreLayout: (items) => setBoardLayout(items),
      // Catch Me Up's Resume (TH-478) — the first real caller of the Game Link
      // rule: the profile linked to the game applies (source 'game', with the
      // one before it kept as `revertTo`), then Play opens on that game.
      // The one launch every Play uses (TH-484): profile, clock, Play.
      resumeGame: (gameId) => launchGame(gameId),
      // Autocast (TH-509). `arm` is Forge's own Add — the receipt and all — so
      // Forge shows it as yours and its Remove is still the switch.
      autocast: (call) => {
        const { nova: n, agents: ag, autocast: ac, gallery: g, playtime: pt } = acRef.current;
        const s = ac.session;
        switch (call.op) {
          case 'arm':
            if (!call.plan) return;
            ag.add(AUTOCAST_AGENT, AUTOCAST_VERSION);
            ac.arm(call.plan, call.convId ?? n.active?.id ?? null, pt.playing ?? AUTOCAST_GAME);
            return;
          case 'launch':
            if (s.phase !== 'armed') return;
            ac.launch();
            launchGame(s.gameId ?? AUTOCAST_GAME);
            return;
          case 'end':
            if (s.phase !== 'recording') return;
            ac.end(sessionSecondsOf(s, SPEED[n.settings.demoSpeed]));
            pt.stop();
            return;
          case 'approveAll': {
            if (s.phase !== 'ready') return;
            const clips = s.clips.map((c) => (c.status === 'discarded' ? c : { ...c, status: 'approved' as const }));
            ac.approveAll();
            ac.finish();
            g.add(toUserClips({ ...s, finishedAt: Date.now() }, clips));
            return;
          }
          case 'discardAll':
            if (s.phase !== 'ready') return;
            ac.discardAll();
            ac.finish();
            return;
          case 'stop':
            ag.remove(AUTOCAST_AGENT);
            if (pt.playing && pt.playing === s.gameId) pt.stop();
            ac.reset();
            return;
          case 'reset':
            ag.remove(AUTOCAST_AGENT);
            ac.reset();
            g.removeWhere((c) => c.id.startsWith('autocast-'));
            return;
        }
      },
    });
    return () => registerActions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerActions, navigate, searchParams, setSearchParams, selectProfile, gameLaunched, launchGame, upsertOverlay, removeOverlay, addCard, cards, setBoardLayout, boardLayout, has, deskDevices, simState]);

  // Page tabs, minus any gated behind a removed module (e.g. Shop → shop module).
  const visibleTabs = useVisibleNavTabs();

  // Main nav = routed page tabs + the Devices toggle (opens the flyout).
  const navItems: MenuItem[] = [
    ...visibleTabs,
    {
      ...DEVICES_ITEM,
      active: devicesOpen,
      onClick: () => {
        // With a device modal open (?sku=), the panel sits BELOW the modal
        // (device-panel.css: z-40 vs z-51 — deliberate for the panel→modal
        // flow, where the panel waits behind). The reverse flow was unhandled:
        // clicking Devices lit the tab and opened the panel invisibly behind
        // the full-screen canvas — a dead-looking click (Cindy, 2026-08-03).
        // Devices means "take me to my devices", so it closes the modal the
        // same way DeviceModalHost.close() does, and shows the panel.
        // The two right-rail panels are mutually exclusive: 340px + 380px of
        // rail leaves a 1280px laptop 560px of page, which is not a layout
        // either panel was designed to sit in. Whichever you ask for, you get.
        setNovaPinned(false);
        const modalOpen = ['sku', 'device', 'spec'].some((k) => searchParams.has(k));
        if (modalOpen) {
          // Carry the device you were just looking at into the panel — landing
          // on the roster's first device would read as losing your place.
          setPanelFocus(searchParams.get('sku') ?? undefined);
          const p = new URLSearchParams(searchParams);
          ['sku', 'device', 'spec', 'tab'].forEach((k) => p.delete(k));
          setSearchParams(p, { replace: true });
          setDevicesOpen(true);
        } else {
          setDevicesOpen((o) => !o);
        }
      },
    },
  ];

  // The bottom bar on a compact window (Chris, 2026-10-20): the same items,
  // docked at the bottom edge with labels on. At most NAV_SLOTS of them; when
  // there are more, the first NAV_SLOTS − 1 show and "More" holds the rest in
  // a menu above the bar. Devices is last in the list, so it is the first to
  // fold into More. A hidden tab whose page is open lights More instead.
  const overflow = navItems.length > NAV_SLOTS ? navItems.slice(NAV_SLOTS - 1) : [];
  const onOverflowPage = overflow.some((i) => (i.to ? (i.end ? pathname === i.to : pathname.startsWith(i.to)) : !!i.active));
  const barItems: MenuItem[] = overflow.length
    ? [
        ...navItems.slice(0, NAV_SLOTS - 1),
        { id: 'more', label: 'More', icon: <Icon name="more" />, active: moreOpen || onOverflowPage, onClick: () => setMoreOpen((o) => !o) },
      ]
    : navItems;

  // Personalize's desk state is app-wide: a mode switched anywhere rebuilds the
  // desk, and Settings › Appearance can offer to match the desk lighting.
  return (
    <PersonalizeProvider>
    <PageSizeContext.Provider value={pageSize}>
    {/* `ad-bottom-banner` lets shell.css reserve the banner's height under the
        page content, the same way `devices-open` reserves the panel's width.
        Gated on the unlock like the ad itself: a placement left in storage
        while the row is locked must not reserve space for an ad that is not
        there. */}
    <div
      className={'shell' + (pageFull ? ' page-full' : '') + (pageWide ? ' page-wide' : '') + (devicesOpen ? ' devices-open' : '') + (gameOpen ? ' game-open' : '') + (novaRail ? ' nova-open' : '') + (fabMode ? ' nova-fab' : '') + (railOverlay ? ' rail-overlay' : '') + (compact ? ' has-bottom-nav' : '') + (novaResizing ? ' nova-resizing' : '') + (adUnlocked && adPlacement === 'bottom-banner' ? ' ad-bottom-banner' : '')}
      // The person's own width — runtime state, not a design value, so it is
      // the one inline length here; the default lives in shell.css.
      style={{ ['--nova-panel-w' as string]: `${shownNovaW}px`, ['--nova-window-h' as string]: `${shownWindowH}px` }}
    >
      <WallpaperLayer />
      <nav className="shell-nav">
        {/* The profile switcher holds the top-left, where the HyperX mark was:
            the app's current mode is the first thing the bar says. */}
        <div className="shell-brand">
          <ProfileSwitcher />
        </div>
        {/* On a compact window the tabs are the bottom bar; the top bar keeps
            who you are and who you are talking to. */}
        {compact ? (
          <span />
        ) : (
          <Menu
            items={navItems}
            orientation="horizontal"
            hideLabels={hideNavLabels}
            hideIcons={hideNavIcons}
            tooltips
            aria-label="Main"
          />
        )}
        <div className="shell-util">
          {/* Module Browser — icon-only, named by the same DS tooltip the nav uses. */}
          <Tooltip content="Module Browser" placement="bottom">
            <IconButton label="Module Browser" onClick={openModules}>
              <Icon name="puzzle" size={16} />
            </IconButton>
          </Tooltip>
          {/* Nova, pinned to the right rail — the chat following you across the
              app (TH-434). It takes the slot the Agent Catalog held, and the
              catalog moves into the panel's own header, beside the agents you
              would be talking to.
              `message` rather than `twinkle`: the nav already spends twinkle on
              the Nova TAB, and with labels hidden (the default) two identical
              marks in one bar name two different things. Twinkle is the place,
              the speech bubble is the conversation.
              The catalog it replaced moves into the panel header — so this
              slot falls back to the catalog wherever no panel can host one
              (Nova uninstalled, or /nova itself). See `novaToggleInNav`. */}
          {/* Nova left the nav (Chris, 2026-10-20): this button is its door. On
              the full page it is the way back to the sidebar, so the page is
              never a dead end now that no tab leads out of it either. */}
          {hasNova && onNovaRoute ? (
            <Tooltip content={fabMode ? 'Back to chat window' : 'Back to sidebar'} placement="bottom">
              <IconButton
                label={fabMode ? 'Back to chat window' : 'Back to sidebar'}
                onClick={() => {
                  setDevicesOpen(false);
                  if (gameOpen) closeGame();
                  setNovaPinned(true);
                  navigate(lastPage.current || '/');
                }}
              >
                <Icon name="collapse" size={16} />
              </IconButton>
            </Tooltip>
          ) : novaToggleInNav ? (
            <Tooltip content={novaPinned ? 'Unpin Nova' : 'Ask Nova'} placement="bottom">
              <IconButton
                label={novaPinned ? 'Unpin Nova' : 'Ask Nova'}
                aria-pressed={novaPinned}
                className={novaOpen ? 'active' : undefined}
                onClick={() => {
                  // Asking for one rail puts the other away (see the Devices
                  // toggle above).
                  if (!novaPinned) {
                    setDevicesOpen(false);
                    if (gameOpen) closeGame();
                  }
                  setNovaPinned(!novaPinned);
                }}
              >
                <Icon name="message" size={16} />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip content="Forge" placement="bottom">
              <IconButton label="Forge" onClick={openAgents}>
                <Icon name="ai" size={16} />
              </IconButton>
            </Tooltip>
          )}
          <AccountMenu />
        </div>
      </nav>
      <div className="shell-scroll" ref={scrollRef}>
        <main className="shell-content">
          <Outlet />
        </main>
      </div>
      {compact && (
        <div className="shell-bottom-nav">
          <Menu items={barItems} orientation="horizontal" variant="bar" hideIcons={hideNavIcons} aria-label="Main" />
          {overflow.length > 0 && <NavOverflow items={overflow} open={moreOpen} onClose={() => setMoreOpen(false)} />}
        </div>
      )}
      <DevicePanel open={devicesOpen} focusSku={panelFocus.sku} focusKey={panelFocus.n} onClose={() => setDevicesOpen(false)} />
      <GamePanel open={gameOpen} gameId={gameParam} onClose={closeGame} />
      {/* Mounted only while the module is installed: an uninstalled module must
          leave no surface behind, and the panel reads provider state that only
          matters once Nova exists. */}
      {hasNova && (
        <NovaPanel
          open={novaOpen}
          mode={fabMode ? 'window' : 'rail'}
          floating={!fabMode && novaFloating}
          onClose={() => setNovaPinned(false)}
          onOpenAgents={openAgents}
          // The window's height, from its top edge — a window only.
          resizeHeight={
            fabMode
              ? {
                  value: shownWindowH,
                  min: NOVA_WINDOW_MIN_H,
                  max: windowMaxH,
                  onChange: resizeWindowH,
                  onRelease: releaseWindowH,
                  onDragState: (d) => {
                    if (d) dragFromH.current = windowH;
                    setNovaResizing(d);
                  },
                }
              : undefined
          }
          // The window resizes from its left edge exactly as the rail does,
          // from its own remembered width (TH-507).
          resize={{
            value: shownNovaW,
            min: NOVA_MIN_W,
            max: novaMaxW,
            snap: novaSnap,
            onChange: resizeNova,
            onRelease: releaseNova,
            onDragState: (d) => {
              if (d) dragFrom.current = novaW;
              setNovaResizing(d);
            },
          }}
        />
      )}
      {/* Nova's floating door (TH-507). Not on /nova (the page is the chat), and
          not over an open sheet on a phone, where it would sit on the composer —
          the sheet's own Minimize is the way back. */}
      {fabMode && !onNovaRoute && !(compact && novaWindow) && <NovaFab ref={fabRef} open={novaWindow} onToggle={toggleNovaWindow} />}
      <DeviceModalHost />
      <FeatureModalHost />
      {/* Keeps Settings' power mode and the shared mode event one value. */}
      <PowerModeBridge />
      {/* The Nova recipes' watchers — agents that speak first, like the refund
          agent's window warning — and the app's one toast stack (TH-484). */}
      {recipeWatchers().map((Watch, i) => (
        <Watch key={i} />
      ))}
      <ToastHost />
      {/* Admin/testing: the hardware side of the onboard-profile model, floated
          above the canvases so device-side acts can be watched live. */}
      <DeviceSimHud />
      {/* The review's switches, on every page once Admin turns them on
          (prototype-only; hidden by default, Chris 2026-10-26). */}
      {showSimulator && <SimulatorRig />}
      {/* Advertising concepts (Admin → Testing tools). Renders nothing unless a
          fixed placement is chosen; the inline one lives on Home. */}
      <AdHost />
      {/* Overlays (TH-438): the HUD cards placed anywhere on screen. Nothing
          renders until one is visible. */}
      <OverlayHost />
      {/* Grounding (TH-441): hands the Nova provider a snapshot getter of real
          app state. Renders nothing. It lives HERE and not on the Nova page for
          the same reason registerActions does (TH-434) — a reply sent from the
          pinned panel on /perform must be grounded too, and "where the person is
          standing" is only interesting BECAUSE they are not on /nova. */}
      <NovaContextBridge />
    </div>
    </PageSizeContext.Provider>
    </PersonalizeProvider>
  );
}
