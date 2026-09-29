// ══════════════════════════════════════════════════════════════════════════
// Shared arrangement model — one desk drawing, two surfaces.
//
// The monitor modal hero (DisplayArrange) and the Perform Device Overview map
// read and write the SAME saved layout (Settings.displayArrange), so a display
// dragged in one place has moved in the other. Decision C, 2026-07-28:
// "one schematic, two verbs (View / Arrange)" — design-assets/chris-sync-2026-07.md #2.
//
// Coordinates are FRACTIONS of the stage box (0–1, tile top-left), not pixels.
// Measured 2026-07-30: the modal hero stage is 988×230 (fluid — it tracks the
// modal width) and the Perform stage is 672×248, so a pixel saved on one stage
// lands somewhere else on the other, and the modal's own layout shifts when the
// window is resized. Fractions fix both. `space: 'fraction'` tags the payload;
// anything without that tag is a legacy pixel layout and falls back to DEFAULTS.
// ══════════════════════════════════════════════════════════════════════════
import { useCallback } from 'react';
import type { DisplayArrange as ArrangeState } from '../state/Settings';
import { getResolvedSku } from './skus';

export type Frac = { left: number; top: number };
export type Positions = Record<string, Frac>;

// Displays the OS knows about — the drag/save roster. The clamshell Gaming
// Laptop is deliberately absent: a closed lid is not part of a display
// arrangement (Cindy, 2026-07-29), so it is placed relative to the monitor it
// drives instead. See SLAB_OFFSET.
//
// This is the FULL roster, and it is not what is on the desk. Which of these are
// actually attached comes from the Admin row's hardware list (`deskDevices`) —
// see visibleDisplays() below. Everything that draws or measures
// the desk reads that function; the constant stays exported because id → kind
// lookups must answer for a display even while it is switched off.
export const DISPLAYS = [
  { id: 'oled-27', name: 'OMEN OLED 27', kind: 'monitor', sku: 'pulse-27' },
  { id: 'builtin', name: 'Built-in Display', kind: 'laptop' },
  { id: 'treehouse-32', name: 'Treehouse 32', kind: 'monitor', sku: 'treehouse-32' },
] as const;

// ── What is on the desk: a ROSTER, not two counts (2026-09-08, Cindy) ────────
// Until today the desk was described by `displayCount` (1–3) and `pcCount`
// (1–2), and "which screens survive at 2" was decided here by a priority list.
// A count cannot say which two: "Displays 2" was BOTH the Treehouse 32 + OMEN
// OLED 27 desk AND the Treehouse 32 + laptop-lid desk, and this file had quietly
// picked the second (2026-08-24). Cindy's own example at the review: "디스플레이스
// 모니터 두 대여도 되고, 컴퓨터 한 대 랩탑 한 대 모니터 한 대여도 디스플레이스는
// 두 대" — the same number, two different desks.
//
// So the Admin row now names the hardware, and everything below is derived.
// The Treehouse 32 is never in the list: it is the display this section is
// about and a desk without it has nothing to configure. The MacBook is one
// entry that brings BOTH a computer and a screen (`builtin`) — a laptop on the
// desk has its lid open; the closed-lid case is a later state, not a device
// (the data for it already exists as the Device simulator's `connected`).
// The two computers keep their routing numbers: MacBook = pc1, tower = pc2,
// whether or not the other one is here.
//
// Six desks fall out (Treehouse 32 + any subset with at least one computer):
//   {mac} · {tower} · {mac,tower} · {oled,mac} · {oled,tower} · {oled,mac,tower}
export const DESK_OPTIONAL = ['pulse-27', 'macbook', 'tower'] as const;
export type DeskDevice = (typeof DESK_OPTIONAL)[number];
/** Every optional device present — today's demo desk, and the default. */
export const DESK_DEFAULT: DeskDevice[] = ['pulse-27', 'macbook', 'tower'];

/** The optional hardware on the desk, read straight from storage — the desk
    maths is called from plain functions as well as components and cannot reach
    the settings context. `SCHEMA.deskDevices` owns the key; null = default. */
export function deskDevices(): DeskDevice[] {
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem('deskDevices');
  if (raw === null) return DESK_DEFAULT;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return DESK_DEFAULT;
    return DESK_OPTIONAL.filter((d) => v.includes(d));
  } catch {
    return DESK_DEFAULT;
  }
}
const onDesk = (d: DeskDevice) => deskDevices().includes(d);

/** Host indices (0 = MacBook, 1 = tower) of the computers on the desk. Never
    empty: a desk with no computer has nothing plugged into the monitor, so the
    Admin row refuses to take the last one away — and if storage still says so,
    the MacBook stands in rather than the maths dividing by zero. */
export function deskPcs(): (0 | 1)[] {
  const out: (0 | 1)[] = [];
  if (onDesk('macbook')) out.push(0);
  if (onDesk('tower')) out.push(1);
  return out.length ? out : [0];
}

/** How many screens are on the desk (1–3), derived from the roster. Kept by
    name because the Admin status line and the dead `RichArrangement` read it. */
export function deskDisplayCount(): number {
  return visibleDisplays().length;
}

/**
 * The two computers this desk switches between, named once.
 *
 * The names live in the SKU (`gearSwitch.hosts`) because Gear Switch is the
 * feature that owns them. They had also been typed out by hand in six live
 * strings across four files — the slab's caption, the KVM chip, two aria
 * labels, the desk card's active-computer line and a port's `connected` field —
 * so renaming the second computer meant finding all six (counted 2026-09-03:
 * 18 mentions, of which 9 were prose). Now they are read.
 *
 * The fallback is the same pair the two Gear Switch call sites already fell back
 * to, so a SKU without the field behaves exactly as before.
 */
/**
 * Where the keyboard and mouse receivers are plugged in — the SAME model the
 * Connectivity tab's Gear Switch card uses (`GearPlacement`, MonitorTabs.tsx),
 * read from the SKU's `gearSwitch.receivers` over a hub default.
 *
 * `hub`    — the receiver is in the monitor, so the gear rides with the screen.
 * `direct` — plugged into a computer, so it stays with that computer and does
 *            not follow a switch ("Screen only", the card's own words).
 *
 * The DESK card had been drawing this from its own binary instead (two CSS
 * classes, `dov-only-direct` on the laptop tile and `dov-only-kvm` on the
 * monitor). That copy was lossy in a way that showed: it could only say "both,
 * here" or "both, there", and when the laptop left the desk BOTH homes were
 * gone and the picture said nothing about where the keyboard was (reproduced
 * 2026-09-09, tower-only desk: one pill in the DOM, none visible).
 * Reading the real model instead means a home always exists, and per-device
 * states like "mouse direct, keyboard on the hub" become expressible.
 */
/** Which end of the desk a computer stands at, as the person set it in the
    `Arrange` window — or null while nobody has said. Read from the same saved
    arrangement the screens use, because it is the same desk. */
export function computerSide(saved: ArrangeState | null, id = 'tower'): 'left' | 'right' | null {
  const v = saved?.computers?.[id];
  return v === 'left' || v === 'right' ? v : null;
}

export type GearWhere = 'hub' | 'direct';
export function deskGear(): Record<'keyboard' | 'mouse', GearWhere> {
  const sku = getResolvedSku('treehouse-32');
  const gear = (sku?.features as { gearSwitch?: { receivers?: unknown } } | undefined)?.gearSwitch;
  const r = (gear?.receivers ?? {}) as Record<string, unknown>;
  const one = (k: string): GearWhere => (r[k] === 'direct' ? 'direct' : 'hub');
  return { keyboard: one('keyboard'), mouse: one('mouse') };
}

export const DESK_HOSTS_FALLBACK = ['MacBook', 'OMEN 35L'];
export function deskHosts(): string[] {
  const sku = getResolvedSku('treehouse-32');
  const gear = (sku?.features as { gearSwitch?: { hosts?: unknown } } | undefined)?.gearSwitch;
  return Array.isArray(gear?.hosts) && gear.hosts.length >= 2
    ? (gear.hosts as string[])
    : DESK_HOSTS_FALLBACK;
}

/** The names of the computers ON this desk, in routing order (MacBook = pc1,
    tower = pc2). `deskHosts()` is the SKU's pair and always has two; anything
    that names "the computer" to a person reads this instead, so a desk with
    one computer never offers the other (2026-09-18 — My Devices kept saying
    `Switch computer · To OMEN 35L` on a MacBook-only desk). */
