import type { IconName } from '../components';

/**
 * The design-system changelog — the curated, intent-level change history the
 * Figma file changelog used to provide. Devs read this to understand what
 * changed and why; git history stays the literal record.
 *
 * Maintained via the `ds-changelog` skill ("cut a release"): draft an entry,
 * review it, prepend it here (newest first), bump the ROOT package.json
 * version to match. Rendered by `ChangelogTable` on the Storybook "Changelog"
 * docs page.
 */

/** Render order within an entry follows array order, not this union's. */
export type ChangeKind = 'added' | 'changed' | 'fixed' | 'removed' | 'deprecated';

/** Matches the sidebar taxonomy; Foundations/Conventions for non-component rows. */
export type Tier =
  | 'Foundations'
  | 'Atoms'
  | 'Molecules'
  | 'Organisms'
  | 'Templates'
  | 'Pages'
  | 'Conventions';

export interface ChangeItem {
  /** Component/asset name — underlined; becomes a link when storyId is set. */
  label: string;
  /** Storybook docs id, e.g. 'atoms-button--docs' (title lowercased, '/' and spaces → '-', + '--docs'). */
  storyId?: string;
  /** Intent-level description — what it means for consumers, never file paths. */
  note?: string;
}

export interface TierGroup {
  tier: Tier;
  /** Optional lead line, e.g. "New Default / Hover / Pressed pattern applied to:" */
  lead?: string;
  items: ChangeItem[];
}

export interface KindGroup {
  kind: ChangeKind;
  /** Optional lead line above the tier nesting. */
  lead?: string;
  tiers: TierGroup[];
}

export interface ChangelogEntry {
  /** Matches the ROOT package.json version at the time of the cut. */
  version: string;
  /** Absolute date — 'July 30, 2026', never relative. */
  date: string;
  committer: string;
  reviewer?: string;
  /** Optional one-line headline shown above the kind groups. */
  summary?: string;
  groups: KindGroup[];
  /** TH-### task ids covered by this entry. */
  tasks?: string[];
}

export const KIND_META: Record<ChangeKind, { icon: IconName; label: string }> = {
  added: { icon: 'add', label: 'Added' },
  changed: { icon: 'edit', label: 'Changes' },
  fixed: { icon: 'check', label: 'Fixed' },
  removed: { icon: 'minus', label: 'Removed' },
  deprecated: { icon: 'alert', label: 'Deprecated' },
};

