// ══════════════════════════════════════════════════════════════════════════
// The monitor's mode, hoisted out of the Overview tab (2026-08-07, Cindy).
//
// A mode is the monitor's saved unit and it spans the whole modal — picture
// settings on Display, EQ on Audio, under-glow on Overview (the confirmed scope
// is `design-assets/profile-proposal-2026-07.md`, "What a mode remembers"). It
// was living as one card inside one tab, which is why the save receipt had
// nowhere to go: a receipt in the UNDER-GLOW card cannot report a save made on
// the Display tab. So mode moved above the tab strip and its state moved here,
// where both the bar (rendered by MonitorCanvas) and the tab bodies can read it.
//
// Two decisions are encoded below rather than in the UI:
//   · '' is a real value — nobody has picked a mode yet. The list used to
//     resolve '' to modes[0], so a fresh install claimed "you are in Game" and
//     lit the desk orange on a choice the user never made. Unselected is
//     one-way: once a mode is picked there is no going back to "none", because
//     an un-pick would need a fourth place to store settings.
//   · The receipt says WHICH mode it saved to. "Saved" alone reads as global,
//     and the whole point of the model is that the save is per mode.
//
// Not here: the Smart Actions suggestion face of the status row ("Rocket League
// detected — switch to Game?"). It is designed (ia-section5.md, 탭 위 상주층)
// but nothing in this app detects an app launch, so wiring a branch no producer
// can reach would be a dead control (wired-state audit). It lands with its
// trigger, not before.
// ══════════════════════════════════════════════════════════════════════════
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_AUDIO_EQ,
  DEFAULT_DISPLAY_PICTURE,
  DEFAULT_VIEWING_MODE,
  useSettings,
  type DisplayPictureState,
} from '../../state/Settings';
import type { Features } from '../skus';

/**
 * What each mode sets the lamp to, until the user picks something else in that
 * mode. Straight from the 2026-07-21 colour research (verifier-log):
 *   Game   — a WARM hue. Orange rather than red: red is graded 🟡 with a
 *            documented catch (over-arousal hurting long competitive sessions),
 *            so red stays an option but is not the default.
 *   Work   — COOL white. Cool reads as alert, not relaxed, which is the point.
 *   Create — NEUTRAL white, and the only mode that takes the choice away.
 */
export const MODE_GLOW: Record<string, string> = {
  Game: '#ff6b2b',
  Work: '#e0f8fa',
  Create: '#efefef',
};

/**
 * One retired swatch value, mapped forward. Work's cool white was #e8f1fb for a
 * day (2026-08-05→06) before it was retinted, and a colour is persisted per mode
 * — so a browser that used Work in that window has the dead hex saved. Without
 * this, that user opens Work and no swatch is ringed: the control reads as
 * broken at exactly the spot we just fixed for looking broken. Remapping beats
 * clearing, because the saved value was a real pick and this is the same
 * intention at a visible tint.
 */
const RETIRED_GLOW: Record<string, string> = { '#e8f1fb': '#e0f8fa' };
export const migrateGlowColor = (hex: string) => RETIRED_GLOW[hex.toLowerCase()] ?? hex;

/**
 * Modes that hold the lamp themselves. Create is 🟢 in the research — the one
 * grade that came back without a caveat: coloured light shifts how the eye
 * judges colour, so a colour-accurate session cannot have a red lamp washing the
 * wall behind the screen. This is the only place the product takes a control
 * away rather than just presetting it, so the reason is printed on screen
 * instead of the swatches going quietly dead.
 */
export const MODES_LOCKING_GLOW = ['Create'];

/**
 * Level per mode, where there is a reason for one. Only Create has a number
 * here, and the number is not ours: bias lighting — which is what a neutral
 * glow behind a colour-critical screen IS — is specified at no more than 10% of
 * the display's peak brightness (SMPTE RP; the HDR figure is ~5 cd/m² at the
 * display surface). Above that the surround stops being a reference and starts
 * lifting the black level you are grading against, which is the same failure
 * the colour lock exists to prevent — so pinning the colour and leaving the
 * level wide open only did half the job.
 *
 * The honest caveat, and it is the same one that got "White (D65)" renamed to
 * "White": this slider is 0–100 of a strip, not cd/m². 10 here is the standard's
 * ratio borrowed as a design analogue, not a measured match — we cannot promise
 * the hardware lands on 10% of anything.
 *
 * Game and Work get no entry. The 2026-07-21 colour research (verifier-log)
 * settled hue for all three modes and says nothing about level, and inventing
 * two numbers to make the table look symmetrical is how unfounded values get
 * into a product.
 */
export const MODE_GLOW_LEVEL: Record<string, number> = { Create: 10 };

/** Where a mode with no level of its own lands — the store's own opening value
    for the strip (`SCHEMA.underGlow`, 70). Kept as a named constant so the
    fallback in applyGlow reads as "the resting brightness" rather than as a
    number someone chose here; if the store's default moves, this moves with it
    and nothing else has to be found. */
export const GLOW_LEVEL_DEFAULT = 70;

/**
 * Modes an automatic switch can land you in without asking. Straight from the
 * mode proposal's switching model: Game is Zone 1 (a game launching is an
 * unambiguous signal, so it just happens) and Work is the resting state it
 * returns to. Create is deliberately NOT here — its signal is ambiguous, so it
 * arrives as a suggestion the user confirms, and a marker promising "this one
 * happens by itself" would be a promise the product does not keep.
 *
 * A preset of the user's own is never in this list: there is no launcher to
 * detect for it. That is the whole job of the marker — to answer "why didn't
 * mine switch?" before it is asked.
 */
