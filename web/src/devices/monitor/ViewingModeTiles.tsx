// ══════════════════════════════════════════════════════════════════════════
// Viewing Mode — the layout picker, drawn instead of spelled (2026-08-20, Cindy:
// *"뷰잉 모드 이거는 텍스트 말고 이미지가 더 도움 되는 거 아니야?"*).
//
// It was three words in a segmented control — `Full Screen | PBP | PIP`. Screen
// layout is spatial information, so a 72x40 diagram says it faster than a
// three-letter acronym, and the acronyms had no full name anywhere on the tab
// (copy-rules 7). The group headings carry the full names now, so nothing needs
// a tooltip to be readable.
//
// ⚠️ NOT an icon, and not in the library. Searched before drawing: Chris's
// sprite (`shared/icons.svg`, 269 symbols — split/layout/screen/grid/window/
// panel/pip/pbp/tile all grepped, 7 hits and every one a different meaning) and
// `web/src/components/` (closest are `.ds-card-select`, a full content card, and
// `Swatch`, a colour chip — neither is a small line diagram). So this is a
// rule-11 item: a layout-tile picker belongs in the library, and until it is
// there this file is where it lives. Logged in
// `Claude HP/design-assets/chris-next-outbound.md`.
//
// ── Where the drawing comes from ──────────────────────────────────────────
// Cindy's own `Screen Layout` component in the HP Display Center file
// (`BQeCmGRH0XB66oVzY6q94V`, frame `534:243219`): 15 layout types x 7 states.
// Read out of Figma rather than eyeballed — every number below is hers:
//
//   frame        default  x/y 1     70x38  stroke 2   (Grey 10 #EEEEEE)
//                selected x/y 1.5   69x37  stroke 3   (Blue #007DD6)
//   boundary     vertical line at a unit fraction, round cap, frame's colour
//   grid hint    same line dashed 4 4, square cap, 2px, inset 2 (Grey 60)
//   PIP inset    24x14 rect, 6px from the chosen corner, frame's colour
//
// Colours are the one thing NOT copied: they arrive as tokens, because a hex
// baked into an asset does not follow an accent change — the same reason this
// project tokenized the port map's `#346ED1` on 2026-08-02. Grey 10 -> the white
// the port map already draws empty ports with, Blue -> `--accent-color`, Grey 60
// -> a lower rung of the same white ramp.
//
// ── Why a renderer and a table, not 8 exported SVGs ───────────────────────
// Figma exports each type x state as its own flattened SVG: our 8 tiles would
// be 24 files, and HP Display Center's full set 105. They are all the same
// drawing with a different unit count, so the count is data (`units`, `split`)
// and the drawing is code — assets stop multiplying with states, which is the
// structure Cindy asked for on the under-glow renders.
//
// That is also why the table below holds MORE layouts than Treehouse 32 shows.
// Which ones a monitor offers is a SKU field (`display.viewingModes`,
// copy-rules 「기기 가변성」 4): a 16:9 32" panel splits usefully in two — 1920
// wide each — and unusably in four (960, a 7-inch strip fed by a whole
// computer), so it lists eight. An ultrawide turns on the thirds and quarters
// without anything new being drawn.
// ══════════════════════════════════════════════════════════════════════════
import { Fragment, useState } from 'react';
import { Dropdown, Icon, Ng3Field, Ng3Label, Ng3Row, Tooltip } from '../../components';
import { setViewingPreview } from './viewingPreview';

/** One tile: a layout, and how to draw it. */
interface Layout {
  /** Stored value + Figma `Type=` name. This is what the SKU field lists. */
  id: string;
  /** How many equal columns the panel is treated as. Absent = one whole screen. */
  units?: number;
  /** The column line that is a real source boundary (1 = after the first). */
  split?: number;
  /**
   * Draw the remaining column lines dashed. Cindy's notation for "count these
   * to see whether the screen is in thirds or quarters" — it earns its ink only
   * where a set shows both, so Treehouse 32's thirds-only set leaves it off and
   * an ultrawide's set turns it on.
   */
  hints?: boolean;
  /** Corner for the inset window, as [horizontal, vertical]. */
  pip?: ['l' | 'r', 't' | 'b'];
}

/** The answers a divided screen needs beyond the layout itself. */
export interface SplitDetail {
  left?: string;
  pipSize?: string;
  audioFrom?: string;
}