export function deskPcNames(): string[] {
  const hosts = deskHosts();
  return deskPcs().map((i) => hosts[i]);
}

/** The computer the keyboard is on — `kvm.activePc` resolved against the desk,
    so a stale `pc2` on a desk without the tower names the computer that is
    actually there rather than one that left. */
export function activePcName(activePc: 'pc1' | 'pc2'): string {
  const idx = activePc === 'pc2' ? 1 : 0;
  return deskPcs().includes(idx) ? deskHosts()[idx] : deskPcNames()[0];
}

/** What a display is called where it is drawn as HARDWARE — the monitor
    window's hero and Personalize → DESK. The laptop's own screen is `MacBook`
    there (2026-09-21, Cindy), the name the Admin desk, Gear Switch and My
    Devices use for the same laptop; `DISPLAYS[].name` (`Built-in Display`) stays
    the OS word, for the Arrange window that arranges screens. */
export function hardwareName(d: { id: string; name: string }): string {
  return d.id === 'builtin' ? deskHosts()[0] : d.name;
}

/** Both computers on the desk — the only state with anything to switch. */
export function hasSecondPc(): boolean {
  return deskPcs().length > 1;
}
/** The tower stands on the desk whenever it is in the roster, second computer or
    the only one (2026-09-08). It used to be drawn only for `pcCount === 2`,
    which was right when the MacBook could not leave. */
export function hasTower(): boolean {
  return onDesk('tower');
}

/** The screens actually on the desk, in roster order. Roster order is kept
    (rather than priority order) because saved positions are keyed by id and the
    desk map reads left-to-right — reordering would move screens that did not
    change. */
export function visibleDisplays(): (typeof DISPLAYS)[number][] {
  const oled = onDesk('pulse-27');
  const lid = onDesk('macbook');
  return DISPLAYS.filter((d) => d.id === 'treehouse-32' || (d.id === 'oled-27' && oled) || (d.id === 'builtin' && lid));
}

export const TILE_W: Record<string, number> = { monitor: 144, laptop: 112 };
export const TILE_H: Record<string, number> = { monitor: 82, laptop: 70 };

// ── Photoreal tile sizes (2026-08-02, Cindy) ────────────────────────────────
// The schematic tiles sized every monitor the same (144px) and the laptop at
// 78% of one, which is not what a desk looks like: a 16" laptop is about HALF
// the width of a 32" monitor. A photoreal map cannot borrow that fudge — a real
// render at the wrong size reads as a wrong render — so tile width comes from
// the hardware's physical width, and everything else is measured, not guessed.
//
// WIDTH_CM = the product's overall width (not the diagonal): what you would
// measure across the desk. The 32" draws at TILE_REF px and the rest follow.
const TILE_REF = 132; // px drawn for the 32"
const WIDTH_CM: Record<string, number> = { 'treehouse-32': 71.5, 'oled-27': 61.0, builtin: 35.6 };

// The renders share one export spec now: tight-cropped, zero margin (normalized
// 2026-08-03 with design-loop/tools/render-framing.py, which also guards the
// set — the 2026-08-02 BOX table that un-did each file's private margins is
// gone WITH the margins, not superseded by another table). What remains is the
// hardware's own shape: width ÷ height of the visible product incl. stand,
// measured from the tight files (alpha > 12 — the old alpha>0 box swallowed an
// invisible soft-shadow halo and drew the MacBook ~35% too wide a box).
//   treehouse32-front-tight  979×727   → 1.347
//   omen-oled27-front        1477×965  → 1.531
//   macbook-front-generic    1268×937  → 1.353
const RENDER_ASPECT: Record<string, number> = {
  'treehouse-32': 979 / 727,
  'oled-27': 1477 / 965,
  builtin: 1268 / 937,
};

// ── Arrange-editor tile sizes ───────────────────────────────────────────────
// The precise editor sizes displays by PIXEL SPACE, not physical size, because
// what it is editing is where the cursor crosses — and the cursor travels in
// pixels. So the two lenses on the same desk draw deliberately different
// pictures: the view map asks "how big is this thing on my desk" (WIDTH_CM
// above), the editor asks "how much screen does it contribute".
//
// These are LOGICAL points, the space the OS arranges in, not native pixels —
// a 16" MacBook is 3456x2234 physical but arranges as ~1728x1117. ⚠️ The values
// below are the defaults for these panels; a real implementation reads the
// user's current scaling instead, which can change these numbers a lot.
const LOGICAL: Record<string, { w: number; h: number }> = {
  'treehouse-32': { w: 3840, h: 2160 },
  'oled-27': { w: 2560, h: 1440 },
  builtin: { w: 1728, h: 1117 },
};
/** px per logical point — tuned so the default three-display desk fits the
    editor stage with room to rearrange. */
export const ARRANGE_SCALE = 0.078;

/** Schematic tile size for a display — the Perform desk map's boxes, sized by
    kind rather than by hardware. Kept as a function of id so the shared bounds
    maths can ask any surface for its own sizes. */
export function schematicTile(id: string): { w: number; h: number } {
  const kind = DISPLAYS.find((d) => d.id === id)?.kind ?? 'monitor';
  return { w: TILE_W[kind], h: TILE_H[kind] };
}

/** Editor tile size for a display, in stage px. */
export function logicalTile(id: string): { w: number; h: number } {
  const l = LOGICAL[id] ?? LOGICAL['oled-27'];
  return { w: Math.round(l.w * ARRANGE_SCALE), h: Math.round(l.h * ARRANGE_SCALE) };
}

/** Drawn size of a display's render — the photoreal tile's bounds = the
    hardware's box, so the ring hugs the display and the drag grabs it. */
export function photoTile(id: string): { w: number; h: number } {
  const cm = WIDTH_CM[id] ?? WIDTH_CM['oled-27'];
  const aspect = RENDER_ASPECT[id] ?? RENDER_ASPECT['oled-27'];
  // Honest ratios, but not below a grabbable tile: a 16" laptop really is half
  // the width of a 32" monitor, and at TILE_REF that lands near 66px — true to
  // the desk and too small to aim at. The floor trades a little accuracy at the
  // small end for a target you can hit; the big end stays exact.
  const w = Math.max(90, Math.round(TILE_REF * (cm / WIDTH_CM['treehouse-32'])));
  return { w, h: Math.round(w / aspect) };
}

/**
 * The second computer's drawn box on the desk card.
 *
 * A TOWER since 2026-09-03 (Cindy: "gear switch 에 데스크탑도 샘플로 디자인하면
 * 좋을거같애"). It was a 112×24 clamshell slab, and that shape was the reason
 * the object never read as a computer: a closed laptop seen head-on is its own
 * thickness, a 4.7:1 bar, and making it photoreal would not have changed the
 * silhouette. A tower stands up, so it reads at 30px wide and cannot be
 * mistaken for the open laptop beside it.
 *
 * Sized the way `photoTile` sizes a display — from the hardware's real width
 * against the Treehouse 32's — rather than from a number that looks right:
 * the OMEN 35L is about 16.5cm wide and 40cm tall against the monitor's 71.5cm,
 * so at TILE_REF it lands near 30×74. No minimum is applied: the grab-target
 * floor `photoTile` carries exists for dragging, and nothing on this card is
 * draggable any more (2026-09-01).
 */
const TOWER_CM = { w: 16.5, h: 40 };
/** Drawn size of the second computer, in the same stage px `photoTile` uses. */
export function towerTile(): { w: number; h: number } {
  const w = Math.round(TILE_REF * (TOWER_CM.w / WIDTH_CM['treehouse-32']));
  return { w, h: Math.round(w * (TOWER_CM.h / TOWER_CM.w)) };
}

/**
 * Read a spacing token off the live element, in px.
 *
 * Spacing here has to come from the library's ramp like everywhere else — a
 * hand-typed 24 or 8 is a number that stops tracking the design system the
 * moment Chris changes it (Cindy, 2026-08-04: "패딩이나 마진 스페이싱 이런 거
 * 크리스 컴포넌트 따라가는 걸로 하기로 했잖아"). The fallback only covers a
 * detached node, never a live one.
 */