/** Newest first. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.2.28',
    date: 'September 29, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'The Quick Control tile takes its own class, and the game library gets its cover art back.',
    tasks: ['TH-419'],
    groups: [
      {
        kind: 'fixed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'GameTile — art fills the tile again',
                storyId: 'organisms-gametile--docs',
                note: 'covers in the game library were being drawn small inside a large empty card. Nothing about the thumbnail tile changed; it was being restyled by another component that had taken its class. Anywhere a cover tile appears — the library, the OMEN AI game list — it is back to art edge to edge.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Tile — now `.ds-quick-tile`',
                storyId: 'molecules-tile--docs',
                note: 'the Quick Control tile shipped in 0.2.27 using `.ds-tile`, which the thumbnail tile has owned since the prototype, so its widget padding and border landed on every game cover. Its classes are now `.ds-quick-tile*`. The React component is unchanged — if you use <Tile>, nothing to do; if you wrote `.ds-tile` markup or CSS against the Quick Control tile, rename it.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.27',
    date: 'September 29, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Personalize becomes Quick Control on a new Tile component, and a four-card dashboard concept joins the Admin views.',
    tasks: ['TH-415', 'TH-416', 'TH-417', 'TH-418'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Tile',
                storyId: 'molecules-tile--docs',
                note: 'the Quick Control surface: status, one primary control and a reason line that says why the tile is here, on a grid that reflows from four columns to one. Sizes s / m / t / l / full; states for context, suggested, attention, overridden and unavailable; TileLink and TileGrid alongside.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Light Studio — controlled',
                note: 'the desk can now be driven by its host: lighting states in and out, a compact mode, a camera view, and a pick callback so a click on a device can mean "open it". Sync all now owns the selection.',
              },
              {
                label: 'Device card — status line',
                note: 'a card can say what its device is doing right now under its type, in yellow when it needs attention (a muted mic). Photos stand on one shelf line; the mouse reads smaller than the rest.',
              },
            ],
          },
          {
            tier: 'Pages',
            items: [
              {
                label: 'Personalize — Quick Control (Kristy Cheng)',
                note: 'a context strip names what Treehouse detected, one suggestion at a time sits under it, and the page is reorderable sections: Profiles, Lighting (the lit 3D desk — click a device to open it), Quick controls (four up front, the rest behind one button; a tile says why it is here and can be pinned to the front), Devices, Display and Everything else. Desk lighting stays with the desk for now; it does not follow the profile yet.',
              },
              {
                label: 'Dashboard concept',
                note: 'a fixed four-card reading of the home dashboard, to hold beside the concepts our partners are working on. Headset at two thirds with the monitor beside it, then system vitals at one third with last played at two thirds, every card two rows tall and no carousel. Each card is the same widget the real board renders, on the board\'s own column grid, so the comparison is about composition rather than a mock. Open it from the account menu under Admin Panel, next to Metro and Atlas.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Reorderable sections — grip',
                storyId: 'organisms-reorderablesections--docs',
                note: 'the drag grip sits in the page gutter in front of the section label at every width, and stays visible on touch screens.',
              },
            ],
          },
          {
            tier: 'Foundations',
            items: [
              {
                label: 'HyperX OMEN MAX 45L',
                note: 'the desktop and its five parts take their product name, and the tower has a render like the other devices.',
              },
              {
                label: 'Widget row height',
                note: 'one row of the dashboard grid is now a token, so a surface that lays widgets out on the same grid lines up with the board instead of repeating its measurement.',
              },
            ],
          },
        ],
      },
      {
        kind: 'fixed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'System Vitals — narrow cards',
                storyId: 'organisms-widget-gallery--docs',
                note: 'the card ships four gauges wide but can be resized to a third of the board, and below that width its RAM and Network cells ran off the edge and were hidden — silently, with no scrollbar to say so. They now wrap into two rows of two, keeping the temperature and capacity badges, and the gauges take their size from the card so they fit whatever the board gives them.',
              },
              {
                label: 'Device card — photo scale',
                note: 'a keyboard, headset or desktop photo no longer loses its right end on a wide card. Pictures only ever scale down to fit their box now; the mouse keeps reading smaller than the rest.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.26',
    date: 'September 28, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'Profiles get a photo, the monitor section lands with its Mode Bar on the tab strip, and the Dropdown grows a footer action.',
    tasks: ['TH-412', 'TH-413', 'TH-414'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Atoms',
            items: [
              {
                label: 'Avatar — profile photo',
                storyId: 'atoms-avatar--docs',
                note: 'every profile now shows a 24px photo beside its name, in the switcher, its menu, the Profiles modal\'s rail and the profile cards. The app\'s wallpapers are the stock set and follow the theme; an uploaded picture is center-cropped to a small square before it is stored.',
              },
              {
                label: 'Swatch — image',
                storyId: 'atoms-swatch--docs',
                note: 'a chip can carry a picture, chosen the same way as a color, with the same selected halo. The Profiles modal\'s Photo row uses it for the wallpaper choices.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Dropdown — footer action',
                storyId: 'molecules-dropdown--docs',
                note: 'one action row under a rule at the foot of the menu, such as "Add new preset". It joins the keyboard order but never becomes the selection.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Monitor section (Cindy Jung)',
                note: 'desk pictures on one floor with each computer\'s desktop on its screen, viewing-mode tiles with PBP and PIP panes as whole desktops, the X-ray lens with approach and parallax, room light in the Desk card, a Desk widget and display widgets on the board, and displays in the device simulator.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Monitor Mode Bar',
                note: 'the monitor\'s saved unit is now the same grouped dropdown as the profile selector, in the panel\'s tab strip: the desk\'s software profile, then this monitor\'s modes and presets, with "Add new preset" as the footer. The new-preset field, the layout question and the receipt live in the strip\'s right slot.',
              },
              {
                label: 'Monitor canvas',
                note: 'fixed to the window like every other device canvas, its panel anchored to the bottom. The tab body scrolls inside the panel when a tab is taller than the room. Card info tips open downward so the scroll box never clips them.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Profile model',
                note: 'a profile\'s identity is an image, not a color. Saved profiles and old export files migrate their color to the nearest wallpaper on load.',
              },
            ],
          },
        ],
      },
      {
        kind: 'removed',
        tiers: [
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Identity dot',
                note: 'the colored dot beside profile names and the Color row in the Profiles modal. The dot survives only where a captured color value is shown.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.25',
    date: 'September 24, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'The profile selector moves into the device panel\'s tab strip as one grouped dropdown, and the Dropdown finally works from the keyboard.',
    tasks: ['TH-410', 'TH-411'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Dropdown — groups, leading icon, opens up',
                storyId: 'molecules-dropdown--docs',
                note: 'options may sit under muted group headings; an option can carry a glyph that also shows on the trigger while selected; openUp flips the menu above the trigger for controls near the bottom of a surface; disabled is a real prop.',
              },
              {
                label: 'ListBox — ListGroup',
                storyId: 'molecules-listbox--docs',
                note: 'a labelled run of rows under a muted heading, exposed as a group to assistive tech — the divider-for-grouping the list box had been promising.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Ng3Panel — tab strip slots',
                storyId: 'organisms-ng3panel--docs',
                note: 'leading and trailing content beside the centered tool tab. The side tracks are equal, so the tab never leaves the panel\'s centerline whatever they hold.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Dropdown — keyboard operability',
                storyId: 'molecules-dropdown--docs',
                note: 'ArrowDown or ArrowUp opens with focus on the selected row; arrows, Home and End move; Enter or Space picks; Escape closes and returns focus without dismissing a modal around it; only the selected row is a tab stop. The menu is focusable the instant it opens.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Device canvas profile selector',
                note: 'the two-half radio bar above the product image is gone. One dropdown at the panel\'s top-left, inline with the tabs, lists the software profile and the device\'s onboard slots under two headings and opens upward. Picking is still switching; the running slot says so in words. Save, Undo and the status note sit at the top-right of the same strip, which is a fixed height, so the panel never moves. The product image gets the freed band.',
              },
              {
                label: 'Lights panel height',
                note: 'the panel\'s height is now the canvas\'s call rather than a fixed 340. The keyboard keeps 340 to match its Keys tab; the SoloCast matches its Audio tab, so its photo is the same size on every tab.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.24',
    date: 'September 24, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'The SoloCast 2 Pro arrives as the connected mic with a nine-light ring you paint on the photo, and Device Settings becomes one shared card.',
    tasks: ['TH-408', 'TH-409'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Device Settings card',
                note: 'name, firmware, Device Manager and Get Support, the audio credit, and an optional OS hand-off pinned to the card floor. The headset\'s Settings tab and the mic\'s both render this one card; the keyboard\'s hand-rolled copy is the next consumer.',
              },
              {
                label: 'Mic canvas — ring lights',
                note: 'nine lights sit on the product photo at the design\'s positions. Unlit they read as dark glass; lit they carry their color with a glow, and a bloom behind the photo averages them. Click a light, or drag a marquee across several, then a preset or the editor\'s live color paints only the selected lights. Nothing selected paints all nine.',
              },
              {
                label: 'Mic canvas — Audio tab',
                note: 'one Audio tab with feature-gated sections: Headphone Volume with mute, Mic Monitoring as a balance slider, Input Equalizer and Effects in a right column. A Microphone Test button sits over the hero and stops itself after five seconds.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Lights panel',
                storyId: 'organisms-ng3panel--docs',
                note: 'the keyboard\'s Lighting tab is now a standalone panel any device canvas can render. The mic is the first second consumer, with color, preset, brightness and power all living in the profile.',
              },
              {
                label: 'Headset Settings tab',
                note: 'renders the shared Device Settings card in place of its own firmware, buttons and credit rows. No visual change.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Mic tab naming',
                note: 'the microphone\'s lighting tab is titled "Lights" on every mic. Settings keeps its name.',
              },
              {
                label: 'Lit and unlit product photos',
                note: 'a device whose lighting the canvas paints ships two photos. The default colorway shows the lights lit, so every still of the product on cards, the Devices panel and the Light Studio desk reads lit. The canvas loads the unlit photo and paints the lights itself.',
              },
              {
                label: 'Connected microphone',
                note: 'the SoloCast 2 Pro replaces the QuadCast across the board card, Devices panel, Light Studio and Personalize copy.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.23',
    date: 'September 23, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'The Advanced Equalizer speaks in the band\'s color and shows its width; lighting presets stay; long lists scroll instead of growing the panel.',
    tasks: ['TH-404', 'TH-405', 'TH-406', 'TH-407'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Advanced Equalizer — Q anchors',
                note: 'the selected point shows its band\'s edges as two dots on a hairline, one octave-distance either side, from the filter\'s real bandwidth. Drag a dot to set Q; the point, the wheel and Shift+arrows still do it too.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Advanced Equalizer — the band\'s color',
                note: 'nothing is colored until a point is picked: a plain white line, no fill, a quiet parameter bar. Pick one and the line, the fill beneath the curve down to the graph floor, the point\'s ring and the bar\'s outline all take that band\'s color. The app accent no longer appears in the graph; it said "app", not "this band".',
              },
              {
                label: 'Keyboard lighting presets',
                note: 'presets made, duplicated or deleted in the Lighting tab now persist across reloads and travel across profile switches; Edit replaces a preset in place, so a profile that picked it still points at it. Which preset is picked stays a profile setting.',
              },
              {
                label: 'Headset Audio panel — EQ presets',
                storyId: 'organisms-ng3panel--docs',
                note: 'the preset list no longer sizes the panel. The Volume and Mic columns set its height, as in the design; the list fills its section and scrolls, with Add pinned above. Any number of presets, the panel and the product image above it stay put.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Device canvas panel',
                note: 'the bottom panel may shrink to the room the window leaves and hands that constraint to its tab body, so a list that opts in scrolls inside the panel instead of running off the canvas. The hero keeps a floor so the product image never collapses.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.22',
    date: 'September 22, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'The Advanced Equalizer arrives, and profiles now carry everything a keyboard and mouse remember.',
    tasks: ['TH-398', 'TH-399', 'TH-400', 'TH-401', 'TH-402', 'TH-403'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Atoms',
            items: [
              {
                label: 'Stepper',
                storyId: 'atoms-stepper--docs',
                note: 'a numeric field with stacked step buttons. It shows the value with its unit; focusing it exposes the bare number, Enter or blur commits, and the arrow keys step in place. The step can follow the scale, so frequency moves by 1 Hz near 20 Hz and by 100 Hz near 10 kHz.',
              },
              {
                label: 'Button — block',
                storyId: 'atoms-button--docs',
                note: 'fills its container, for a stacked action group such as a rail foot. Replaces three hand-rolled copies of the same three lines.',
              },
              {
                label: 'ToggleButtonGroup — icons',
                storyId: 'molecules-togglebuttongroup--docs',
                note: 'an option may carry an icon, or be icon-only with its label as the accessible name. The filter-type picker is the first consumer.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Advanced Equalizer',
                note: 'a parametric editor beside the Simple one, on the same shell and sharing its preset rail and test bench. Ten fixed bands, each a point you drag for frequency and gain, with filter type, frequency, gain and Q underneath; wheel a point for Q, or drive it all from the keyboard. The curve is the real biquad response, so a shelf looks like a shelf. Bypass keeps a band in place; reset returns it to rest.',
              },
              {
                label: 'Add Equalizer Preset — the chooser',
                note: 'asks Simple or Advanced first, with a still of each editor. One preset list holds both kinds and both show in the headset panel; each editor edits only its own.',
              },
              {
                label: 'Profiles — Export and Import',
                note: 'pinned to the foot of the Profiles rail. Export saves every profile to a file and nothing about this machine; Import merges, updating the same profile in place and adding the rest, and never changes which profile is active.',
              },
            ],
          },
          {
            tier: 'Foundations',
            items: [
              {
                label: 'EQ band colors',
                note: 'ten ordered hues, one per parametric band, so the points read as a series in either theme.',
              },
              {
                label: 'Filter-shape icons',
                note: 'low pass, high pass, peak, low shelf and high shelf join the sprite. Two are the design exports; three are drawn in the same stroke pending exports.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Profile Details',
                note: 'on the design\'s card structure: a device card with the type glyph and caps name, and a sunken sub-card per tab with its icon, a rule and name/value rows. A captured color shows as a dot; painted keys and assignments are counted in the device\'s own unit.',
              },
              {
                label: 'Profiles rail',
                note: 'the list scrolls between a fixed New Profile and the pinned file actions, so the window\'s height no longer decides how many profiles can exist.',
              },
              {
                label: 'Keyboard and mouse in profiles',
                note: 'per-key lighting, the picked lighting preset, key assignments and mouse button assignments now belong to the active profile and follow it, like every other captured setting.',
              },
              {
                label: 'Ng3Label — tooltip',
                note: 'the info glyph is a real trigger now: pass `tooltip` and it explains the section on hover or focus, the same trigger an Input uses.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'American English',
                note: 'color, center, behavior, labeled, gray and dialog everywhere — UI copy, comments, CSS, docs and this changelog.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.21',
    date: 'September 22, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'The Profiles modal tightened up, and the two pieces of modal chrome it was missing now belong to the system.',
    tasks: ['TH-397'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Templates',
            items: [
              {
                label: 'ModalShell — footer band',
                storyId: 'templates-modalshell--docs',
                note: 'the footer slot now has a look of its own: a padded band with a top rule, pinned under the body so commit actions stay reachable however long the content is. The band owns the spacing and the separator; whatever is placed inside carries none. Until now only the Performance modals styled it, each on their own.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Sectioned settings chrome',
                note: 'the Settings modal\'s rail-and-groups treatment — the 230px rail, static mono-caps group headers, group padding — is a shared class any settings-style modal opts into, the way feature modals already share theirs. Profiles is the second consumer. Below phone width the rail becomes a row above the content and a settings row stacks its control under the labels.',
              },
            ],
          },
        ],
      },
      {
        kind: 'fixed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Profiles modal',
                note: 'it was riding the raw modal shell: a third-width rail, body-text group headers that lit up on hover but did nothing, no breathing room under the last row of a group, and Delete and Activate sitting on the modal\'s edge. It now matches Settings row for row. The two expanders — game picker and Profile Details — share one disclosure style and announce what they control, and New Profile lines up as the first entry of the list.',
              },
              {
                label: 'Settings modal',
                note: 'collapses to one column at phone width instead of squeezing every sublabel to a word per line.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.20',
    date: 'September 18, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Profiles become a real axis: settings can belong to what you are doing, not just to the app.',
    tasks: ['TH-385', 'TH-386', 'TH-387'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Foundations',
            items: [
              {
                label: 'Software profiles — overrides on a baseline',
                note: "a profile states only what it cares about; every unset key falls through to the app setting underneath. Resolution happens inside the settings layer, so a consumer reads the value the app is actually running without knowing profiles exist. Writes still land on the baseline — a profile's own values are edited as overrides.",
              },
              {
                label: 'Profile triggers — the latest intent wins',
                note: 'a profile can be switched by hand, by a schedule window, or by launching a linked game. A game beats an open schedule, because on a gaming PC starting a game is the loudest statement of intent there is. Quitting hands you back — but only if the game is still what is reigning, so a profile you picked mid-game survives the game closing.',
              },
              {
                label: 'Captured device settings',
                note: 'what you change in a device panel now belongs to the active profile, in the same shape an onboard slot holds. The two halves of the device profile bar finally hold the same kind of thing, one in software and one in hardware.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Profiles modal',
                note: 'names a profile, gives it a color, sets the app appearance it takes over, and declares what turns it on. Selecting a profile in the list EDITS it — activating is its own act, so you can fix the Work profile at 9pm without the desk changing color.',
              },
              {
                label: 'Profile Details',
                note: 'a read-only manifest of what a profile has captured, one card per device and one group per device tab. Derived, never authored: a device that grows a tab gets a group here for free. Values are set where they live — in the device panel — so this stays a record rather than a second place to change them.',
              },
              {
                label: 'Profile switcher',
                note: 'the active profile in the top nav, left of the account avatar. When a profile switched itself it says so, because automation you cannot see is how an app starts feeling haunted.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Scope-backed settings',
                note: 'a device setting reads and writes the active scope instead of local component state, with a call site shaped exactly like the `useState` it replaces. Keys are namespaced by the tab that owns them, which is what lets the profile manifest group itself.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Account menu',
                note: 'renamed from "profile". Everything in it is about the signed-in account — identity, sign out, admin — and the app\'s profiles are a different concept that now sits beside it. Two adjacent controls called "profile" would have taught the wrong model.',
              },
              {
                label: 'Settings — Appearance',
                note: 'a row the active profile has taken over now says so, and offers the one gesture that hands it back. The rows show the baseline they edit rather than the resolved value, so an overridden control never looks unresponsive.',
              },
            ],
          },
          {
            tier: 'Pages',
            items: [
              {
                label: 'Personalize — Profiles',
                note: 'the profile list, what turns each one on, and how much app appearance it claims. Personalize is otherwise about the desk rather than the app; profiles span both, which is the point of them.',
              },
            ],
          },
          {
            tier: 'Templates',
            items: [
              {
                label: 'Device panels — what travels',
                note: 'mouse sensor, keyboard control mode and lighting power, the whole headset audio/spatial/settings surface, every mic control, and all spec-sheet device settings now travel with the profile instead of resetting when the panel closes. Several had been uncontrolled dropdowns that persisted nothing at all. Mute is deliberately excluded — it is live status, and a profile that muted you on activation would be a bug.',
              },
            ],
          },
        ],
      },
      {
        kind: 'fixed',
        tiers: [
          {
            tier: 'Foundations',
            items: [
              {
                label: 'Concurrent setting writes',
                note: 'two settings changed in the same moment clobbered each other — the merged value was built from a stale copy, so the first write vanished silently. Merging happens in the store now, so writes compose. Invisible while only two controls in the app were wired; a real data-loss bug the moment more were.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.19',
    date: 'September 5, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'The light theme becomes a measured system rather than an assumption; device panel tabs name themselves.',
    tasks: ['TH-377', 'TH-378', 'TH-379', 'TH-380', 'TH-381', 'TH-382', 'TH-383', 'TH-384'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Foundations',
            items: [
              {
                label: 'Scrim scale — --scrim-soft / --scrim / --scrim-strong',
                note: 'a veil laid OVER content, not a surface sat under it. The system had no themed way to say that, so overlays reached for raw black-alpha while their ink followed the theme — a lock message and two headset stage labels were sitting at 1.01–2.48:1. Reach for a scrim whenever text has to hold over artwork or a live canvas.',
              },
              {
                label: '--surface-sunken',
                note: 'the one surface that reads DARKER than the ground it sits on. It cannot be expressed on the white ladder, which is exactly why consumers were reaching past the tokens to a raw value — and why it stopped flipping in light.',
              },
              {
                label: '--ksg-canvas-surface',
                note: "a full-bleed device modal's ground. Distinct from the panel surface because a canvas stays translucent enough to read the blurred app through it; a panel does not.",
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Ng3Tool',
                storyId: 'molecules-ng3tool--docs',
                note: "a tool in a device panel's tab strip. The icons carry no label, so the name has to arrive on demand: one `title` prop feeds both the accessible name and the tooltip, which is what keeps the two from drifting. Every device canvas was hand-rolling this button; they now share one.",
              },
            ],
          },
          {
            tier: 'Atoms',
            items: [
              {
                label: 'Swatch — "Wide"',
                storyId: 'atoms-swatch--docs',
                note: 'the chip fills its row instead of taking a fixed width. For a swatch in a column that resizes with its container — `width` still makes a fixed pill, and an inline width would beat the class and defeat the sizing this variant exists for.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Foundations',
            items: [
              {
                label: 'Light theme — the text and color ramps',
                note: 'the light ramp was inverted rather than merely weak: muted rendered DARKER than dim, so fixing the alphas alone would have widened the fault. Both sit on the black ladder now (primary 9.6 · dim 5.9 · muted 5.0). The semantic colors — cyan, green, red, purple, orange, yellow, blue and their -dim partners — had no light values at all and were running as low as 1.2:1; each is now held at its own saturation and darkened to the lightest value that clears 4.5:1 both on a plain surface and on its own tint. A saturated hue cannot stay vivid and be legible as ink on light: yellow necessarily lands as an olive.',
              },
              {
                label: 'Surfaces that never flipped',
                note: 'components were consuming raw palette primitives as surfaces, and primitives do not flip — so the ground stayed dark while the ink flipped to black. Device canvases, chips, carousels and the spec/profile chrome now take semantic surfaces. Every swap was chosen to be an exact no-op in dark, so nothing moved there.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Device panel tabs',
                storyId: 'organisms-ng3panel--docs',
                note: 'each tab now names itself on hover and on keyboard focus. The tab is a chamfered shape that clipped anything reaching outside it, so the panel draws its trapezoid differently to let the label out — the shape is unchanged.',
              },
              {
                label: 'Lights preset editor',
                note: "rebuilt on the system's own parts — sections, list rows, color sliders, swatches and buttons — in place of hand-rolled markup, and measured back against its reference. The opacity track was a plain gradient, so a transparent color looked solid; it carries the checkerboard now. Selection is announced rather than shown only in color, and the editor holds no inline icons.",
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Device card — battery at small sizes',
                note: 'the battery reading steps aside on short footprints (2×1 and wider single-row cards), where nothing reserves space for it and it lands on the device name. The compact square launcher tile keeps it — there it sits over the photo with the corner free, and it is the tile’s whole point.',
              },
            ],
          },
        ],
      },
      {
        kind: 'fixed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Carousel aura',
                storyId: 'organisms-carousel--docs',
                note: 'the glow behind the carousel read as a milky, clipped wash in light. It is a blend problem, not a brightness one: over a dark ground the blurred art ADDS light, which is the glow, but over a light ground there is no headroom left so it climbs toward white. In light it multiplies instead, tinting with the slide’s hue — dimming it had simply removed the effect. It also fades on all four sides now rather than ending in a straight cut at the edges.',
              },
            ],
          },
        ],
      },
      {
        kind: 'deprecated',
        tiers: [
          {
            tier: 'Foundations',
            items: [
              {
                label: '--text-subtle',
                note: 'not for text, in either theme — measured at 2.27:1 dark and 2.36:1 light, so this was never a light-theme bug. All 98 consumers have moved off it, and none of them turned out to be a disabled or placeholder state where low contrast is legitimate. The token stays defined, because the ramp is also the Avalonia and Figma spec, and is annotated in place.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.18',
    date: 'September 2, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Headsets get an equalizer you can build presets in, a rebuilt Settings panel, and panels that size themselves to the tab.',
    tasks: ['TH-371', 'TH-372', 'TH-373', 'TH-374', 'TH-375'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Simple Equalizer',
                note: '"Add Equalizer Preset" on the headset Audio panel now opens an editor. Name a preset, drag five or ten bands between \u00b112 dB, and it joins the panel\'s list beside the factory presets \u2014 and survives a reload. The band count belongs to the preset, so switching 5 \u21c4 10 resamples the curve you drew rather than flattening it, and the five named ranges (Bass through Highs) split rather than being replaced. Each preset row carries Rename, Duplicate, Reset and Delete behind its own menu.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'VerticalSlider \u2014 "Center"',
                storyId: 'molecules-verticalslider--docs',
                note: 'a bipolar rail: zero is the middle, the fill grows out from a notch toward the handle, and the sign carries meaning. This is what an equalizer band wants \u2014 a rail filled from the floor makes a flat 0 dB band read as half-loud. The vertical twin of BalanceSlider.',
              },
              {
                label: 'ToggleButtonGroup \u2014 "Full Width"',
                storyId: 'molecules-togglebuttongroup--docs',
                note: 'the pill spans its container and the options share the width evenly. For a group that IS the control in its row; the default content width stays right where the group sits beside other content and should read as a chip.',
              },
              {
                label: 'Ng3Section \u2014 "as"',
                storyId: 'molecules-ng3section--docs',
                note: 'render a section as a different element, so one that is a real landmark (a complementary rail, a standalone region) can say so instead of trading semantics for the system\'s look. Styling is identical \u2014 reach for it when the element carries meaning, never to vary appearance.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Ng3Panel \u2014 "Narrow"',
                storyId: 'organisms-ng3panel--docs',
                note: 'panel measure, `full` or `narrow`. Width is information: a dense tab earns the full measure, a sparse one reads better held in. Device panels drive it from the active tab, so it is a property of the tab rather than of the canvas, and panels ease between measures rather than snapping.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Headset Settings',
                note: 'rebuilt \u2014 a device rail carrying identity, firmware, Device Manager / Get Support and the audio-partner credit, over Auto Power-Off; beside it the notification mode, what that mode does, and the Windows Sound Devices hand-off. Every row is device data, so a headset without a battery simply has no Auto Power-Off rather than empty chrome. Firmware is a real per-device value now instead of a number written into the page.',
              },
              {
                label: 'Device panel tabs',
                note: 'the selected tab fills its icon\'s interior as well as brightening it. Hover and selected used to look identical, so while hovering one tab you could not tell which one you were actually on. Selection no longer rests on color alone.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Ng3Section \u2014 the last card fills its column',
                storyId: 'molecules-ng3section--docs',
                note: 'the last section in a column grows to fill it, so a device panel reads as a filled frame rather than cards floating on a floor. Set `flex` on a column\'s sections explicitly if you want a proportional split instead.',
              },
            ],
          },
        ],
      },
      {
        kind: 'fixed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Keys & Macros',
                note: 'the tab\'s two halves had drifted off the shared section card \u2014 a heavier border, a wider surface tint, 24px side padding against the system\'s 16, and a 16px gutter against the system\'s 8. They are the real thing now, so the panel matches every other device tab and the card is defined in one place.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Conventions',
            items: [
              {
                label: 'The icon sprite is XML',
                note: '`shared/icons.svg` is parsed as XML. One literal angle bracket anywhere in it \u2014 inside a CSS comment included \u2014 invalidates the file, and every icon in the app silently stops rendering with nothing in the console.',
              },
              {
                label: 'backdrop-filter contains fixed positioning',
                note: 'an element with `backdrop-filter` becomes the containing block for its `position: fixed` descendants, not merely a stacking context. A floating menu inside a blurred panel has to be portalled out, or perfectly correct viewport coordinates render about a hundred pixels off.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.17',
    date: 'September 2, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Shadows realign with the Avalonia app, device panels stop leaving holes, and Cloud III gets its Spatial Audio tab.',
    tasks: ['TH-368', 'TH-369', 'TH-370'],
    groups: [
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Atoms',
            items: [
              {
                label: 'Shadows — the elevation scale',
                storyId: 'atoms-shadows--docs',
                note: 'every level is now a single-layer drop matching the HP/Avalonia `ShadowLevel` dictionary value-for-value, so Treehouse and the Avalonia app render the same depth. The two-layer Kintsugi shadows (a tight contact shadow under a wide ambient one) are gone: cards, popovers and device panels read as a defined drop rather than a diffuse halo. Light theme keeps the softened alphas — same geometry, less ink, because depth on a dark page is a smudge on a light one. There is now exactly one definition per theme; if you need elevation, reach for a level rather than hand-rolling a `box-shadow`.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Ng3Section — surface and label',
                storyId: 'molecules-ng3section--docs',
                note: 'panel sections sit on a quieter surface with a lighter border, and section labels step up a size and to primary text color — so the label reads as the heading of its group rather than a caption above it.',
              },
            ],
          },
        ],
      },
      {
        kind: 'fixed',
        tiers: [
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Ng3Section — the last card fills its column',
                storyId: 'molecules-ng3section--docs',
                note: 'a device panel read as a stack of cards floating on a floor: every column stopped wherever its content ran out. Columns already stretched to the panel height — the slack was landing inside them, leaving a hole under the bottom card. The last section in a column now grows to fill it, so every column bottoms out on the same line. Set `flex` on a column\'s sections explicitly if you want a proportional split instead.',
              },
            ],
          },
          {
            tier: 'Atoms',
            items: [
              {
                label: 'Shadows — level 3',
                storyId: 'atoms-shadows--docs',
                note: 'level 3 referenced an alpha rung that does not exist, so it had been silently rendering from its inline fallback rather than from the scale.',
              },
            ],
          },
        ],
      },
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Device panels — Cloud III spatial audio',
                note: 'Cloud III now carries its Spatial Audio tab, between Audio and Settings, matching its wireless sibling. The surround mix is rendered on the PC, so being the wired model was never a reason to lose it.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Shadows: the token leads, not the frame',
                note: 'Figma\'s `Shadow-Blur/Panels/Dark` was `--shadow-lv-1` exactly when the keyboard quick-select rail was built. After this re-issue it is not. Components follow the token; the Figma side is what needs reconciling.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.16',
    date: 'August 19, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Perform becomes the V7 page, modals learn to be narrow, and the app opens on a quieter first screen.',
    tasks: ['TH-359', 'TH-360'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Templates',
            items: [
              {
                label: 'ModalShell — width, header control, footer',
                storyId: 'templates-modalshell--docs',
                note: 'three optional slots, all opt-in — every existing modal renders exactly as before. `width="narrow"` caps the shell so a modal about a single subject stops spanning the window: a wide shell says there are parts to navigate between, a narrow one says there is one subject. A header control sits at the right-hand end of the title row when something governs the whole modal, and a footer slot holds the actions that close it.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Keyboard lighting — custom select',
                note: 'the lighting rail leads with a marquee tool: arm it and drag a box across the board to select every key it crosses. Shift-drag adds to the selection, a press without a drag still toggles the single key under it, and Escape puts the tool away without closing the device. It covers the selections the WASD/QWER/Numbers presets do not.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Pages',
            items: [
              {
                label: 'Performance',
                note: 'the page is now the V7 design at scope 1.0 — Monitoring, Performance and Maintenance as three posture domains, Power Mode anchoring its own row, and the optimizer family (OMEN AI, Booster, Network Booster) beneath it. The page it replaced is still reachable at /perform-v1, and /perform-v7 keeps the simulator rig for exploring the other scopes. Worth knowing: the V7 page is one fixed composition, so Performance no longer varies by the stored persona the way the previous page did.',
              },
            ],
          },
          {
            tier: 'Foundations',
            items: [
              {
                label: 'First-landing defaults',
                note: 'a new install now opens icon-only in the nav, on the blue wallpaper, with a five-widget board — the four device cards plus Last Played — instead of the full catalog. A board that starts sparse reads as something to build rather than something to prune, and everything else is one click away in the widget gallery. Any saved layout still wins over the default.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Profile bar — the onboard note',
                note: 'the confirmation under the bar now retires itself after about five seconds. It says how the device got onto this slot, which stops being news — and the bar keeps carrying the standing state (the kicker, the running dot, "Running" in the slot list), so nothing is lost when it goes. It fades in place rather than unmounting, so the hero below never moves on a timer. The unsaved-changes warning never retires: it is actionable and belongs with its buttons.',
              },
              {
                label: 'ReorderableSections',
                storyId: 'organisms-reorderablesections--docs',
                note: 'a section that disappears and comes back now returns to its canonical position instead of the bottom of the page. Reordering is still remembered; only the placement of sections the saved order has never seen changed.',
              },
            ],
          },
        ],
      },
      {
        kind: 'fixed',
        tiers: [
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Alpha tokens do not flip with the theme',
                note: 'worth knowing before you reach for one: the white and black alpha scales are fixed ink, not theme-aware. White 10% on a surface that flips with the theme vanishes in light mode — which is what happened to a hairline divider on a panel that does flip. Either use a themed border token, or pair the alpha value with a light-theme override the way the text field does.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.15',
    date: 'August 18, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Selecting an onboard slot switches the device to it — and Light Studio is lit, with two devices that were silently missing.',
    tasks: ['TH-354', 'TH-358'],
    groups: [
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Profile bar',
                note: 'selecting an onboard slot now switches the device to it, and selecting the software half hands the device back — there is no preview state and no separate “Activate on device” step. What you are looking at and what the hardware is running are one fact rather than two that can disagree. The consequence is deliberate: you can no longer inspect a slot without putting the device on it, and opening a device lands on the slot it is running rather than on the software profile. Saving to a slot is still its own act — switching is free, writing flash is not. A disconnected device disables the whole bar.',
              },
              {
                label: 'Last Played widget',
                storyId: 'organisms-widget-gallery--docs',
                note: 'the game title takes the RBNo3.1 display face, matching the carousel title, the Module Browser card names and the device-card title. Titles across the system read as one family.',
              },
            ],
          },
          {
            tier: 'Pages',
            items: [
              {
                label: 'Light Studio — the devices',
                note: 'the keyboard is built in the scene rather than loaded as a model — a 65% layout with real row stagger and keycaps floating above an emissive plate, so light bleeds up through the gaps the way a real board does. The tower sits to the right of the monitor and now answers the RGB controls, which it never did: its glowing fans were baked into the model with nothing tagged for the RGB system, so it rendered lit and ignored every setting. The monitor gains bias lighting on its back.',
              },
            ],
          },
        ],
      },
      {
        kind: 'fixed',
        tiers: [
          {
            tier: 'Pages',
            items: [
              {
                label: 'Light Studio',
                note: 'the scene was dark partly because half of it was never loading — the tower and the headset failed to decode, the failure was swallowed, and they were simply absent from a scene that otherwise looked fine. Both are back, and the room is lit: exposure and every light raised, a new overhead light for the desk surface. The surfaces were the bigger half of it — desk, floor, wall and chassis were all near-black, so no amount of light was going to help.',
              },
            ],
          },
        ],
      },
      {
        kind: 'removed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Profile bar — slot bindings',
                note: 'the “Keep on Slot X in <profile>” binding is gone, along with the Activate button and the preview state around it. A software profile no longer has an opinion about onboard slots, so switching profiles leaves a device on whatever slot it is running. Any persisted bindings are dropped on load.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.14',
    date: 'August 14, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'The device card’s battery reads as a battery again.',
    tasks: ['TH-357'],
    groups: [
      {
        kind: 'fixed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Device card — battery',
                storyId: 'organisms-widget-gallery--docs',
                note: 'the battery rendered as one solid block of color instead of an outline with a level bar. The battery icons color themselves — only the level bar takes the status color — so the card must leave the casing neutral. If you place one of these icons, set no color on it and let it be.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Battery level — the urgency ladder',
                note: 'worth knowing before you touch these icons: they escalate in two steps. Down to 20% the casing stays neutral and only the bar changes color (green → yellow → red); at 0–10% the whole icon goes red, deliberately, for urgency at critical charge. That last step only works while the levels above it stay neutral, so a status color applied over the whole icon breaks it rather than reinforcing it.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.13',
    date: 'August 13, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'A density setting for the whole app, and buttons that know they are sitting on artwork.',
    tasks: ['TH-355', 'TH-356'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Foundations',
            items: [
              {
                label: 'Density — Comfortable / Compact',
                note: 'Settings › Appearance now offers a spacing density. Compact re-points the page gutter from 24px to the 12px step; Comfortable is the default and is unchanged. It is a single token re-point, so every padding, margin and gap in the system follows automatically and no component needs a density-aware rule. Build with the gutter tokens and your screen gets this for free. Note the smaller steps deliberately do not scale — page whitespace tightens, component internals keep their rhythm.',
              },
            ],
          },
          {
            tier: 'Atoms',
            items: [
              {
                label: 'Button — On Image',
                storyId: 'atoms-button--docs',
                note: 'a variant for CTAs sitting on artwork. Photography is dark in both themes, so this holds the dark treatment instead of following the page — without it a light-theme page paints near-black label text onto a dark photo. Reach for it any time a button sits over an image rather than a surface.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Carousel',
                storyId: 'organisms-carousel--docs',
                note: 'the slide CTAs are design-system Buttons now — an accent primary beside an on-image secondary, matched in height and type — instead of a private button style of their own.',
              },
            ],
          },
        ],
      },
      {
        kind: 'removed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Carousel — private button style',
                note: 'the carousel’s own button class and its three variants are gone, taking four hardcoded color values with them. Slide CTAs use the Button component like everything else.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.12',
    date: 'August 12, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'The device profile bar becomes two halves — one for each kind of place a setting can live.',
    tasks: ['TH-353'],
    groups: [
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Profile bar',
                note: 'the device’s onboard slots collapse into a list on the right half, so the bar is a 50/50 read of the software profile against onboard memory instead of a run of up to six equal-looking options. A mouse has five slots, which overflowed the bar and made the software profile look like the sixth member of a set. The onboard half is a split control: its body selects the slot on show, its chevron opens the list. Collapsing costs nothing in truth — while the software profile is selected the half displays whichever slot the hardware is actually running, dot and all, and the list names the running slot in words.',
              },
            ],
          },
          {
            tier: 'Molecules',
            lead: 'Composed rather than forked, for the slot list:',
            items: [
              { label: 'ListBox', storyId: 'molecules-listbox--docs', note: 'now carries a popover as well as an inline list.' },
              { label: 'ListItem', storyId: 'molecules-listitem--docs', note: 'the trailing slot carries the “Running” marker.' },
            ],
          },
        ],
      },
      {
        kind: 'fixed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Profile bar',
                note: 'Escape inside the slot list dismisses the list instead of closing the whole device modal, and the bar no longer breaks the rules of hooks on devices that have no onboard memory.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Popovers on blurred surfaces',
                note: 'a surface with backdrop-filter is a stacking context, so a popover inside it can never paint above a later sibling however high its z-index — the blurred surface itself has to outrank the sibling. Worth knowing anywhere a menu opens out of a glassy bar.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.11',
    date: 'August 10, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'The Play hero rail drops its bespoke button for the DS pair, and wide page grids go single-column.',
    tasks: ['TH-351'],
    groups: [
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Pages',
            items: [
              {
                label: 'Play',
                note: 'the hero rail footer now uses design-system Buttons: an accent Play with the play-fill icon, plus a default “Go to My Games” that smooth-scrolls to the library section. The friends-playing block is parked — hidden, not deleted — until the social layer returns, and the action row stays anchored right either way.',
              },
              {
                label: 'Wide page grid',
                note: 'the wide page grid is now a single full-width column instead of a 200px auto-fill track. Affects Personalize, Perform, and the device overview.',
              },
            ],
          },
        ],
      },
      {
        kind: 'removed',
        tiers: [
          {
            tier: 'Pages',
            items: [
              {
                label: 'Play',
                note: 'the one-off rail play-button styling — hand-rolled padding, border, shadow, and hover lift — is gone; the DS Button owns those states now.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.10',
    date: 'August 6, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'The sectioned-modal pattern becomes shared DS chrome, and app appearance moves home to Settings.',
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Modal side nav',
                note: 'the Module Browser’s left-rail section switcher is now a shared component (.ds-modal-nav) — icon + label items with an optional footer, for any sectioned modal. Promoted with tokenized spacing/motion and a visible focus ring.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Pages',
            items: [
              {
                label: 'Settings',
                note: 'rebuilt on the sectioned modal: left nav with Appearance, Navigation, and Setup. Appearance (theme, accent color, wallpaper) moved here from the Personalize page — app appearance belongs in the app’s settings; Personalize is now about the desk (lighting, modules).',
              },
              {
                label: 'Module Browser',
                storyId: 'pages-module-browser--docs',
                note: 'unchanged look, now on the shared modal side nav instead of private styles.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.9',
    date: 'August 5, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'Nav tooltips earn their place: shown only when the nav is icons-only.',
    groups: [
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Menu',
                storyId: 'organisms-menu--docs',
                note: 'tooltips render only while labels are hidden — a tooltip repeating a visible label is redundant, so with labels showing the prop is a no-op. Icon-only nav keeps the tooltip and the accessible name, with no doubled native title.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.8',
    date: 'August 4, 2026',
    committer: 'Cindy Jung · Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'The monitor section lands: a task-oriented monitor modal IA, the rich Treehouse 32 card, and KVM fixes.',
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Foundations',
            items: [
              {
                label: '--control-height-sm',
                note: 'small-control height (28px) is now a real token — small buttons size correctly everywhere, not only on the Perform page.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Monitor modal IA',
                note: 'monitors now use a task-oriented, feature-gated roster — Overview · Connectivity · Display · Utilities · Audio. Color folds into Display, KVM into Connectivity, Settings becomes Utilities; tabs a monitor can’t use don’t appear (OMEN OLED 27 gates to three).',
              },
              {
                label: 'Desk map, two lenses',
                note: 'the monitor hero shows the desk as it is (drag to match your desk, Identify); Extend/Mirror and edge-exact placement live in the dedicated Arrange editor.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Treehouse 32 rich device card',
                storyId: 'organisms-widget-gallery--docs',
                note: 'the concept monitor’s board card carries size-tier density — mode, picture preset, connection and AI-managed sliders inline — and its shortcuts drop tabs the card face already controls. Gated to Treehouse 32 while density-as-a-card-capability is settled.',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Atoms',
            items: [
              {
                label: 'Slider',
                storyId: 'atoms-slider--docs',
                note: 'grew an opt-in gradient fill marking AI-managed controls (prototype — will formalize as a managed variant paired with a non-color cue).',
              },
            ],
          },
        ],
      },
      {
        kind: 'fixed',
        tiers: [
          {
            tier: 'Conventions',
            items: [
              {
                label: 'KVM switching',
                note: 'the hotkey caveat now follows the hotkey you chose (it was hardcoded to Ctrl ×2), and auto-switch on input change ships OFF — switching input is something you trigger, not something that fires itself.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.7',
    date: 'July 30, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Storybook becomes the catalog of record: atomic-design taxonomy, story repairs, and the switched-off convention.',
    groups: [
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Sidebar taxonomy',
                note: 'every story recategorized to atomic design — Atoms → Molecules → Organisms → Templates → Pages, in that order, alphabetical within each tier. Foundations (Icons, Shadows, Typography) live under Atoms.',
              },
              {
                label: 'Switched-off is not disabled',
                note: 'a feature region toggled off keeps full color and stays operable (curate lighting presets with the lights off, pick EQ presets with EQ off — edits apply when the feature returns). Only LOCKED regions dim and desaturate; the lights-off state now shows on the device hero instead.',
              },
            ],
          },
          {
            tier: 'Molecules',
            lead: 'Locked-only-dims rule applied to:',
            items: [
              {
                label: 'SoftwareOnly',
                storyId: 'molecules-softwareonly--docs',
                note: 'locked is the only state that dims; docs and overlay copy updated.',
              },
              {
                label: 'StatusOverlay',
                storyId: 'molecules-statusoverlay--docs',
                note: 'the centred message is now exclusively the locked-region signal.',
              },
            ],
          },
        ],
      },
      {
        kind: 'fixed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Widget Gallery',
                storyId: 'organisms-widget-gallery--docs',
                note: 'crashed on missing app contexts and showed 4 hand-picked widgets — now renders all 25 from the board registry, grouped by category, at real board sizes.',
              },
              {
                label: 'Widget Board',
                storyId: 'organisms-widget-board--docs',
                note: 'renders with the full app provider stack; drag, resize, add and remove all work in the story.',
              },
              {
                label: 'GameTileMenu',
                storyId: 'organisms-gametilemenu--docs',
                note: 'the ••• menu opened off-screen on the Docs page; it now renders in its own frame there and anchors correctly.',
              },
            ],
          },
          {
            tier: 'Templates',
            items: [
              {
                label: 'ModalShell',
                storyId: 'templates-modalshell--docs',
                note: 'demo sections rendered empty (the fixed-position overlay escaped the story block); both variants now show framed, with the open transition on a control.',
              },
            ],
          },
        ],
      },
    ],
  },
];