/**
 * Three steps, not a slider. OMEN Gaming Hub puts a continuous slider under its
 * PIP tiles (`design-assets/reference-images/Display_OMEN Gear Switch_PIP.png`),
 * and the backlog entry that asked for this control copied that shape. It is the
 * one thing here we do NOT copy: the inset is a panel scaler with fixed steps,
 * so a slider would have to print a percentage to say where it is — a number
 * with no meaning to the person reading it, in the slot copy-rules budgets
 * hardest. Named steps say the same thing and survive translation.
 */
const PIP_SIZES = ['Small', 'Medium', 'Large'];

/**
 * Every layout the renderer knows, keyed by the name the SKU field uses.
 * Ratios read left:right — `PBP 1:2` is a narrow pane then a wide one.
 */
const LAYOUTS: Record<string, Layout> = {
  'Full Screen': { id: 'Full Screen' },
  PBP: { id: 'PBP', units: 2, split: 1 },
  'PBP 2:1': { id: 'PBP 2:1', units: 3, split: 2 },
  'PBP 1:2': { id: 'PBP 1:2', units: 3, split: 1 },
  '3 split': { id: '3 split', units: 3, split: 1, hints: true },
  'PBP 3:1': { id: 'PBP 3:1', units: 4, split: 3, hints: true },
  'PBP 1:3': { id: 'PBP 1:3', units: 4, split: 1, hints: true },
  'PIP TopL': { id: 'PIP TopL', pip: ['l', 't'] },
  'PIP TopR': { id: 'PIP TopR', pip: ['r', 't'] },
  'PIP BottomL': { id: 'PIP BottomL', pip: ['l', 'b'] },
  'PIP BottomR': { id: 'PIP BottomR', pip: ['r', 'b'] },
};

/**
 * The same table, for anyone that has to DRAW the chosen layout rather than
 * offer it — the desk map's hero does (`DisplayArrange`). Exported so the two
 * views cannot disagree about what `PBP 2:1` means, the way the port list is one
 * table for the map and the X-ray.
 */
export function screenLayout(id: string | undefined): Layout | undefined {
  return id ? LAYOUTS[id] : undefined;
}

/** Where a layout's real source boundaries fall, as fractions of the screen. */
export function layoutSplits(id: string | undefined): number[] {
  const l = screenLayout(id);
  if (!l?.units || !l.split) return [];
  return [l.split / l.units];
}

/**
 * The three headings, in the order the panel is progressively divided. Full
 * names, so `PBP` and `PIP` are spelled once on the tab and no tooltip has to
 * do it (copy-rules 7). Sentence case, like every other row label on these
 * cards.
 */
const GROUPS: { name: string; match: (id: string) => boolean }[] = [
  { name: 'Full screen', match: (id) => id === 'Full Screen' },
  { name: 'Picture by picture', match: (id) => id.startsWith('PBP') || id.endsWith('split') },
  { name: 'Picture in picture', match: (id) => id.startsWith('PIP') },
];

const W = 72;
const H = 40;

/* The inset window at each `PIP size`. Medium is the 24x14 Cindy drew in a
   72x40 tile; the other two keep its shape. Until 2026-09-22 `PIP size` saved a
   value nothing drew (Cindy: "PIP 사이즈 눌렀는데 왜 화면에 바뀌는 게 없어") — the
   tiles are the layout's one drawing, so the size shows here. */
const PIP_INSET: Record<string, [number, number]> = { Small: [18, 10], Medium: [24, 14], Large: [30, 18] };

/** One layout as Cindy drew it — geometry hers, colour ours. */
function LayoutGlyph({ layout, on, pipSize }: { layout: Layout; on: boolean; pipSize?: string }) {
  const [pw, ph] = PIP_INSET[pipSize ?? 'Medium'] ?? PIP_INSET.Medium;
  // The only two numbers that change with selection, both from the component:
  // a 2px outline at inset 1, or a 3px one at inset 1.5.
  const i = on ? 1.5 : 1;
  const sw = on ? 3 : 2;
  const lines: { x: number; hint: boolean }[] = [];
  if (layout.units) {
    for (let n = 1; n < layout.units; n++) {
      const hint = n !== layout.split;
      if (hint && !layout.hints) continue;
      lines.push({ x: i + ((W - i * 2) * n) / layout.units, hint });
    }
  }
  return (
    <svg className="vm-glyph" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden focusable="false">
      <rect className="vm-screen" x={i} y={i} width={W - i * 2} height={H - i * 2} strokeWidth={sw} />
      {lines.map((l) => (
        <line
          key={l.x}
          className={l.hint ? 'vm-hint' : 'vm-split'}
          x1={l.x}
          x2={l.x}
          y1={l.hint ? i + 2 : i}
          y2={H - (l.hint ? i + 2 : i)}
          strokeWidth={l.hint ? 2 : sw}
        />
      ))}
      {layout.pip && (
        <rect
          className="vm-pip"
          width={pw}
          height={ph}
          x={layout.pip[0] === 'l' ? 6 : W - 6 - pw}
          y={layout.pip[1] === 't' ? 6 : H - 6 - ph}
        />
      )}
    </svg>
  );
}