export function tokenPx(el: Element, name: string, fallback: number): number {
  const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

/** Room kept under a tile for its name label — `--gutter` off the ramp. */
export const NAME_GUTTER_TOKEN = '--gutter';
/**
 * Breathing room inside the stage walls. The tiles carry a drop-shadow glow
 * that reaches ~13px past the render's own silhouette (`0 0 12px` + `0 0 1.5px`
 * in display-arrange.css), and the stage clips — so a tile clamped flush to the
 * wall had its glow, and on the widest renders a sliver of the hardware itself,
 * cut off (Cindy, 2026-08-04, on OMEN OLED 27). `--gutter-sm` (16px) is the
 * first step on the ramp that clears the glow.
 */
export const STAGE_INSET_TOKEN = '--gutter-sm';

// Default layout = the reviewed Device Overview map (v3), converted from its
// 672×248 stage so both surfaces open on the same picture.
//
// ⚠️ These tops are the LAST RESORT only — `defaultsFor()` below is what every
// surface should open with. They are kept because a dozen call sites use
// `positions[id] ?? DEFAULTS[id]` to survive a malformed saved entry, and a
// fallback that needs a measured stage cannot serve that job.
// ⚠️ `builtin.left` is NOT the authored 205: the three photoreal tiles are 113 /
// 90 / 132 wide (real product proportions, deliberate) and the authored lefts put
// 84px between the first pair and 72px between the second. Unequal gaps under
// deliberately unequal widths read as a desk that is off-centre no matter where
// the true centre is — Cindy, 2026-08-06: "아직도 center align이 안 됐고", after
// the hover hint had been measured dead-centre to 1px. Equalised to 78.25px each
// while keeping the row's overall span, so only the middle display moved.
// (`regression-invariants.md` #17 — this closes it.)
/**
 * Fallback authored width. NOT a shared constant: the two surfaces that draw
 * this desk author against DIFFERENT boxes — the DESK card's `--dov-href` is
 * 672px and the hero's `--dsa-href` is 732px — so a fraction means 60px more on
 * one than the other. That is why the same stored layout drew two different
 * desks, and why `DEFAULTS.builtin` below is written `/ 732` while its two
 * neighbours are `/ 672`: it was authored on the hero. Each caller passes its
 * own width now (`defaultsFor(..., refW)`); this is only the last resort.
 */
export const REF_W = 672;

/** The authored stage HEIGHT the desk card's fractions are measured against —
    `--dov-vref`, pinned at 248px by desk-widget.css because changing it would
    move every saved layout. */
export const REF_V = 248;

export const DEFAULTS: Positions = {
  'oled-27': { left: 24 / 672, top: 64 / 248 },
  builtin: { left: 217.35 / 732, top: 78 / 248 },
  'treehouse-32': { left: 354 / 672, top: 64 / 248 },
};

// ── The desk floor (Cindy, 2026-08-06) ──────────────────────────────────────
// Displays standing side by side share a floor: the desk surface. The magnet
// already enforces that for a display the user drags (see `sharesRow` + the
// bottom snap in DisplayArrange) — but nothing enforced it for the layout the
// app OPENS with, and that is the one everybody sees first.
//
// Measured 2026-08-06 on the running app, modal hero at 1512×950: tile bottoms
// came to 128.2 / 133.0 / 152.2, so the three name captions sat at 136.2 /
// 141.0 / 160.2 — a 24px stagger under a desk that is meant to read as one
// line. Cindy read it as "the gap between each product and its label differs";
// that gap is in fact a uniform 8px on all three (measured). The floor was the
// thing that was wrong.
//
// Why the constant above cannot simply be re-authored: a stored `top` is a
// FRACTION of stage height, while a tile's height is FIXED px, and the two
// surfaces are neither the same height nor drawn with the same tile sizes
// (photoTile 74/67/98 in the band, schematicTile 82/82/70 on the Perform map).
// One set of fractions therefore lines the floor up on exactly one surface at
// exactly one window height; everywhere else it drifts by
// Δheight × (1 − H/H₀) — up to ~9px across this band's own clamp range.
// So the floor is stated once, and each surface resolves it against its own
// stage and its own tiles.
/** Desk surface, as a fraction of stage height. = the v3 map's own floor
    (the tallest tile's bottom, 64 + 82 of 248), so the reviewed picture is
    unchanged: on that map this reproduces its tops to within 2px. */
const FLOOR = 146 / 248;

/**
 * The layout a surface opens with, every display standing on the desk.
 * `tile` is the surface's own size function, `stageH` its measured height.
 */
/**
 * The gap between two neighbouring figures on the desk. SPEC: desk-stage §3,
 * confirmed 2026-09-01.
 *
 * Not a new number: it is the even gap the reviewed three-display layout
 * already had. That row spans 24→486 (462) and its tiles are 113+90+132 (335),
 * leaving 127 across two gaps = 63.5 each. Stated as a ratio of TILE_REF so it
 * travels with the drawing rather than being a pixel that means nothing once
 * the tiles resize.
 */
export const DESK_GAP = Math.round(TILE_REF * 0.48); // 63

/** Where the leftmost figure stands, in the authored 672 box — the reviewed
    layout's own left edge, kept so a three-display desk does not move. */
const ROW_LEFT = 24;

/**
 * The layout a surface opens with, every display standing on the desk.
 * `tile` is the surface's own size function, `stageH` its measured height.
 *
 * Lefts are COMPUTED from DESK_GAP since 2026-09-01, where they used to be read
 * from `DEFAULTS[id].left`. Those were fractions authored for a three-display
 * desk, and nothing re-derived them when the desk had fewer: the survivors kept
 * their old thirds and the missing display's slot stayed on screen as a hole.
 * That is where the 100px trench between two displays came from (measured on
 * the hero, 2026-09-01, against tiles 114 and 168 wide), and why a one-display
 * desk sat off to one side.
 *
 * Order is the authored left-to-right order, so which display stands where is
 * unchanged — only the distances are restated. At three displays this
 * reproduces the reviewed picture to within a pixel (24 / 200 / 353 against the
 * authored 24 / 199.5 / 354), so nothing Cindy has already approved moves.
 *
 * Absolute centring is deliberately NOT done here: the clamshell rides beside
 * the monitor it feeds (`SLAB_OFFSET`) and is not a display, so the desk's true
 * middle is only known once it is included — which each surface already does
 * when it centres the whole group (`deskOffset`).
 */
export function defaultsFor(
  stageH: number,
  tile: (id: string) => { w: number; h: number },
  refW: number = REF_W,
): Positions {
  if (!(stageH > 0)) return DEFAULTS;
  const floor = FLOOR * stageH;
  const order = [...visibleDisplays()].sort((a, b) => DEFAULTS[a.id].left - DEFAULTS[b.id].left);
  const out: Positions = {};
  let x = ROW_LEFT;
  for (const d of order) {
    const s = tile(d.id);
    out[d.id] = { left: round(x / refW), top: round((floor - s.h) / stageH) };
    x += s.w + DESK_GAP;
  }
  return out;
}

/**
 * A saved layout, plus a place for any display it does not mention.
 *
 * The gap this closes (measured 2026-09-02, Cindy: "디바이스 추가할때마다 히어로
 * 이미지가 arrange랑 안맞아"): a saved layout describes the desk that existed
 * when it was saved. Add a display and it says nothing about the newcomer — so
 * every surface invented a place for it on its own, and they did not agree.
 * With a two-display layout saved and a third attached, the hero drew
 * `OMEN OLED 27 → Built-in Display → Treehouse 32` while the Arrange window drew
 * `Built-in Display → OMEN OLED 27 → Treehouse 32`. Left-to-right ORDER is the
 * one thing the 2026-08-29 call says both lenses must share, so this was a real
 * disagreement and not the deliberate difference in how they draw.
 *
 * `SPEC: desk-stage` covered a desk that LOSES a display; this is the other
 * direction, and it belongs to the same rule.
 *
 * The newcomer stands beside the neighbour it is authored next to, DESK_GAP
 * away, on that neighbour's floor — the least surprising place, and the same
 * spacing `defaultsFor()` uses. Nothing already saved moves: a layout someone
 * arranged by hand is not re-flowed because a display arrived.
 */
export function completeLayout(
  saved: Positions,
  fromSaved: Set<string>,
  tile: (id: string) => { w: number; h: number } = photoTile,
  refW: number = REF_W,
): Positions {
  const order = [...visibleDisplays()].sort((a, b) => DEFAULTS[a.id].left - DEFAULTS[b.id].left);
  if (order.every((d) => fromSaved.has(d.id))) return saved;
  const out: Positions = { ...saved };
  order.forEach((d, i) => {
    if (fromSaved.has(d.id)) return;
    // Nearest already-placed neighbour in authored order — prefer the one on the
    // left so a newcomer joins the end of the row rather than opening a hole.
    let leftIdx = -1;
    for (let k = i - 1; k >= 0; k -= 1) if (fromSaved.has(order[k].id)) { leftIdx = k; break; }
    let rightIdx = -1;
    for (let k = i + 1; k < order.length; k += 1) if (fromSaved.has(order[k].id)) { rightIdx = k; break; }
    const gap = DESK_GAP / refW;
    if (leftIdx >= 0) {
      const n = order[leftIdx];
      out[d.id] = { left: round(out[n.id].left + (tile(n.id).w / refW) + gap), top: out[n.id].top };
    } else if (rightIdx >= 0) {
      const n = order[rightIdx];
      out[d.id] = { left: round(out[n.id].left - (tile(d.id).w / refW) - gap), top: out[n.id].top };
    } else {
      out[d.id] = DEFAULTS[d.id];
    }
  });
  return out;
}

/** Whether the user has a layout of their own. False → `defaultsFor()`. */
export function hasStoredLayout(saved: ArrangeState | null): boolean {
  return !!saved && saved.space === 'fraction' && Object.keys(saved.positions ?? {}).length > 0;
}

// Mirror stacks the displays (mode-only; never overwrites saved positions).
// Converted from Chris's MIRROR constants on his 672-wide authoring stage.
export const MIRROR: Positions = {
  'oled-27': { left: 300 / 672, top: 70 / 230 },
  builtin: { left: 314 / 672, top: 78 / 230 },
  'treehouse-32': { left: 328 / 672, top: 86 / 230 },
};

// The clamshell laptop is not a display, so it has no saved position — it sits
// at a fixed offset from the monitor it feeds and travels with it.
export const SLAB_ANCHOR = 'treehouse-32';
export const SLAB_OFFSET: Frac = { left: (535 - 354) / 672, top: (133 - 64) / 248 };

/**
 * Where the clamshell laptop stands, given the desk it has to stand on.
 *
 * The fixed offset above is a relationship, not a coordinate: the Gaming Laptop
 * sits beside the monitor it feeds and travels with it (Cindy, 2026-07-29). What
 * was missing is what happens when a SCREEN already holds that spot. Every other
 * tile on this desk is spaced by a rule — `defaultsFor`, `completeLayout`,
 * `healOverlap`, all of them keyed on `visibleDisplays()` — and the slab was the
 * one box outside every one of them, because it has no saved position to heal.
 *
 * Measured 2026-09-03 (Cindy's screenshot, a hand-saved two-display row with the
 * Treehouse 32 on the LEFT): the slab landed on the Built-in Display — 780px² of
 * artwork, and the two captions written over each other.
 *
 * The relationship is kept and only the SIDE gives way. Three places, in order:
 *   1. the authored side — beside the anchor on its right, a little lower;
 *   2. the anchor's other side, the same gap and the same height;
 *   3. in front of the whole desk — below the lowest screen, centred on the
 *      anchor. The card grows for it (`--dov-need` in DeskWidget).
 * The first that is clear of every screen AND inside the stage wins, so a desk
 * that never collided keeps exactly the picture it had — verified for all six
 * default desks (1–3 screens × 1–2 computers) in verify-desk-card.mjs.
 *
 * Clear means clear of the caption too: each screen reserves `below` px under
 * its tile for its own name, and so does the slab. Two names touching is the
 * same defect as two pictures touching — it was half of what Cindy saw.
 */
export function slabPlacement(
  positions: Positions,
  size: (id: string) => { w: number; h: number },
  hw: number,
  vh: number,
  slab: { w: number; h: number },
  below: number,
  /** The end of the desk the PERSON chose in the `Arrange` window, if they did.
      When set it wins outright: the search below exists to keep the app's own
      guess off the artwork, and a guess does not get to overrule an answer
      (2026-09-10). Left unset, everything behaves exactly as before. */
  side: 'left' | 'right' | null = null,
): Frac {
  const anchor = positions[SLAB_ANCHOR] ?? DEFAULTS[SLAB_ANCHOR];
  // `vh` is load-bearing, not decoration: with a stage height `offsetFrom`
  // stands the computer ON the desk (2026-09-03 tower fix). Without it a 73px
  // tower hangs from the anchor's top and reaches 49px below the surface — the
  // exact bug the tower commit closed, which this resolver would otherwise
  // re-open on the path it controls.
  const authored = offsetFrom(anchor, SLAB_OFFSET, vh);
  if (!(hw > 0) || !(vh > 0)) return authored;

  const screens = visibleDisplays().map((d) => {
    const p = positions[d.id] ?? DEFAULTS[d.id];
    const s = size(d.id);
    return { l: p.left * hw, t: p.top * vh, r: p.left * hw + s.w, b: p.top * vh + s.h + below };
  });
  const clear = (l: number, t: number) =>
    l >= 0 &&
    l + slab.w <= hw &&
    screens.every((s) => l + slab.w <= s.l || l >= s.r || t + slab.h + below <= s.t || t >= s.b);

  const aw = size(SLAB_ANCHOR).w;
  const al = anchor.left * hw;
  const at = authored.top * vh;
  // The authored gap, measured from the anchor's edge — so the mirrored side is
  // the same distance away and not a second hand-typed number.
  const gap = SLAB_OFFSET.left * hw - aw;

  // Three places, all ON the desk — the computer stands, so every candidate
  // keeps the same floor-anchored top and only the sideways position moves.
  //
  // The third one used to put it IN FRONT of the screens, a row lower. That
  // answer belonged to the clamshell: a 24px slab could lie in front of a
  // monitor and still be on the desk. A 40cm tower cannot — a row below the
  // screens is a row below the desk surface (2026-09-04, Cindy: align it).
  // So the last resort is the far side of the whole desk instead: past the
  // rightmost screen, or before the leftmost, whichever the stage has room for.
  const right = Math.max(...screens.map((s) => s.r));
  const left = Math.min(...screens.map((s) => s.l));
  // A chosen side is an answer, not a candidate: it does not enter the search
  // and it is not dropped for being close to a screen. The desk picture lays
  // the row out itself, so standing at an end cannot collide the way the old
  // fixed offset could — that bug was about a spot BETWEEN screens.
  if (side === 'right') return { left: round((right + gap) / hw), top: round(at / vh) };
  if (side === 'left') return { left: round((left - gap - slab.w) / hw), top: round(at / vh) };

  const candidates: Array<[number, number]> = [
    [authored.left * hw, at],
    [al - gap - slab.w, at],
    [right + gap, at],
    [left - gap - slab.w, at],
  ];
  for (const [l, t] of candidates) if (clear(l, t)) return { left: round(l / hw), top: round(t / vh) };
  return authored;
}

/**
 * Click-vs-drag slop, in screen px. Shared by every surface that starts a drag
 * from a plain pointerdown+click (no HTML5 drag threshold of its own) — the
 * desk-map hero's click-to-open AND this hook's own click/drag split both read
 * it, so a press the click handler treats as "didn't move enough to drag" and
 * a press this hook treats as "moved enough to commit" can never disagree.
 */
export const CLICK_SLOP = 4;

const round = (n: number) => Math.round(n * 1e4) / 1e4;
const isFrac = (p: unknown): p is Frac =>
  !!p && Number.isFinite((p as Frac).left) && Number.isFinite((p as Frac).top);

/** CSS position for a fraction — percentages need no stage measurement. */
export const pct = (n: number) => `${(n * 100).toFixed(3)}%`;

// ── Rows: the part of a desk both lenses have to agree about ─────────────────
// A saved layout is coordinates, but what the two lenses must not disagree about
// is coarser than that: WHO IS BESIDE WHOM, and WHO IS ABOVE WHOM. Spacing is
// each surface's own business (the view spreads a desk out, the editor closes
// every gap — Cindy, 2026-08-03), so spacing is exactly the thing that cannot
// travel between them. Rows can, and until 2026-08-05 they did not: the editor
// wrote back a left-to-right permutation, which has no way to say "above", so a
// display dragged on top of another sprang back on release.

export interface IdRect { id: string; left: number; top: number; w: number; h: number }

/**
 * Two displays share a desk row when their vertical spans overlap by more than
 * half the shorter tile. Below that the pair reads as stacked rather than side
 * by side — the same judgement a person makes looking at the desk, and the
 * reason it is a ratio and not a pixel count: the two lenses draw the same desk
 * at very different tile sizes.
 */
export const SAME_ROW = 0.5;

export const sharesRow = (a: IdRect, b: IdRect) =>
  Math.min(a.top + a.h, b.top + b.h) - Math.max(a.top, b.top) > SAME_ROW * Math.min(a.h, b.h);

/**
 * Group displays into desk rows: top-to-bottom, each row left-to-right.
 *
 * Membership is transitive on purpose — a laptop can be low enough to share a
 * row with the 32" and high enough to share it with the 27" while those two do
 * not overlap each other at all, and that is one row of three, not two rows that
 * happen to collide. So a rect joining several rows MERGES them rather than
 * picking the first match.
 */
export function groupRows(rects: IdRect[]): IdRect[][] {
  const rows: IdRect[][] = [];
  for (const r of [...rects].sort((a, b) => a.top - b.top)) {
    const hits = rows.filter((g) => g.some((o) => sharesRow(r, o)));
    if (!hits.length) {
      rows.push([r]);
      continue;
    }
    hits[0].push(r);
    for (const g of hits.slice(1)) {
      hits[0].push(...g);
      rows.splice(rows.indexOf(g), 1);
    }
  }
  for (const g of rows) g.sort((a, b) => a.left - b.left);
  return rows.sort((a, b) => Math.min(...a.map((r) => r.top)) - Math.min(...b.map((r) => r.top)));
}

// ── Overlap limit — the shared data's own rule (restored 2026-08-29) ─────────
// A display may tuck up to a QUARTER of itself behind a neighbour: that is what
// two displays do on a real desk (one slightly in front of the other). Deeper
// than that on BOTH axes is a burial — hardware hidden, name unreadable.
//
// This is not a new rule. It is `MAX_OVERLAP` and the "buried on both axes"
// test from the hero's retired drag (`limitOverlap`, removed with the drag on
// 2026-08-21, recovered from `ea04ce5^`). What was lost in that removal is that
// NOTHING enforced it any more: the one writer left standing — the Personalize
// DESK card's free-placement drag — commits raw positions on purpose, and its
// own note said "if hardware or names do collide, that is the moment to add one
// back". The moment arrived 2026-08-28: a stored layout with one display buried
// in another was drawn verbatim by both view surfaces (Cindy's screenshots),
// while the Arrange editor healed only its own working copy — three pictures of
// one desk, all different. So the limit lives HERE now, on the shared layout's
// read and write paths, not inside any one surface's gesture.
export const MAX_OVERLAP = 0.25;

/**
 * Resolve every burial in a layout with the smallest moves that clear it.
 *
 * Works in the caller's own reference frame (`hw`/`vh` — the same numbers the
 * surface multiplies fractions by), because tiles are fixed px while positions
 * scale with the frame: whether a pair is buried is a question only a frame can
 * answer. Each surface heals what it is about to draw, so a bad layout already
 * in storage is corrected everywhere it appears — without rewriting the store
 * behind the user's back (the next real drag commits healed numbers anyway).
 *
 * Per pair, the correction undoes the burial on whichever axis asks for the
 * smaller move, pushing the display whose centre sits further along that axis —
 * so who-is-left-of-whom and who-is-above-whom survive, which is the shape the
 * two lenses promise to agree on (groupRows above). The pushed tile settles at
 * exactly the allowance: still tucked, no longer buried.
 */
export function healOverlap(
  positions: Positions,
  size: (id: string) => { w: number; h: number },
  hw: number,
  vh: number,
): Positions {
  if (!(hw > 0) || !(vh > 0)) return positions;
  const rects = visibleDisplays().map((d) => {
    const p = positions[d.id] ?? DEFAULTS[d.id];
    const s = size(d.id);
    return { id: d.id, l: p.left * hw, t: p.top * vh, w: s.w, h: s.h };
  });
  let moved = false;
  // A shift can open a new burial against a third display, so sweep until the
  // desk settles. Three displays settle in a pass or two; the cap is a rail.
  for (let pass = 0; pass < 8; pass++) {
    let dirty = false;
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const ox = Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l);
        const oy = Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t);
        const ax = MAX_OVERLAP * Math.min(a.w, b.w);
        const ay = MAX_OVERLAP * Math.min(a.h, b.h);
        if (!(ox > ax && oy > ay)) continue; // at most a quarter-tuck — legal
        if (ox - ax <= oy - ay) {
          const [lo, hi] = a.l + a.w / 2 <= b.l + b.w / 2 ? [a, b] : [b, a];
          hi.l = lo.l + lo.w - ax;
        } else {
          const [lo, hi] = a.t + a.h / 2 <= b.t + b.h / 2 ? [a, b] : [b, a];
          hi.t = lo.t + lo.h - ay;
        }
        dirty = true;
        moved = true;
      }
    if (!dirty) break;
  }
  if (!moved) return positions;
  const out: Positions = { ...positions };
  for (const r of rects) out[r.id] = { left: round(r.l / hw), top: round(r.t / vh) };
  return out;
}