export const MODES_AUTO_SWITCHED = ['Game', 'Work'];

/**
 * How many presets of the user's own the bar will hold.
 *
 * Not a policy number — a measured one (2026-08-07). The pill is 910px inside,
 * and its options divide that width: three built-in modes plus three presets
 * plus "Add new" is seven options at 130px each, and the longest name we have
 * ("Night Reading") needs 127px to render without truncating. A fourth preset
 * puts every option under that line, so the cap is where the row stops being
 * readable, not where we decided people should stop.
 *
 * Revisit when the bar stops being the only place presets are listed — the
 * Utilities list can hold more than the bar can show. The keyboard's Lights tab
 * has no cap for exactly that reason: its presets live in a scrolling grid.
 */
export const MAX_CUSTOM_PRESETS = 3;

/**
 * What the status row is saying right now. Both faces expire on their own.
 *
 * The row's rule (2026-08-07, Cindy: "정말 필요할 때만 텍스트"): it speaks only
 * for INVISIBLE events. A save writes storage the eye cannot see — receipt.
 * A reset clears storage the eye cannot see — receipt. A manual mode switch is
 * not here at all: the ring moving IS the feedback, and announcing it again was
 * a second voice for a visible fact. (An AUTOMATIC switch is invisible in the
 * user's own terms — nobody acted — but that face arrives with its detector,
 * see the header note.)
 */
export type ModeNotice = {
  kind: 'saved' | 'reset' | 'limit';
  mode: string;
  /**
   * What exactly got filed, when a bare `Saved to Work` would over-promise
   * (2026-08-21, consultant pass). The layout save needs it: this card writes
   * FOUR values and only the layout is mode-scoped, so the receipt has to name
   * which one the mode just learned — otherwise the next mode switch, which
   * restores the split but not the source or the speakers, reads as a bug.
   * Omitted where the receipt already covers everything that was written.
   */
  scope?: string;
} | null;

/**
 * The one question the bar asks: "store this layout against this mode?"
 *
 * Not a `ModeNotice`. A notice expires on a timer (NOTICE_MS) because nobody is
 * waiting on it; this one waits for an answer, so a timeout would answer for the
 * user — the exact move the confirmed-save class exists to prevent. It also has
 * to outrank a receipt when both are true, which is the priority the IA already
 * set for the suggestion face: 제안이 영수증을 이긴다 (ia-section5.md).
 */
export type LayoutAsk = { layout: string; mode: string } | null;

/** How long a receipt stays before it fades, in ms.
 *
 * A convention, not a measurement — said so out loud when it was proposed
 * (2026-08-07). Long enough to read four words, short enough that it is gone
 * before it becomes furniture. Revisit against the real screen. */
const NOTICE_MS = 3000;

export interface MonitorModeState {
  /** Which monitor this window is — the picture store is keyed by it. */
  skuId: string;
  /** Built-in modes for this SKU, then the user's own. */
  modes: string[];
  builtIn: string[];
  /** '' = nobody has picked yet. */
  mode: string;
  select: (m: string) => void;
  addPreset: (name: string) => void;
  renamePreset: (from: string, to: string) => void;
  duplicatePreset: (name: string) => void;
  deletePreset: (name: string) => void;
  /** False once the bar is full — see MAX_CUSTOM_PRESETS. */
  canAddPreset: boolean;
  /** Say why "Add new" did nothing, and where to go instead. */
  noticeLimit: () => void;
  /** Per-mode version of `dirty`, for the Utilities list. */
  isDirty: (m: string) => boolean;
  /** Call after writing anything that is stored against the current mode. */
  markSaved: () => void;
  /** Does the current mode hold changes of the user's own? Gates Reset. */
  dirty: boolean;
  /** Defaults to the current mode. */
  resetMode: (m?: string) => void;
  notice: ModeNotice;
  /** True while the app may move the mode on its own — drives the chip marker. */
  autoSwitch: boolean;
  /**
   * The Audio tab's EQ preset. Mode-scoped and restored QUIETLY — no question,
   * unlike the layout. Our own table says so: `profile-proposal-2026-07.md`
   * puts "Audio EQ / output mode" on the mode side and "Volume & mute" on the
   * device side, because "a mode switch must never jolt loudness". A curve is
   * not loudness.
   */
  eq: string;
  setEq: (v: string) => void;
  /** Full Screen / PBP / PIP — what the screen is doing right now. */
  layout: string;
  /** Show it at once; ask about remembering it separately (see `layoutAsk`). */
  setLayout: (v: string) => void;
  /** Pending "save this layout to this mode?" — null when there is nothing to ask. */
  layoutAsk: LayoutAsk;
  /** Yes: file the layout under the mode, and say so. */
  saveLayout: () => void;
  /** No: drop the question. The screen keeps the layout; the mode does not. */
  dismissLayout: () => void;
  /**
   * What a mode is holding, for a list that wants to SHOW it rather than make
   * you enter the mode to find out (2026-08-20). Both read the same resolution
   * `applyGlow` / `applyLayout` use, from here rather than in the bar: a second
   * copy of "which colour does Create get" in a different file is the kind of
   * drift that ends with a swatch and a lamp disagreeing.
   *
   * `glowFor` returns null when the mode has no colour to show — a custom preset
   * before its first change. A dot drawn for that would be inventing a value.
   * `layoutFor` returns null unless the mode actually REMEMBERS a layout, so the
   * common case (everything on Full Screen) stays unmarked and the one mode that
   * splits the screen is the one that carries a glyph.
   *
   * `glowFor`'s caller arrived on 2026-08-21 — the `Remembers` fold in
   * `ModesPresetsSection` — and it prints the value as TEXT, not as a dot. The
   * 2026-08-20 finding still stands and is the reason: a coloured circle is
   * `.ds-swatch` in this library, a picker button, so a read-only one collides
   * with it and no read-only colour indicator exists yet (rule 11 → Chris's
   * queue). When that part lands, the fold's hex can become the dot; nothing
   * else has to move, because the resolution rule already lives here.
   */
  glowFor: (m: string) => string | null;
  layoutFor: (m: string) => string | null;
  /**
   * The level and the EQ a mode is holding, same contract as the two above: null
   * when the mode has nothing of its own, so a list can print the app's no-value
   * mark instead of a number nobody chose. `levelFor` reports the LOCKED figure
   * for a locking mode, because that is what the mode will actually set.
   */
  levelFor: (m: string) => number | null;
  eqFor: (m: string) => string | null;
  /**
   * What the Picture group is holding for a mode, as one word rather than five
   * numbers: `Custom` when that mode has its own entry, `Default` when it is
   * still on the shipped baseline. One word because the card reports the group
   * on one line (2026-08-24, Cindy), and because `Default` is already what the
   * mode rows in that same card say — the reader learns no new label.
   */
  pictureFor: (m: string) => string;
}