/**
 * The picker. Radio semantics, not the tab semantics `ToggleButtonGroup` gives:
 * these are one setting's mutually exclusive values, and a screen reader should
 * hear "Full Screen, 1 of 8" rather than a tab list. The tile needs no chrome of
 * its own — Cindy's drawing already says selected by going 2px white to 3px
 * accent, so a second selected treatment (a halo, a filled plate) would say it
 * twice. Only the focus ring is added, from the DS token.
 */
export function ViewingModeTiles({
  modes,
  value,
  onChange,
  secondSource = true,
  sources = [],
  detail,
  onDetail,
}: {
  /** The layouts this SKU offers, in `display.viewingModes` order. */
  modes: string[];
  value?: string;
  onChange?: (v: string) => void;
  /**
   * Whether a second thing is actually plugged in. Every layout except
   * `Full Screen` divides the panel between two sources, so with one source
   * they are not choices — they are a feature waiting for hardware (2026-08-20,
   * Cindy: the picker should only be there when two computers are).
   */
  secondSource?: boolean;
  /**
   * The computers this monitor can put on screen, in the SKU's `hosts` order.
   * Passed in rather than read here so this file holds no computer name — the
   * same rule the Connectivity tab learned on 2026-08-20, when `Signal` and the
   * cable row were literals and every monitor claimed the Treehouse 32's port.
   */
  sources?: string[];
  /** Saved answers for a divided screen. Absent fields fall back below. */
  detail?: SplitDetail;
  onDetail?: (patch: SplitDetail) => void;
}) {
  const known = modes.map((m) => LAYOUTS[m]).filter(Boolean);
  /**
   * Folded, not hidden, and not greyed in place. Hidden would tell a monitor's
   * owner it cannot split a screen it can; greyed in place would leave seven
   * dead tiles as the loudest thing in the card. The fold is this tab's own
   * grammar for "possible, not now" — the same `condition + count` line
   * `GEAR SWITCH` uses for `Needs Treehouse on both PCs` — and opening it shows
   * exactly what would arrive, which is what an external reviewer with no
   * context needs (rule 10c).
   */
  const [showLocked, setShowLocked] = useState(false);
  /* Same shape as `value`/`onChange` above: controlled by the card that owns the
     saved state, and self-contained anywhere else (Storybook, CardLab) so the
     rows can be looked at without a Settings provider. */
  const [ownDetail, setOwnDetail] = useState<SplitDetail>({});
  const d = onDetail ? detail ?? {} : ownDetail;
  const patch = onDetail ?? ((p: SplitDetail) => setOwnDetail((prev) => ({ ...prev, ...p })));
  if (known.length === 0) return null;
  const locked = !secondSource;
  const lockLine = (
    <button
      key="lock"
      type="button"
      className={'mt-fold' + (showLocked ? ' is-open' : '')}
      aria-expanded={showLocked}
      onClick={() => setShowLocked((v) => !v)}
    >
      {/* `Needs a second input`, not `…connected`: measured in the live 306px
          column, the longer wording wrapped to two lines while GEAR SWITCH's
          equivalent line one card away (`Needs Treehouse on both PCs`) sits on
          one, and a fold label that wraps reads as a paragraph rather than a
          row. The word it drops is implied by `With`, which frames the line as
          what a second input brings rather than what is being withheld
          (2026-08-21, Cindy — the padlock came off here too). The full
          sentence still
          reaches a screen reader through each locked tile's aria-label. */}
      <span className="ds-ng3-label plain">With a second input</span>
      {/* The count, not the names — same reason the `Protections` and GEAR SWITCH
          folds carry a number: the names are the longest string this slot can
          hold and the place translation expands worst. */}
      <span className="dc-mono-val">{known.length - 1}</span>
      <Icon name="chevron-right" size={14} aria-hidden />
    </button>
  );
  /* Which rows exist is decided by the LAYOUT, not by a fold (copy-rules depth
     rule, 2026-08-21). `Full Screen` has one source filling the panel, so none
     of the three questions below has an answer to give, and a greyed row would
     be a control with no engine behind it — the thing rule 10c says a prototype
     going outside must never grow. A divided screen asks the ones its own shape
     raises: PBP asks which side, PIP asks how big the inset is, both ask which
     computer the speakers play. */
  const chosen = value ? LAYOUTS[value] : undefined;
  const divided = !!chosen && (!!chosen.units || !!chosen.pip);
  /* Two panes with one computer is the locked state above, and its saved layout
     can outlive the second PC being unplugged (`kvm` and `pcCount` are separate
     facts). So the rows are gated on the SOURCES existing, not on the layout
     name — otherwise a `Left screen` dropdown would offer one option and call it
     a choice. */
  const twoSources = sources.length > 1 && !locked;
  /* PIP's panes are main + inset, PBP's are left + right. One control names
     whichever the drawing shows, because it is the same question — which
     computer gets the pane your eyes are on — and two labels for one setting
     would read as two settings. */
  const mainLabel = chosen?.pip ? 'Main screen' : 'Left screen';
  const main = d.left ?? sources[0];
  /* The main pane by default, not the KVM's active computer: the speakers are
     wired to a SOURCE here, and following the keyboard would make this row's
     value move on its own every time Gear Switch fired. */
  const audioFrom = d.audioFrom ?? main;
  const pipSize = d.pipSize ?? 'Medium';
  return (
    <>
    <Ng3Field>
      <Ng3Label>Viewing Mode</Ng3Label>
      <div className="vm-groups" role="radiogroup" aria-label="Viewing Mode">
        {(() => {
        const nodes = GROUPS.map((g, gi) => {
          const tiles = known.filter((l) => g.match(l.id));
          if (tiles.length === 0) return null;
          // `Full screen` is the one layout that needs nothing but this monitor,
          // so it stays a live control while the rest wait behind the fold.
          //
          // ⛔ Do NOT lock `Full screen` when Gear Switch sharing is on. That was
          // proposed on 2026-08-26 and reversed on 2026-08-27 by the research in
          // `verifier-log.md`: OMEN's cursor crossing works "in split screen,
          // picture-in-picture mode or to a nearby display" — so a full-screen
          // panel on a desk that has a SECOND display still has somewhere for the
          // cursor to go, and locking the tile would be wrong for that desk. File
          // transfer and clipboard sharing never cared about layout at all.
          //
          // The narrow case that IS real — one display, full screen, cursor
          // crossing on, so the cursor has no target — has no reachable state to
          // draw against yet: cursor crossing is named in the Gear Switch fold,
          // not switchable (`GEAR_SHARING`). A line gated on it would never
          // render. Logged with its trigger in `phase2-backlog.md` instead of
          // shipped as code nothing can reach (2026-08-28).
          const behindFold = locked && gi > 0;
          if (behindFold && !showLocked) return null;
          const group = (
            <div className="vm-group" key={g.name}>
              <span className="vm-group-name">{g.name}</span>
              {/* Four corners sit in one row (2026-08-20, Cindy). The 2x2 was
                  sized against the 72px drawing, which could not fit four across
                  (312px into a 282px column); at the 54px the tiles now render,
                  four measure 237px and fit, so the corners stop taking a second
                  line. What the 2x2 also did — make the BLOCK read as a screen,
                  so `PIP TopL` needed no label — the drawing keeps doing on its
                  own, since the inset rect still sits in the corner it means. */}
              <div className={'vm-row' + (tiles.length === 4 ? ' is-quad' : '')}>
                {tiles.map((l) => {
                  const tile = (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={value === l.id}
                      aria-label={behindFold ? `${l.id} (needs a second input connected)` : l.id}
                      className={'vm-tile' + (value === l.id ? ' is-on' : '')}
                      disabled={behindFold}
                      onClick={() => onChange?.(l.id)}
                      /* Pointing at a tile shows it on the hero's screen before it
                         is pressed (2026-09-23, Cindy). Locked tiles do not. */
                      onMouseEnter={behindFold ? undefined : () => setViewingPreview(l.id)}
                      onMouseLeave={() => setViewingPreview(null)}
                      onFocus={behindFold ? undefined : () => setViewingPreview(l.id)}
                      onBlur={() => setViewingPreview(null)}
                    >
                      <LayoutGlyph layout={l} on={value === l.id} pipSize={pipSize} />
                    </button>
                  );
                  /* The DS Tooltip, not a native `title` (2026-08-31, Cindy).
                     The native one shipped on 2026-08-28 and worked, but it made
                     this card speak two tooltip grammars: the title ⓘ two rows
                     up is already a `Tooltip`, and the browser's own waits about
                     a second and paints in the OS style. Same sentence, now in
                     the app's voice and timing.
                     `.ds-tooltip-wrap` is `inline-flex`, so it is a legal child
                     of both shapes `.vm-row` takes (flex, and grid when quad).
                     Only the LOCKED tiles get wrapped — a live tile explains
                     itself by responding. */
                  return behindFold ? (
                    <Tooltip key={l.id} content="Needs a second input connected" placement="top">
                      {tile}
                    </Tooltip>
                  ) : (
                    tile
                  );
                })}
              </div>
            </div>
          );
          // The fold line goes ABOVE what it opens, which is where every other
          // fold on this tab puts it (`Eye comfort`, `Protections`, GEAR SWITCH's
          // software rows). Emitting it with the FIRST locked group rather than
          // after the map keeps that order in both states — closed, the groups
          // below return null and the line is the last thing in the card; open,
          // the tiles appear under it.
          if (locked && gi === 1) {
            return (
              <Fragment key="locked">
                {lockLine}
                {group}
              </Fragment>
            );
          }
          return group;
        });
        /* `Full screen` shares the `Picture by picture` line (2026-09-23, Cindy's
           review): one tile was spending a whole line of this card. Two
           captions side by side, one line of tiles — the same four-across width
           the corner row already takes. Only when both are live: behind the
           one-input fold, `Full screen` is the line. */
        return !locked && nodes[0] && nodes[1] ? (
          <>
            <div className="vm-line">
              {nodes[0]}
              {nodes[1]}
            </div>
            {nodes.slice(2)}
          </>
        ) : (
          nodes
        );
        })()}
        {/* Closed, no locked group renders, so the line has to be emitted here
            instead — same element either way. */}
        {locked && !showLocked && lockLine}
      </div>
    </Ng3Field>
    {divided && twoSources && (
      <>
        <Ng3Row>
          <Ng3Label plain>{mainLabel}</Ng3Label>
          {/* The computer, not the port. `USB-C Video`/`HDMI` is how OMEN names
              these two, and how our own X-ray and port map name them — but this
              tab's other card already calls them by the SKU's `gearSwitch.hosts` names
              (`Active computer`), and a person picking which side of their
              screen shows what is thinking about the computer, not the socket it
              arrived through. Port names stay the X-ray's vocabulary
              (2026-07-23). */}
          <Dropdown
            aria-label={mainLabel}
            value={main}
            onChange={(v) => patch({ left: v })}
            options={sources.map((h) => ({ label: h, value: h }))}
          />
        </Ng3Row>
        {/* No `Right screen` row: two panes and two computers means picking one
            side decides the other. A second dropdown could only ever disagree
            with the first, and OMEN's swap button is the same fact drawn as a
            gesture — one control is fewer. */}
        {/* A row with a dropdown, like the two rows around it (2026-09-23, Cindy's
            review). As a stacked segment it was the one control in this card
            with its label on top, because three buttons do not fit beside a
            label in a 306px column — the dropdown does, and the corner tiles
            already draw the size you picked. */}
        {chosen?.pip && (
          <Ng3Row>
            <Ng3Label plain>PIP size</Ng3Label>
            <Dropdown
              aria-label="PIP size"
              value={pipSize}
              onChange={(v) => patch({ pipSize: v })}
              options={PIP_SIZES.map((v) => ({ label: v, value: v }))}
            />
          </Ng3Row>
        )}
        <Ng3Row>
          {/* `Sound from`, not `Speakers` (2026-08-21, consultant pass). As a
              bare noun beside a computer's name the row read two ways —
              "MacBook's speakers" is the wrong one, since the speakers are the
              monitor's and the computer is where their sound comes from. */}
          <Ng3Label plain>Sound from</Ng3Label>
          {/* On this card rather than in the gear list, where OMEN puts its
              `Display Audio` row. Two reasons, both ours: the 2026-08-08 call
              that brought PBP's depth back to this tab said one feature lives in
              one tab, and the backlog's own `audio gear row` is held for a
              different reason — headset wiring on Treehouse 32 is unspecified.
              The panel's own speakers need no new hardware to pick a source. */}
          <Dropdown
            aria-label="Sound from"
            value={audioFrom}
            onChange={(v) => patch({ audioFrom: v })}
            options={sources.map((h) => ({ label: h, value: h }))}
          />
        </Ng3Row>
      </>
    )}
    </>
  );
}