/**
 * Stand a layout on the desk: the bottom row's bottoms on `FLOOR`, every other
 * row's bottoms on its own row line, rows kept at the distance they were saved at.
 *
 * Why this exists (2026-09-22/23, Cindy — the fifth time the desk pictures came
 * apart: "디자인 업뎃할 때마다 이러는거 … 애초에 원인을 없애"): a saved `top`
 * says how far a display hangs from the stage's ceiling. Each surface reads that
 * fraction against its own reference height and draws its own tile size, so the
 * same saved number lands at a different floor on each surface — and moves again
 * whenever a tile size changes. The computer never read it (`offsetFrom` stands
 * it on `FLOOR`), which is why it alone ended up below the screens after one
 * press of Extend (34px on the DESK card, 44px in the hero, measured).
 *
 * So the vertical position a surface DRAWS is not the saved one: only the saved
 * ROW structure survives (who is above whom, via `groupRows`), and the heights
 * are re-derived here from this surface's own tiles and floor. Horizontal is left
 * exactly as saved. A bottom anchor cannot drift, because there is no stored
 * height left to disagree about.
 */
export function standOnFloor(
  positions: Positions,
  size: (id: string) => { w: number; h: number },
  vh: number,
  /** Given, the row is also re-spaced at `DESK_GAP` in this surface's px — the
      same drift on the other axis (Cindy 2026-09-23 «간격은?»: after Extend the
      hero read the saved lefts with its own ruler, 135 vs 113px between
      neighbours). Only the ORDER is kept; each row keeps its leftmost edge and
      the group is centred by the surface anyway. Omitted by the Arrange window,
      which packs its own screen-lens row. */
  hw?: number,
): Positions {
  if (!(vh > 0)) return positions;
  const ids = visibleDisplays().map((d) => d.id);
  if (!ids.length) return positions;
  const rects: IdRect[] = ids.map((id) => {
    const p = positions[id] ?? DEFAULTS[id];
    const s = size(id);
    return { id, left: p.left, top: p.top * vh, w: s.w, h: s.h };
  });
  // A desk picture is a desk (2026-09-24, Cindy «응» — «이상하게 겹쳐», the
  // sixth time this month): everything stands on it, in ONE row. The Arrange
  // window reads the same saved numbers as SCREEN coordinates, where "below" and
  // "above" are ordinary layouts (a laptop in front of a monitor, a monitor set
  // above another in Display settings). Drawn as a desk they became rows in the
  // air — the 32" lifted over the 27" with its name across the 27"'s screen
  // (design-assets/desk-overlap-2026-09-24). So on a desk surface (`hw` given)
  // only the saved left-to-right ORDER crosses over (by centre, so a display
  // saved straight above another still gets a place) and the row is re-spaced
  // below. What this gives up: a monitor on an arm over another cannot be drawn.
  // The Arrange window omits `hw` and keeps its rows.
  const onDesk = !!hw && hw > 0;
  const rows = onDesk
    ? [[...rects].sort((a, b) => a.left * hw! + a.w / 2 - (b.left * hw! + b.w / 2))]
    : groupRows(rects);
  // Each row's own line = its lowest bottom; the bottom row's line becomes the desk.
  const lines = rows.map((row) => Math.max(...row.map((r) => r.top + r.h)));
  const shift = FLOOR * vh - lines[lines.length - 1];
  const out: Positions = { ...positions };
  rows.forEach((row, i) => {
    const line = lines[i] + shift;
    // Re-spaced only when the whole desk is ONE row. A stacked desk (a display on
    // an arm above another) already comes back designed from the Arrange window
    // (`projectRowsOntoView`: rows centred, designed side gap), and re-spacing its
    // rows one by one broke that centring and the cross-row order (caught by
    // verify-arrange-overlap on the first build).
    const respace = !!hw && hw > 0 && rows.length === 1;
    let x = respace ? Math.min(...row.map((r) => r.left)) * hw! : 0;
    for (const r of row) {
      const left = respace ? round(x / hw!) : positions[r.id]?.left ?? r.left;
      out[r.id] = { left, top: round((line - r.h) / vh) };
      x += r.w + DESK_GAP;
    }
  });
  return out;
}