const Ctx = createContext<MonitorModeState | null>(null);

export function MonitorModeProvider({ skuId, features, children }: { skuId: string; features: Features; children: ReactNode }) {
  const builtIn: string[] = Array.isArray(features.modes) ? (features.modes as string[]) : [];
  const {
    monitorMode,
    setMonitorMode,
    customModes,
    setCustomModes,
    underGlow,
    setUnderGlow,
    smartActions,
    viewingMode,
    setViewingMode,
    pictureFor: pictureOfSku,
    setPictureFor,
    audioEq,
    setAudioEq,
    // The desk's shared level and its automation. Read here because Brightness
    // is mode-scoped as of 2026-08-29 and the rule is "the mode wins, and
    // matching happens inside the mode" (DisplayPictureState, Settings.tsx):
    // a switch that moves this monitor has to move the rest of the desk with it
    // while Match is on, or the Personalize caption becomes a half-truth.
    displaySync,
    displayBrightness,
    setDisplayBrightness,
  } = useSettings();
  // Everything below reads and writes THIS window's monitor (2026-09-18). The
  // names stay `displayPicture` / `setDisplayPicture` so the mode machinery that
  // applies, compares and resets them did not have to change — only what they
  // point at did: one picture per display instead of one for the whole desk.
  const displayPicture = pictureOfSku(skuId);
  const setDisplayPicture = (v: DisplayPictureState) => setPictureFor(skuId, v);

  const custom: string[] = Array.isArray(customModes) ? customModes : [];
  const modes = useMemo(() => [...builtIn, ...custom], [builtIn.join('|'), custom.join('|')]);

  // A saved mode this SKU no longer offers (a different monitor, a renamed or
  // deleted preset) reads as unselected rather than silently selecting someone
  // else's mode.
  const mode = modes.includes(monitorMode) ? monitorMode : '';

  const [notice, setNotice] = useState<ModeNotice>(null);
  const [layoutAsk, setLayoutAsk] = useState<LayoutAsk>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  /**
   * Moving the lamp is the mode's job — the caption under the chips has always
   * promised it. A locking mode (Create) is pinned to its researched default
   * whatever was saved, so the lock cannot be escaped by having picked red there
   * before the lock existed; anything else resumes what it was left on.
   */
  const applyGlow = useCallback(
    (m: string) => {
      if (!features.underGlow) return;
      const locks = MODES_LOCKING_GLOW.includes(m);
      const saved = underGlow.byMode?.[m];
      const next = locks ? MODE_GLOW[m] : (saved && migrateGlowColor(saved)) || MODE_GLOW[m];
      /* The last resort is the STORED DEFAULT, not the level currently lit.
         `underGlow.brightness` is whatever the mode you are leaving happened to
         be at, so a mode with nothing of its own inherited its predecessor:
         leaving Create (10%) put Game at 10% and the tab looked as if that were
         Game's answer (open since 2026-08-12, Cindy). It is not — Game and Work
         deliberately have no entry in MODE_GLOW_LEVEL, because the 2026-07-21
         colour research settled hue and said nothing about level, and inventing
         two numbers to fill the table is how unfounded values ship.
         `GLOW_LEVEL_DEFAULT` is not such an invention: it is the same 70 the
         store already opens with, so a mode that has never been told a level
         shows the light at its resting brightness every time, whichever mode
         you arrived from. */
      const level = locks
        ? MODE_GLOW_LEVEL[m]
        : underGlow.byModeLevel?.[m] ?? MODE_GLOW_LEVEL[m] ?? GLOW_LEVEL_DEFAULT;
      // A custom preset has no researched default; it keeps whatever is lit
      // until the user changes it in that preset.
      if (next == null) return;
      if (next !== underGlow.color || level !== underGlow.brightness) {
        setUnderGlow({ ...underGlow, color: next, brightness: level });
      }
    },
    [features.underGlow, underGlow, setUnderGlow],
  );

  /**
   * A manual switch restores the layout that mode remembers. Nothing stored
   * leaves the screen as it is — see `ViewingModeState.byMode`.
   *
   * ⚠️ An AUTOMATIC switch must not call this. `profile-proposal-2026-07.md:63`
   * makes that the application guard: a game launching may change the mode but
   * must never rearrange the screen, because a split arriving unasked costs the
   * user their window layout mid-task. There is no branch for it here on
   * purpose — nothing in this app detects a launch yet, and a guard against a
   * caller that cannot exist would be untestable. It lands with its trigger,
   * the same rule the header note applies to the suggestion face. The one thing
   * a future auto-switch path must do is call `applyGlow` without this.
   */
  /**
   * Moving Brightness / Contrast / Sharpness / Black Stretch / Color preset is
   * the mode's job too — same rule as the lamp, same reason: a value that stays
   * put through a mode switch was never mode-scoped, it was just stored
   * somewhere nobody read back from. Brightness is the newest of the five
   * (2026-08-29) and the only one with a second scope of its own; which scope
   * wins is written on `DisplayPictureState` in Settings.tsx.
   *
   * Unlike the lamp there is no researched per-mode default here — the decision
   * doc gives Picture ONE shipped baseline, not three. So a mode without its own
   * entry resolves to that baseline rather than leaking whatever the previous
   * mode left on screen, and a mode with an entry always wins.
   */
  const applyPicture = useCallback(
    (m: string) => {
      const saved = displayPicture.byMode?.[m];
      const next = {
        brightness: saved?.brightness ?? DEFAULT_DISPLAY_PICTURE.brightness,
        contrast: saved?.contrast ?? DEFAULT_DISPLAY_PICTURE.contrast,
        sharpness: saved?.sharpness ?? DEFAULT_DISPLAY_PICTURE.sharpness,
        blackStretch: saved?.blackStretch ?? DEFAULT_DISPLAY_PICTURE.blackStretch,
        colorPreset: saved?.colorPreset ?? DEFAULT_DISPLAY_PICTURE.colorPreset,
      };
      if (
        next.brightness !== displayPicture.brightness ||
        next.contrast !== displayPicture.contrast ||
        next.sharpness !== displayPicture.sharpness ||
        next.blackStretch !== displayPicture.blackStretch ||
        next.colorPreset !== displayPicture.colorPreset
      ) {
        setDisplayPicture({ ...displayPicture, ...next });
      }
      // "Game으로 바꾸면 책상의 모든 모니터가 Game의 밝기로 함께 간다" — the desk
      // follows the mode while Match is on. Written in the same batch as the line
      // above so the two numbers are never briefly different: the Display tab's
      // own adoption effect compares them, and a gap would pull the level back to
      // the mode we just left.
      if (displaySync && next.brightness !== displayBrightness) {
        setDisplayBrightness(next.brightness);
      }
    },
    [displayPicture, setDisplayPicture, displaySync, displayBrightness, setDisplayBrightness],
  );

  const applyLayout = useCallback(
    (m: string) => {
      const saved = viewingMode.byMode?.[m];
      if (!saved || saved === viewingMode.current) return;
      setViewingMode({ ...viewingMode, current: saved });
    },
    [viewingMode, setViewingMode],
  );

  /**
   * The EQ a mode remembers, restored on a switch. No `layoutAsk` twin and no
   * confirmation: the layout asks because a split rearranges the windows you are
   * working in, and this changes how the next sound is coloured. Nothing stored
   * leaves the speakers alone, the same reading of "empty" `applyLayout` uses.
   */
  const applyEq = useCallback(
    (m: string) => {
      const saved = audioEq.byMode?.[m];
      if (!saved || saved === audioEq.current) return;
      setAudioEq({ ...audioEq, current: saved });
    },
    [audioEq, setAudioEq],
  );

  /* Read-only twins of the two above. Same fallback chain, deliberately not a
     second one — see the interface note. */
  const glowFor = useCallback(
    (m: string): string | null => {
      if (!features.underGlow) return null;
      if (MODES_LOCKING_GLOW.includes(m)) return MODE_GLOW[m] ?? null;
      const saved = underGlow.byMode?.[m];
      return ((saved && migrateGlowColor(saved)) || MODE_GLOW[m]) ?? null;
    },
    [features.underGlow, underGlow],
  );

  const layoutFor = useCallback(
    (m: string): string | null => viewingMode.byMode?.[m] ?? null,
    [viewingMode],
  );

  const levelFor = useCallback(
    (m: string): number | null => {
      if (!features.underGlow) return null;
      if (MODES_LOCKING_GLOW.includes(m)) return MODE_GLOW_LEVEL[m] ?? null;
      return underGlow.byModeLevel?.[m] ?? MODE_GLOW_LEVEL[m] ?? null;
    },
    [features.underGlow, underGlow],
  );

  const eqFor = useCallback(
    (m: string): string | null => audioEq.byMode?.[m] ?? null,
    [audioEq],
  );

  const pictureFor = useCallback(
    (m: string): string => (displayPicture.byMode?.[m] != null ? 'Custom' : 'Default'),
    [displayPicture.byMode],
  );


  const select = useCallback(
    (m: string) => {
      if (m === mode) return;
      setMonitorMode(m);
      applyGlow(m);
      applyLayout(m);
      applyEq(m);
      applyPicture(m);
      // A pending question belongs to the mode it named. Leaving it up after the
      // mode moved would offer to save PBP "to Work" while the bar reads Game.
      setLayoutAsk(null);
    },
    [mode, setMonitorMode, applyGlow, applyLayout, applyEq, applyPicture],
  );

  const addPreset = useCallback(
    (name: string) => {
      const clean = name.trim();
      if (!clean || modes.includes(clean) || custom.length >= MAX_CUSTOM_PRESETS) return;
      setCustomModes([...custom, clean]);
      // The new preset starts from what is on screen right now, so the light
      // does not jump the moment it is created.
      setUnderGlow({
        ...underGlow,
        byMode: { ...(underGlow.byMode ?? {}), [clean]: underGlow.color },
        byModeLevel: { ...(underGlow.byModeLevel ?? {}), [clean]: underGlow.brightness },
      });
      // The layout too, for the same stated reason: the bar promises "starts
      // from your current settings", and a preset made in PBP that forgot the
      // split would break that promise the first time it was selected. No
      // confirmation here — pressing "Save preset" IS the confirmation, so the
      // Zone 2 question would be asking twice about one deliberate act.
      setViewingMode({
        ...viewingMode,
        byMode: { ...(viewingMode.byMode ?? {}), [clean]: viewingMode.current },
      });
      // And the EQ, for the same stated reason — "starts from your current
      // settings" is the bar's own promise, and a preset created while the
      // speakers are on Music that came back on Game would break it.
      setAudioEq({
        ...audioEq,
        byMode: { ...(audioEq.byMode ?? {}), [clean]: audioEq.current },
      });
      // No receipt: the new option appearing in the bar, ringed, is the
      // feedback — a line saying so would be the second voice again.
      setMonitorMode(clean);
    },
    [custom, modes, setCustomModes, setMonitorMode, underGlow, setUnderGlow, viewingMode, setViewingMode, audioEq, setAudioEq],
  );

  /**
   * Renaming moves the saved values with the name. A preset IS its name here —
   * that is the key its under-glow is filed under — so a rename that only
   * changed the label would leave the settings behind under a name nobody can
   * see any more.
   */
  const renamePreset = useCallback(
    (from: string, to: string) => {
      const clean = to.trim();
      if (!clean || !custom.includes(from) || modes.includes(clean)) return;
      setCustomModes(custom.map((x) => (x === from ? clean : x)));
      const byMode = { ...(underGlow.byMode ?? {}) };
      const byModeLevel = { ...(underGlow.byModeLevel ?? {}) };
      if (byMode[from] != null) {
        byMode[clean] = byMode[from];
        delete byMode[from];
      }
      if (byModeLevel[from] != null) {
        byModeLevel[clean] = byModeLevel[from];
        delete byModeLevel[from];
      }
      setUnderGlow({ ...underGlow, byMode, byModeLevel });
      // The layout is filed under the name as well, so it moves with it or it is
      // orphaned — the same argument the comment above makes for the colour.
      const vmByMode = { ...(viewingMode.byMode ?? {}) };
      if (vmByMode[from] != null) {
        vmByMode[clean] = vmByMode[from];
        delete vmByMode[from];
        setViewingMode({ ...viewingMode, byMode: vmByMode });
      }
      // The EQ is filed under the name too, so it moves or it is orphaned.
      const eqByMode = { ...(audioEq.byMode ?? {}) };
      if (eqByMode[from] != null) {
        eqByMode[clean] = eqByMode[from];
        delete eqByMode[from];
        setAudioEq({ ...audioEq, byMode: eqByMode });
      }
      if (monitorMode === from) setMonitorMode(clean);
    },
    [
      custom,
      modes,
      setCustomModes,
      underGlow,
      setUnderGlow,
      viewingMode,
      setViewingMode,
      audioEq,
      setAudioEq,
      monitorMode,
      setMonitorMode,
    ],
  );

  const duplicatePreset = useCallback(
    (name: string) => {
      if (custom.length >= MAX_CUSTOM_PRESETS) return;
      // "copy", then "copy 2" — the same escalation the Lights tab uses, so a
      // second duplicate does not collide with the first.
      let candidate = `${name} copy`;
      for (let n = 2; modes.includes(candidate); n += 1) candidate = `${name} copy ${n}`;
      setCustomModes([...custom, candidate]);
      setUnderGlow({
        ...underGlow,
        byMode: { ...(underGlow.byMode ?? {}), [candidate]: underGlow.byMode?.[name] ?? underGlow.color },
        byModeLevel: {
          ...(underGlow.byModeLevel ?? {}),
          [candidate]: underGlow.byModeLevel?.[name] ?? underGlow.brightness,
        },
      });
      setViewingMode({
        ...viewingMode,
        byMode: {
          ...(viewingMode.byMode ?? {}),
          [candidate]: viewingMode.byMode?.[name] ?? viewingMode.current,
        },
      });
      setAudioEq({
        ...audioEq,
        byMode: {
          ...(audioEq.byMode ?? {}),
          [candidate]: audioEq.byMode?.[name] ?? audioEq.current,
        },
      });
    },
    [custom, modes, setCustomModes, underGlow, setUnderGlow, viewingMode, setViewingMode, audioEq, setAudioEq],
  );

  /**
   * Deleting takes the stored values with it — leaving them would resurrect the
   * old settings under a preset made later with the same name. If the deleted
   * preset was the one in force the bar goes back to unselected rather than
   * picking a neighbour on the user's behalf; the lamp keeps whatever is lit.
   */
  const deletePreset = useCallback(
    (name: string) => {
      if (!custom.includes(name)) return;
      setCustomModes(custom.filter((x) => x !== name));
      const byMode = { ...(underGlow.byMode ?? {}) };
      const byModeLevel = { ...(underGlow.byModeLevel ?? {}) };
      delete byMode[name];
      delete byModeLevel[name];
      setUnderGlow({ ...underGlow, byMode, byModeLevel });
      const vmByMode = { ...(viewingMode.byMode ?? {}) };
      delete vmByMode[name];
      setViewingMode({ ...viewingMode, byMode: vmByMode });
      // Left behind, this would resurrect the old EQ under a preset made later
      // with the same name — the argument the comment above makes for the colour.
      const eqByMode = { ...(audioEq.byMode ?? {}) };
      delete eqByMode[name];
      setAudioEq({ ...audioEq, byMode: eqByMode });
      if (monitorMode === name) setMonitorMode('');
    },
    [
      custom,
      setCustomModes,
      underGlow,
      setUnderGlow,
      viewingMode,
      setViewingMode,
      audioEq,
      setAudioEq,
      monitorMode,
      setMonitorMode,
    ],
  );

  /**
   * Picking a layout does two separable things, and this is the split the Zone 2
   * class asks for: the screen changes NOW (a direct action is never questioned
   * — same rule as the Personalize slider, ia-section5.md), and whether the mode
   * remembers it is a question.
   *
   * No mode picked = no question, because there is nothing to file it under.
   * Already what this mode remembers = no question either, since answering yes
   * would write the value that is already there.
   */
  const setLayout = useCallback(
    (v: string) => {
      if (v === viewingMode.current) return;
      setViewingMode({ ...viewingMode, current: v });
      setLayoutAsk(mode && viewingMode.byMode?.[mode] !== v ? { layout: v, mode } : null);
    },
    [viewingMode, setViewingMode, mode],
  );

  const saveLayout = useCallback(() => {
    if (!layoutAsk) return;
    setViewingMode({
      ...viewingMode,
      byMode: { ...(viewingMode.byMode ?? {}), [layoutAsk.mode]: layoutAsk.layout },
    });
    setLayoutAsk(null);
    // The same receipt a quiet save gets — plus the one word that keeps it
    // honest. What was confirmed was the write, not the wording, so the
    // confirmation should not leave a different trace; but `Saved to Create`
    // alone would claim the whole card, and the source and speaker rows beside
    // it stay with the desk.
    setNotice({ kind: 'saved', mode: layoutAsk.mode, scope: 'layout only' });
  }, [layoutAsk, viewingMode, setViewingMode]);

  /** The screen keeps the layout; the mode does not learn it. No receipt — nothing was written. */
  const dismissLayout = useCallback(() => setLayoutAsk(null), []);

  /**
   * The write was already here, inline; what it was missing is the receipt. A
   * quiet save is silent about the QUESTION, not about the fact — picking an
   * under-glow colour and confirming a layout both leave "Saved to <mode>", and
   * an EQ that stored itself with no trace at all is the one case where the user
   * cannot tell a mode-scoped write from a global one. No mode picked: the
   * preset still changes, nothing is filed, and there is nothing to report.
   */
  const setEq = useCallback(
    (v: string) => {
      setAudioEq({
        ...audioEq,
        current: v,
        ...(mode ? { byMode: { ...(audioEq.byMode ?? {}), [mode]: v } } : {}),
      });
      if (mode) setNotice({ kind: 'saved', mode });
    },
    [audioEq, setAudioEq, mode],
  );

  const noticeLimit = useCallback(() => setNotice({ kind: 'limit', mode: '' }), []);

  const isDirty = useCallback(
    (m: string) =>
      Boolean(
        m &&
          (underGlow.byMode?.[m] != null ||
            underGlow.byModeLevel?.[m] != null ||
            displayPicture.byMode?.[m] != null ||
            viewingMode.byMode?.[m] != null ||
            audioEq.byMode?.[m] != null),
      ),
    [underGlow.byMode, underGlow.byModeLevel, displayPicture.byMode, viewingMode.byMode, audioEq.byMode],
  );

  const markSaved = useCallback(() => {
    setNotice({ kind: 'saved', mode });
  }, [mode]);

  // "Has this mode been personalised?" — an under-glow colour or level stored
  // against it, or a Viewing Mode layout (2026-08-08, the first Display-tab
  // setting to become mode-scoped). When the rest of the picture settings follow
  // this reads those too; the shape of the question does not change.
  const dirty = Boolean(
    mode &&
      builtIn.includes(mode) &&
      (underGlow.byMode?.[mode] != null ||
        underGlow.byModeLevel?.[mode] != null ||
        displayPicture.byMode?.[mode] != null ||
        viewingMode.byMode?.[mode] != null ||
        audioEq.byMode?.[mode] != null),
  );

  const resetMode = useCallback(
    (target?: string) => {
      const m = target ?? mode;
      if (!m) return;
      const byMode = { ...(underGlow.byMode ?? {}) };
      const byModeLevel = { ...(underGlow.byModeLevel ?? {}) };
      delete byMode[m];
      delete byModeLevel[m];
      // The lamp only follows the reset when it is the mode you are actually in
      // — resetting Work from the Utilities list must not repaint a desk that is
      // currently lit by Game.
      const live = m === mode;
      const color = live ? MODE_GLOW[m] ?? underGlow.color : underGlow.color;
      const brightness = live ? MODE_GLOW_LEVEL[m] ?? underGlow.brightness : underGlow.brightness;
      setUnderGlow({ ...underGlow, byMode, byModeLevel, color, brightness });
      // The layout is stored per mode, so Reset has to clear it or "reset to
      // defaults" would leave a split screen behind. Same live/not-live split as
      // the lamp: resetting Work from the Utilities list must not unsplit a
      // screen that is currently in Game.
      const vmByMode = { ...(viewingMode.byMode ?? {}) };
      delete vmByMode[m];
      setViewingMode({
        ...viewingMode,
        byMode: vmByMode,
        current: live ? DEFAULT_VIEWING_MODE.current : viewingMode.current,
      });
      // The EQ is stored per mode as well, so Reset has to clear it or a reset
      // mode would come back holding the preset it was reset out of. Same
      // live/not-live split: resetting Work from the Utilities list must not
      // re-colour sound that is currently playing under Game.
      const eqByMode = { ...(audioEq.byMode ?? {}) };
      delete eqByMode[m];
      setAudioEq({
        ...audioEq,
        byMode: eqByMode,
        current: live ? DEFAULT_AUDIO_EQ.current : audioEq.current,
      });
      // Picture is stored per mode as well. Same live/not-live split: resetting
      // Work from the Utilities list must not repaint a screen showing Game.
      const dpByMode = { ...(displayPicture.byMode ?? {}) };
      delete dpByMode[m];
      setDisplayPicture({
        ...displayPicture,
        byMode: dpByMode,
        ...(live
          ? {
              brightness: DEFAULT_DISPLAY_PICTURE.brightness,
              contrast: DEFAULT_DISPLAY_PICTURE.contrast,
              sharpness: DEFAULT_DISPLAY_PICTURE.sharpness,
              blackStretch: DEFAULT_DISPLAY_PICTURE.blackStretch,
              colorPreset: DEFAULT_DISPLAY_PICTURE.colorPreset,
            }
          : {}),
      });
      // Brightness is part of that picture now, so a live Reset moves the desk
      // back too while Match is on — same rule as the switch above, and without
      // it Reset would leave every OTHER display on the level it is clearing.
      if (live && displaySync && displayBrightness !== DEFAULT_DISPLAY_PICTURE.brightness) {
        setDisplayBrightness(DEFAULT_DISPLAY_PICTURE.brightness);
      }
      if (live) setLayoutAsk(null);
      // A receipt, not silence: the cleared storage is invisible, and the colour
      // snapping back could otherwise read as a glitch.
      setNotice({ kind: 'reset', mode: m });
    },
    [mode, underGlow, setUnderGlow, viewingMode, setViewingMode, audioEq, setAudioEq, displayPicture, setDisplayPicture, displaySync, displayBrightness, setDisplayBrightness],
  );

  const value: MonitorModeState = {
    skuId,
    modes,
    builtIn,
    mode,
    select,
    addPreset,
    renamePreset,
    duplicatePreset,
    deletePreset,
    canAddPreset: custom.length < MAX_CUSTOM_PRESETS,
    noticeLimit,
    isDirty,
    markSaved,
    dirty,
    resetMode,
    notice,
    autoSwitch: smartActions,
    layout: viewingMode.current,
    setLayout,
    eq: audioEq.current,
    setEq,
    layoutAsk,
    saveLayout,
    dismissLayout,
    glowFor,
    layoutFor,
    levelFor,
    eqFor,
    pictureFor,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Null outside a monitor canvas — callers gate on it rather than crash. */
export function useMonitorMode(): MonitorModeState | null {
  return useContext(Ctx);
}

// ── One display's picture, from anywhere ────────────────────────────────────
// The three hooks below moved out of `MonitorTabs.tsx` on 2026-08-31, where
// they were private to the Display tab. Nothing about their behaviour changed
// inside a monitor canvas; what changed is that the home board's device card
// can now call the same code instead of holding its own numbers.
//
// Why they moved rather than being re-implemented on the card (rule 15): the
// card had `useState(72)` / `useState(50)` for brightness and contrast, so the
// two surfaces reported different values for one display and the card's were
// the ones that could never be true. A second copy of "the mode wins, and
// matching happens inside the mode" would have drifted from this one the first
// time either was edited — the rule is subtle enough that it is written down
// in prose on `DisplayPictureState`, which is a sign it should exist once.

/**
 * The mode in force for a display, provider or not.
 *
 * Inside a monitor canvas the provider already resolved it and owns switching.
 * Outside one — the home card is the case that made this necessary — there is
 * no provider, so the persisted `monitorMode` is checked against the SKU's own
 * list exactly the way `MonitorModeProvider` does it: a saved mode this display
 * no longer offers reads as unselected rather than silently selecting someone
 * else's.
 *
 * `modes` omitted = a caller that only ever runs under the provider; without
 * one the answer is `''`, which is what every such caller already got.
 */
export function useResolvedMode(modes?: string[]): string {
  const ctx = useMonitorMode();
  const { monitorMode } = useSettings();
  if (ctx) return ctx.mode;
  return modes && modes.includes(monitorMode) ? monitorMode : '';
}

/**
 * The Display tab's picture controls, read and written where the mode can see
 * them (`displayPicture`, Settings.tsx). Before this each control held its own
 * uncontrolled value, so Contrast reset when the window closed and a mode
 * switch left it exactly where the previous mode had put it.
 *
 * The write is quiet — Zone 1, like the lamp and the EQ. It lands on the live
 * value AND on the mode you are in, in one go, because those are not two
 * decisions: turning Contrast up while Game is selected IS Game's contrast.
 * Writing on every tick rather than at the end of the drag follows what
 * Brightness already does here (`setDisplayBrightness` is passed straight in),
 * so the tab has one storage habit instead of two.
 *
 * With no mode picked the value still moves; it just has nowhere to be filed.
 */
/**
 * This monitor's Auto-Brightness source ('Off' | 'Ambient' | 'Content'), resolved
 * the same way as `usePicture`: the window says which display it is, or the
 * caller does. Each display has its own sensor, so each keeps its own answer.
 */
export function useAutoBrightness(skuId?: string) {
  const { autoBrightnessFor, setAutoBrightnessFor, displaySync, setDisplaySync } = useSettings();
  const ctx = useMonitorMode();
  const sku = ctx?.skuId ?? skuId ?? '';
  return {
    autoBrightness: autoBrightnessFor(sku),
    // The latest hand wins, in both directions (2026-09-23). Matching from
    // Personalize sets the matched displays to Off (AllDisplaysWidget), and
    // handing a display back to its sensor here ends the match — otherwise the
    // sensor and "all monitors at one level" both own one number, and the next
    // change of room light breaks the match without saying so. Here rather
    // than at the two call sites (home card, Display tab) so they cannot
    // disagree about it.
    setAutoBrightness: (v: string) => {
      setAutoBrightnessFor(sku, v);
      if (v !== 'Off' && displaySync) setDisplaySync(false);
    },
  };
}

export function usePicture(modes?: string[], skuId?: string) {
  const { pictureFor, setPictureFor } = useSettings();
  const ctx = useMonitorMode();
  // Inside a monitor window the window says which display this is; outside one
  // (the Home card) the caller does. Each display keeps its own picture.
  const sku = ctx?.skuId ?? skuId ?? '';
  const displayPicture = pictureFor(sku);
  const setDisplayPicture = (v: DisplayPictureState) => setPictureFor(sku, v);
  const mode = useResolvedMode(modes);
  const setValue = <K extends 'brightness' | 'contrast' | 'sharpness' | 'blackStretch' | 'colorPreset'>(
    key: K,
    v: DisplayPictureState[K],
  ) => {
    const next: DisplayPictureState = { ...displayPicture, [key]: v };
    if (mode) {
      next.byMode = {
        ...(displayPicture.byMode ?? {}),
        [mode]: { ...(displayPicture.byMode?.[mode] ?? {}), [key]: v },
      };
    }
    setDisplayPicture(next);
  };
  return { picture: displayPicture, setValue };
}

/**
 * Brightness, and the one rule that governs it (2026-08-29, stated in full on
 * `DisplayPictureState`): THE MODE WINS, AND MATCHING HAPPENS INSIDE THE MODE.
 *
 * A write lands on the mode you are in, and — while Personalize is holding
 * every display at one level — on the desk's shared number too, so the master
 * slider on that page is not a control that changes nothing you can see. The
 * effect is the other direction of the same promise: moved from Personalize,
 * the desk's number is what this display shows, filed under the mode it is in.
 * Equal values write nothing, which is what stops a mode switch (it moves both
 * in one batch) from being pulled back to where it came from.
 *
 * `synced` is returned rather than read again by callers so a surface cannot
 * draw the `All monitors` tag while acting on a different
 * answer.
 */
/**
 * The speaker level both surfaces show, and the reason it is a constant rather
 * than a setting: Volume is deliberately NOT mode-scoped or persisted — our own
 * table (`profile-proposal-2026-07.md`, "What a mode remembers") keeps it out
 * with Mute, "moment-to-moment, like a TV remote — a mode switch must never
 * jolt loudness". That decision stands.
 *
 * What did not stand was showing 65% in the Audio tab and 40% on the home card
 * for one pair of speakers (measured 2026-08-31). Two unwired literals in two
 * files is not a design decision, it is a contradiction nobody chose; one
 * literal in one place is the same design with the contradiction removed.
 */
export const SPEAKER_VOLUME = 65;

export function useBrightnessLevel(modes?: string[], skuId?: string) {
  const { displaySync, displayBrightness, setDisplayBrightness } = useSettings();
  const { picture, setValue } = usePicture(modes, skuId);
  const level = picture.brightness;
  const setLevel = (v: number) => {
    setValue('brightness', v);
    if (displaySync) setDisplayBrightness(v);
  };
  useEffect(() => {
    if (!displaySync || displayBrightness === picture.brightness) return;
    setValue('brightness', displayBrightness);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displaySync, displayBrightness, picture.brightness]);
  return { level, setLevel, synced: displaySync };
}