/**
 * Where a surface draws its desk (2026-09-23): the span the hardware covers, in
 * the surface's authored px, plus the floor as a fraction of its reference height.
 * One helper so the hero and the DESK card light the same stretch of desk.
 */
export const DESK_FLOOR = FLOOR;
export function deskSpan(
  positions: Positions,
  size: (id: string) => { w: number; h: number },
  hw: number,
  extra?: { left: number; w: number },
): { left: number; width: number } | null {
  if (!(hw > 0)) return null;
  const xs = visibleDisplays().map((d) => {
    const p = positions[d.id] ?? DEFAULTS[d.id];
    return [p.left * hw, p.left * hw + size(d.id).w];
  });
  if (extra) xs.push([extra.left, extra.left + extra.w]);
  if (!xs.length) return null;
  const l = Math.min(...xs.map((x) => x[0]));
  const r = Math.max(...xs.map((x) => x[1]));
  return { left: l, width: r - l };
}

/**
 * Gap between two STACKED displays on the view lens, off the ramp.
 *
 * ⚠️ This number is a COMPROMISE and the reason is worth knowing before changing
 * it. Physically it wants to be tiny: the 32" draws at TILE_REF for 71.5cm, so
 * 1px ≈ 0.54cm, and two screens on an arm sit about 2cm apart — `--gutter-xxs`
 * (4px ≈ 2.2cm). That was the first value here, and it was measured failing on
 * 2026-08-05: every tile carries its NAME below it, so a 4px gap put the upper
 * display's caption across the lower display's screen.
 *
 * So the gap has to clear the caption, which makes it `--gutter` (24px) — the same
 * step the name row itself reserves. The cost is that a stacked pair is drawn
 * further apart than it would sit in the room.
 *
 * The better fix is a design decision, not a number: put the caption ON the tile
 * (`.ds-tag.overlay` is a DS class for labels that sit on images, which is what
 * this already uses) instead of below it, and the physical gap comes back. That
 * changes how the one-row desk looks too, so it is Cindy's call — pending.
 *
 * Side-to-side spacing needs no token at all: it stays whatever the user dragged.
 */
/**
 * The gap between two displays stacked on an arm — the ARM's gap, not a layout
 * one. On a real dual-arm the two chassis clear each other by about 2cm, which
 * on this map's scale (a 32" is 132px ≈ 71cm) is under 4px.
 *
 * It used to be `--gutter` (24px ≈ 13cm), and that number was never about the
 * hardware: it was the room the upper display's NAME needed, because the caption
 * hung below its tile. The map was therefore drawing a mount nobody sells to
 * make space for a label. With the name moved onto the render (2026-08-06,
 * `.dsa-name` in display-arrange.css) that debt is gone and the gap can be the
 * real one. Still a token, one step off the ramp — the closest rung to 2cm.
 */
export const ROW_GAP_TOKEN = '--gutter-xxs';

/**
 * Where the desk has to move to sit in the middle of its stage, in SAVED
 * coordinate space (stage px). Returns null if the stage cannot be measured.
 *
 * ONE definition of "centred", used by every caller that needs it: the view
 * lens's paint-time offset, its commit-time normalisation, and the editor's
 * write-back. They used to be two definitions inside DisplayArrange — the effect
 * measured `.dsa-bounds` while the commit measured `.dsa-disp` (the caption makes
 * that box wider), and the commit skipped subtracting the painted transform. So a
 * committed layout was centred by one rule and re-centred by the other, which is
 * how a saved position drifted OUTSIDE the stage — measured 2026-08-04:
 * `oled-27` saved at left −0.108, i.e. 79px past the left wall. That is invisible
 * on the view lens (the offset hides it) and NOT invisible on the Perform Device
 * Overview map, which draws the same saved layout with no offset at all.
 *
 * Computed from the COORDINATES, not from measured rects. Callers run at a moment
 * when the DOM disagrees with the data: `.dsa-disp` carries a 0.25s left/top
 * transition, so a layout-effect reading `getBoundingClientRect()` right after a
 * commit gets the tile's OLD position and centres the desk to a picture that no
 * longer exists (measured 2026-08-04: the group settled 146px off, 214/−78
 * margins, and never corrected because nothing re-triggered the effect). The tile
 * box is exactly `photoTile()` — `.dsa-bounds` is sized from it inline — so the
 * data is not an approximation of the render, it IS it.
 *
 * Measuring the HARDWARE and not the caption is deliberate (Cindy, 2026-08-03):
 * `.dsa-disp` is a centred column as wide as max(tile, name row), so centring off
 * it shifted the whole desk sideways the moment a different monitor was selected
 * and its label changed width. Using photoTile() keeps that property by
 * construction — the caption cannot enter the maths at all.
 */
export function deskOffset(
  stage: HTMLElement,
  positions: Positions,
  scale = 1,
  size: (id: string) => { w: number; h: number } = photoTile,
  vRef?: number,
  extra?: DeskExtra,
  hRef?: number,
  aura?: { top: number; side: number; bottom: number },
): { x: number; y: number } | null {
  const b = deskBounds(stage, positions, size, vRef, extra, hRef);
  if (!b) return null;
  // An aura is not symmetric — the under-glow falls BELOW the hardware, because
  // the strip is on the back and its light lands on the desk. Centring the
  // hardware box would therefore leave the picture bottom-heavy: the same gap
  // above and below the chassis, with the whole pool spilling out of the lower
  // one. Centring the extent instead lifts the hardware by half the difference,
  // which is what the eye reads as centred once the light is on. Sideways the
  // aura is equal on both sides, so it cancels and `x` is untouched.
  const lift = aura ? (scale * (aura.top - Math.max(aura.bottom, 0))) / 2 : 0;
  return {
    x: (b.sr.width - scale * (b.maxR - b.minL)) / 2 - scale * b.minL,
    y: (b.sr.height - scale * (b.maxB - b.minT)) / 2 - scale * b.minT + lift,
  };
}

/** The desk's box in saved coordinate space (stage px), or null if unmeasurable.
    `size` is the asking surface's own tile sizing — the photoreal lens and the
    schematic map draw the same layout at different sizes, so the box differs. */
/** A box that belongs to the desk picture but is not a display — today only the
    clamshell slab on the Personalize DESK card. Given in the same stage-px,
    pre-scale space the loop below builds, so it can simply widen the bounds. */
export type DeskExtra = { left: number; top: number; w: number; h: number };

function deskBounds(
  stage: HTMLElement,
  positions: Positions,
  size: (id: string) => { w: number; h: number },
  vRef?: number,
  extra?: DeskExtra,
  hRef?: number,
) {
  const sr = stage.getBoundingClientRect();
  if (sr.width <= 0 || sr.height <= 0) return null;
  // Either axis may be read against a FIXED reference rather than the live stage
  // — see `vRef`/`hRef` on fitScale. Both default to the stage, which is what
  // every surface did before the references existed.
  const vh = vRef && vRef > 0 ? vRef : sr.height;
  const hw = hRef && hRef > 0 ? hRef : sr.width;
  let minL = Infinity;
  let maxR = -Infinity;
  let minT = Infinity;
  let maxB = -Infinity;
  for (const d of visibleDisplays()) {
    const p = positions[d.id] ?? DEFAULTS[d.id];
    const s = size(d.id);
    const l = p.left * hw;
    const t = p.top * vh;
    minL = Math.min(minL, l);
    maxR = Math.max(maxR, l + s.w);
    minT = Math.min(minT, t);
    maxB = Math.max(maxB, t + s.h);
  }
  // Anything drawn on the desk that isn't a display still takes room. Leaving it
  // out is how the second computer ran 54px past the right edge of the 672px stage
  // and was clipped (measured 2026-08-18; the retired Perform map had the same
  // gap, logged 2026-08-11). Optional so the modal hero, which draws displays
  // only, keeps its exact previous numbers.
  if (extra) {
    minL = Math.min(minL, extra.left);
    maxR = Math.max(maxR, extra.left + extra.w);
    minT = Math.min(minT, extra.top);
    maxB = Math.max(maxB, extra.top + extra.h);
  }
  return { sr, minL, maxR, minT, maxB };
}

/**
 * How much the view lens has to shrink the whole desk to fit its band — the
 * second rung of the responsive ladder (Cindy, 2026-08-05: "밴드를 키우는 게
 * 디폴트고, 창이 위아래로 폭이 작았을 때 A로 가는 게 맞다").
 *
 * Rung one is the band itself, which already tracks the window height up to its
 * ceiling (`--mc-hero-h`). That ceiling was raised for a stacked desk, but the
 * clamp's middle term is the window, so on a 950px-tall window the band is still
 * 298px and a two-row desk needs ~256px of a 210px stage. Measured 2026-08-05
 * before this existed: the upper display's caption sat on the lower display's
 * screen and the lower caption was cut off by the band.
 *
 * ONE factor for the whole group, not per tile: the map's whole claim is that a
 * 32" is wider than a 27" and a laptop is half of one, and a uniform zoom keeps
 * every one of those ratios — including the gaps the user set. A per-row or
 * per-tile fudge would not.
 *
 * `vRef` — read vertical positions against this fixed height instead of the live
 * stage. A surface that can STACK needs it: tops are stored as fractions of the
 * stage, so shortening the band pulls the rows toward each other while the tiles
 * keep their pixel size, and the desk quietly compresses until an upper display
 * sits inside a lower one (measured 2026-08-06 at an 800px window: a 21px bite,
 * with this function returning 1.0 because it was handed the already-squashed
 * layout). Against a fixed reference the arm gap is a real distance at every
 * window size, and shrinking is this function's job alone.
 *
 * `hRef` — the horizontal twin of `vRef`, and the reason it now exists: the
 * modal hero's desk box used to BE the arrangement's coordinate space, so
 * widening that box (2026-08-18, to stop the desk sitting in a 780px island
 * inside a 960px panel) would have spread the desk instead of enlarging it.
 * Lefts are fractions, tiles are fixed px, so a wider stage pushes the displays
 * apart while each one stays the same size — three products drifting apart, not
 * a desk. Against a fixed reference the arrangement keeps its shape and the
 * extra width becomes room for the zoom below, which is the one place growing
 * belongs (the same division of labour `vRef` already set up).
 *
 * `max` — how far the desk may be zoomed UP, default 1. Until 2026-08-18 the 1
 * was written into the formula, so this function could only ever shrink: a band
 * with room to spare left the desk at its authored size and the hero read as a
 * small picture in a large empty frame (Cindy: "지금 화면은 위아래 공간이 많이
 * 있는데 왜 이렇게 이미지가 작은 거야?"). Growing is the same operation as
 * shrinking — one factor for the whole group — so the rule is symmetric now:
 * the desk takes the band, and whichever axis runs out first decides. `max` is
 * a rail against a huge window zooming the renders past what they can carry,
 * not the number that normally binds; when it is the one binding, the band has
 * more room than the desk knows what to do with.
 *
 * `aura` — room to leave OUTSIDE the tile boxes, for what a display draws that
 * is not hardware. Today that is the under-glow, whose whole nature is to have
 * no edge: the tile box ends at the chassis, the light does not, and a fit that
 * only measured chassis let the lamp run into the stage and stop in a straight
 * line at full brightness (Cindy, 2026-08-18). The numbers come from the CSS
 * that draws it (`--dsa-glow-lift` / `--dsa-glow-spread` on `.dsa-stage`), read
 * off the live element like every other token here, so the light is described
 * in one place and the layout follows it.
 *
 * Returns 1 whenever the desk already fits at natural size AND `max` is 1, so
 * every surface that has not opted in is untouched and nothing can regress.
 */
export function fitScale(
  stage: HTMLElement,
  positions: Positions,
  size: (id: string) => { w: number; h: number } = photoTile,
  below?: number,
  vRef?: number,
  extra?: DeskExtra,
  hRef?: number,
  max = 1,
  aura?: { top: number; side: number; bottom: number },
): number {
  const b = deskBounds(stage, positions, size, vRef, extra, hRef);
  if (!b) return 1;
  const pad = tokenPx(stage, STAGE_INSET_TOKEN, 16);
  // Whatever each surface draws BELOW the tile box its `size` reports — at minimum
  // the caption, which is the thing that was measured being clipped. Surfaces that
  // draw more than a caption (a stand, say) pass their own number: getting this
  // wrong shows up as the bottom row's name cut off, which is exactly what the
  // Perform map did on 2026-08-05 when it reserved only the caption.
  const nameRow = below ?? tokenPx(stage, NAME_GUTTER_TOKEN, 24);
  const bH = b.maxB - b.minT;
  const bW = b.maxR - b.minL;
  // What the desk draws OUTSIDE its own box and still needs room for — today
  // the under-glow, which is a light and therefore has no edge of its own (see
  // `--dsa-glow-*` on `.dsa-stage`). Reserved on every surface that passes it,
  // lit or not: the size of the desk must not change when someone turns the
  // lamp on, or the whole picture jumps at the moment the user is looking at
  // the thing they just switched.
  // Below and beside the hardware the two claims are on the same band, so the
  // deeper one wins rather than the two stacking — the caption sits inside the
  // pool, which is where it sat before anything was reserved at all.
  const vBelow = Math.max(nameRow, aura?.bottom ?? 0);

  // Solved for the layout AS PAINTED, which is centred — not just "does the desk
  // fit somewhere in the stage". Centring puts the tile box's bottom at
  // (H + bH·s)/2, and the caption hangs `below·s` under that, so the binding
  // constraint is bH·s/2 + below·s ≤ H/2 − pad. Fitting the loose way instead
  // returned exactly 1.0 for a two-row Perform map and the bottom name was still
  // cut off (measured 2026-08-05) — the desk fitted, the centred desk did not.
  // With an aura the desk is centred on its FULL extent — light included — not
  // on the hardware box (`deskOffset` does the matching shift), so what has to
  // fit is simply top + hardware + bottom. Solving it the centred-on-the-box way
  // instead charges the deeper side to BOTH halves: measured 2026-08-18, a 46px
  // pool under a 98px desk in a 242px band came out at 1.10 when 1.33 fits with
  // room to spare, i.e. the desk paid twice for a light that only falls once.
  if (aura) {
    return Math.max(
      0.4,
      Math.min(
        max,
        (b.sr.height - 2 * pad) / (aura.top + bH + vBelow),
        (b.sr.width - 2 * pad) / (bW + 2 * aura.side),
      ),
    );
  }
  const byHeight = (b.sr.height / 2 - pad) / (bH / 2 + vBelow);
  const byWidth = (b.sr.width - 2 * pad) / bW;
  return Math.max(0.4, Math.min(max, byHeight, byWidth));
}

/** Saved layout → usable state, discarding pre-fraction (pixel) payloads. */
export function readArrangement(saved: ArrangeState | null): {
  mode: 'extend' | 'mirror';
  positions: Positions;
} {
  if (!saved || saved.space !== 'fraction') return { mode: saved?.mode ?? 'extend', positions: DEFAULTS };
  // Keep only well-formed entries: a display whose saved pair is incomplete or
  // non-finite falls back to its default rather than rendering nowhere.
  const clean: Positions = { ...DEFAULTS };
  const fromSaved = new Set<string>();
  for (const [id, p] of Object.entries(saved.positions ?? {})) {
    if (!isFrac(p)) continue;
    clean[id] = p;
    fromSaved.add(id);
  }
  // A display attached AFTER this layout was saved has no entry here, so the
  // line above leaves it on its `DEFAULTS` slot — a slot authored for a
  // three-display desk that knows nothing about where the saved displays ended
  // up. Measured 2026-09-02: with a two-display layout saved and a third
  // attached, `oled-27` took its default 24/672 = .0357 while the saved
  // `builtin` sat at .0328, so the two stood 2px apart — the hero drew them
  // OVERLAPPING BY 77px while the Arrange window's packing quietly butted them
  // apart, which is the "hero doesn't match Arrange" Cindy reported.
  // `completeLayout` gives the newcomer a place derived from the saved desk
  // instead, and both lenses read this one result.
  return { mode: saved.mode, positions: completeLayout(clean, fromSaved) };
}

export function offsetFrom(pos: Frac | undefined, offset: Frac, stageH?: number): Frac {
  const base = pos ?? DEFAULTS[SLAB_ANCHOR];
  // Sideways it rides beside the monitor it feeds. Vertically it STANDS ON THE
  // DESK, like every display does (SPEC: desk-stage rule 1) — it does not hang
  // from the anchor's top.
  //
  // That distinction did not matter while this was a 24px clamshell: the old
  // `top` offset put a flat slab near the floor by construction. A 73px tower
  // with the same offset reaches 49px BELOW the desk surface, which grew the
  // card past its authored height (caught 2026-09-03 by the one-row check, not
  // by eye). Given the stage height, the floor decides the top; without it the
  // authored offset is the fallback, so callers that cannot measure behave as
  // they always did.
  const top =
    stageH && stageH > 0
      ? (FLOOR * stageH - towerTile().h) / stageH
      : base.top + offset.top;
  return { left: base.left + offset.left, top };
}

/**
 * Pointer-drag for one tile, in fraction space. Shared by the modal hero and
 * the Perform map so both surfaces move a display exactly the same way.
 */
export function useArrangeDrag(opts: {
  stageRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
  getPositions: () => Positions;
  onMove: (next: Positions) => void;
  onCommit: (next: Positions) => void;
  /** Pointer released without ever moving — i.e. a click, not a drag. Surfaces
      use this to drop their live copy without writing anything. */
  onCancel?: () => void;
  /** Tile bounds override — photoreal tiles are sized per display, not per
      kind. Defaults to the schematic TILE_W/TILE_H so the Perform map, which
      still draws schematic tiles, is unaffected. */
  getSize?: (id: string, kind: string) => { w: number; h: number };
  /** Adjust the free-dragged position before it is committed, in stage px.
      The precise editor uses this to pull edges flush; surfaces without it
      drag freely, exactly as before. */
  snap?: (id: string, cand: { left: number; top: number }, size: { w: number; h: number }) => { left: number; top: number };
  /**
   * Screen shift applied to the whole group AFTER these positions are read, in
   * stage px. The modal hero paints its desk through a re-centring transform on
   * `.dsa-group`, so a tile's SAVED left and its DRAWN left differ by that
   * offset — and a clamp that only knows the saved one is wrong by exactly the
   * offset at both ends (measured 2026-08-04: +94px, so the tile stopped 94px
   * short of the left wall and was cut off 94px past the right one, which is
   * the asymmetry Cindy hit). Surfaces that draw positions straight, like the
   * Perform map, leave it out and clamp exactly as before.
   */
  clampOffset?: { x: number; y: number };
  /**
   * Uniform zoom the surface paints the group through, if any (see fitScale).
   * Defaults to 1, so surfaces that draw at natural size are unaffected.
   *
   * Without this a scaled surface drags wrong by exactly the factor: the pointer
   * moves screen px, positions are stored in unscaled stage px, and the walls the
   * user can see are the stage's. So screen deltas are divided by the zoom and
   * the clamp is expressed in position space — which also means the group's
   * translate cancels out of the maths, the same way it already did at zoom 1.
   */
  scale?: number;
  /**
   * What this surface draws BELOW a tile's own box — the caption row, normally.
   * Defaults to NAME_GUTTER_TOKEN, which is what every surface needed while
   * captions hung under their tiles. A surface that puts the label ON the render
   * passes 0, and gets that row back as draggable floor.
   */
  below?: number;
  /**
   * How much taller than its stage the DESK may be, as a multiple of the stage.
   * Defaults to 1 — the desk lives inside the walls, which is the rule for every
   * surface that draws at natural size.
   *
   * Above 1 it lets a drag build a desk that does not fit yet, which is the only
   * way a stacked desk can ever be made (Cindy, 2026-08-06: "Treehouse 밑으로
   * 가져가고 싶어도 아예 못 가게 막혔거든"). The old clamp was a chicken-and-egg:
   * the ceiling was the stage, a second row needs more than the stage, and
   * `fitScale` only shrinks a desk that is ALREADY two rows — so the drop that
   * would have created one was refused, the tile slid sideways instead, and it
   * landed in the pile-up. Positions are fractions of the stage, so a top past
   * 1.0 is representable; the surface re-fits on commit and the desk zooms out
   * to hold what was just built.
   */
  vGrow?: number;
  /** Fixed height that vertical positions are fractions of, if this surface uses
      one — see `vRef` on fitScale. Defaults to the live stage. */
  vRef?: number;
  /** Fixed width that horizontal positions are fractions of — the twin of
      `vRef`, and it has to be passed wherever that one is: the drag reads a
      saved fraction to find the tile under the pointer and writes one back on
      every move, so a drag measuring against the live stage while the paint
      measures against the reference would jump on the first move by exactly the
      difference. Defaults to the live stage. */
  hRef?: number;
}) {
  const { stageRef, enabled, getPositions, onMove, onCommit, onCancel, getSize, snap, clampOffset } = opts;
  const scale = opts.scale ?? 1;
  const vGrow = Math.max(1, opts.vGrow ?? 1);

  return useCallback(
    (e: React.PointerEvent, id: string, kind: string) => {
      if (!enabled) return;
      const stage = stageRef.current;
      if (!stage) return;
      const sr = stage.getBoundingClientRect();
      // A collapsed stage (hidden panel, zero-width window) would divide by zero
      // and persist NaN over a good layout — don't start a drag we can't measure.
      if (sr.width <= 0 || sr.height <= 0) return;
      const { w, h } = getSize ? getSize(id, kind) : { w: TILE_W[kind], h: TILE_H[kind] };
      // The height a saved `top` is a fraction OF. Same value the surface paints
      // with, so the tile does not jump under the pointer on the first move.
      const vh = opts.vRef && opts.vRef > 0 ? opts.vRef : sr.height;
      // The width a saved `left` is a fraction OF, same rule as `vh` above.
      const hw = opts.hRef && opts.hRef > 0 ? opts.hRef : sr.width;
      const start = getPositions()[id] ?? DEFAULTS[id];
      const dx = e.clientX - (sr.left + start.left * hw * scale);
      const dy = e.clientY - (sr.top + start.top * vh * scale);
      (e.target as Element).setPointerCapture(e.pointerId);

      let latest = getPositions();
      // A press that stayed within CLICK_SLOP of its start is a CLICK, and a
      // click must not write the layout. The bug this guards against (Cindy,
      // 2026-08-03): "moved at all" — even the sub-pixel jitter a real mouse
      // click always has — used to count as a drag, so opening another
      // display's settings quietly re-saved that tile a few px off its saved
      // spot EVERY time, and repeated navigation walked the desk out of place.
      // Same threshold as the click handler's own hit-test (DisplayArrange's
      // onTileClick / CLICK_SLOP) so the two can't rule the same press a
      // "drag" and a "click" at once.
      let moved = false;
      const move = (ev: PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > CLICK_SLOP) moved = true;
        if (!moved) return;
        // Clamp in DRAWN space, then convert back: the walls the user can see
        // are the stage's, and the tile is painted at position + offset. The
        // inset keeps the tile's glow off the clipping edge.
        const ox = clampOffset?.x ?? 0;
        const oy = clampOffset?.y ?? 0;
        const pad = tokenPx(stage, STAGE_INSET_TOKEN, 16);
        const nameRow = opts.below ?? tokenPx(stage, NAME_GUTTER_TOKEN, 24);
        // The floor a drag may reach. `vGrow` of 1 is the stage itself; above it
        // the desk is allowed to grow downward and the surface's re-fit pays for
        // it. Only the floor moves — the ceiling stays the stage's own inset, so
        // a desk can never be dragged out of the top of the band.
        const floor = vh * vGrow;
        // Walls in POSITION space: a tile is painted at `offset + scale * position`
        // and is `scale * w` wide, so the screen inset `pad` is `pad / scale` of
        // position, and the far wall is the stage width less the same.
        let left = Math.max(
          (pad - ox) / scale,
          Math.min((sr.width - pad - ox) / scale - w, (ev.clientX - sr.left - dx) / scale),
        );
        let top = Math.max(
          (pad - oy) / scale,
          Math.min((floor - nameRow - pad - oy) / scale - h, (ev.clientY - sr.top - dy) / scale),
        );
        if (snap) ({ left, top } = snap(id, { left, top }, { w, h }));
        latest = { ...latest, [id]: { left: round(left / hw), top: round(top / vh) } };
        onMove(latest);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (moved) onCommit(latest);
        else onCancel?.();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [stageRef, enabled, getPositions, onMove, onCommit, onCancel, getSize, snap, clampOffset, scale, opts.below, vGrow, opts.vRef, opts.hRef],
  );
}
