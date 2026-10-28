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
    version: '0.2.47',
    date: 'October 28, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Nova gets a floating door — a corner button that opens the chat as a resizable window and shows when it is thinking — and a fourth agent, Autocast, that records a game session and hands back the clips. A recipe can now pitch a skill Nova does not have yet, and tell a story in stages.',
    tasks: ['TH-507', 'TH-508', 'TH-509'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Atoms',
            items: [
              {
                label: 'Fab',
                storyId: 'atoms-fab--docs',
                note: 'the floating action button: round, raised, accent-filled, placed by its host over the page. `busy` runs a ring — an accent track with a HyperX-red streak orbiting it; `open` crosses its two faces; `badge` is the unread dot. Still under reduced motion.',
              },
              {
                label: 'ResizeHandle — top and bottom edges',
                storyId: 'components-resizehandle--docs',
                note: 'sizes a height as well as a width: a horizontal splitter along the edge, ↑/↓ on the keyboard, Home/End for the limits.',
              },
            ],
          },
          {
            tier: 'Pages',
            items: [
              {
                label: 'Nova — Floating entry',
                note: 'Admin → Nova entry → Floating: a corner button opens Nova as a chat window over the page, grown from the button on a spring and reserving no width. Resizable from its left and top edges with its own remembered size; Minimize tucks it back. The header says Ready / Thinking… with a scan line while a reply comes; a reply that lands while minimized badges the button; toasts lift above it.',
              },
              {
                label: 'Autocast',
                note: 'a Nova agent — a Forge skill, not added by default. Ask for highlights from your next game and Nova says it needs Autocast and offers it; adding it from the chat is Forge’s own Add. The game launches, a live card counts the session and the moments marked, the clips are cut and land as tiles to watch, approve or discard in a player. Approved clips go to your Gallery; nothing posts or leaves the PC.',
              },
              {
                label: 'Gallery — your own captures',
                note: 'what you approved appears first on Play → Gallery and in a game’s detail panel, by You.',
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
                label: 'Nova recipe manifest',
                note: 'a recipe can pitch itself before it is added (what Nova says, as Nova), take a typed line as the press (“yes”, “end session now”), carry a story on in stages in the conversation the request was made in, and put a word on the panel’s status line. Forge’s Autocast AI listing is that agent now — Skill 1.4.0.',
              },
            ],
          },
          {
            tier: 'Foundations',
            items: [
              {
                label: 'Tokens',
                note: '`--control-height-fab` is the floating button’s size, read by everything that clears it; the toast stack lifts over whatever a host puts in the corner (`--ds-toast-stack-bottom`).',
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
                label: 'Game detail panel — Play keeps its height',
                note: 'a short window squeezed the panel’s sections before its body scrolled, and Play went first, to a line. Nothing in the scrolling body shrinks now; the right-hand rails also end above the floating button instead of under it.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.46',
    date: 'October 27, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'A hub for every game: a detail panel with collections, gallery, info and the actions your agents and modules bring. Nova gains Who Made This, every agent story is switched by Forge, and Play gets a third layout.',
    tasks: ['TH-501', 'TH-502', 'TH-503', 'TH-504', 'TH-505', 'TH-506'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Atoms',
            items: [
              {
                label: 'Avatar — Initials',
                storyId: 'atoms-avatar--docs',
                note: 'a two-letter monogram for a person with no photo; the name stands beside it, so the letters are decorative.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Disclosure',
                storyId: 'molecules-disclosure--docs',
                note: 'a collapsible section over the settings-group accordion — collapsed by default, a keyboard header with aria-expanded, and a compact density for narrow columns.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'LeadTile',
                storyId: 'organisms-leadtile--docs',
                note: "the wide tile that leads a row of covers: the cover held right under a theme-following veil, the title, facts and Play. Takes its row's height and the width the grid spans it.",
              },
            ],
          },
          {
            tier: 'Pages',
            items: [
              {
                label: 'Game detail panel',
                note: "one game's hub in the right rail (Devices' slot and width): the cover blurred behind the tile, Play, its collections, its gallery, Info, and Actions — rows the added agents and installed modules contribute for that game, each gone with its owner. A library tile now opens it; the tile's ▶ plays.",
              },
              {
                label: 'Collections',
                note: "named lists of games, Favorites among them (now kept across reloads). Chips in the library, a Collections group and New collection… in a tile's ••• menu.",
              },
              {
                label: 'Who Made This',
                note: 'a Nova agent: who voices a game and who made it, and what else each of them worked on — the cast in billing order, the crew by department, your own games called out.',
              },
              {
                label: 'Play layout — Featured',
                note: 'a third top for Play (Admin › Play layout): the most recent game as a lead tile saying when you last played and for how long, then the next three as covers.',
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
                label: 'GameTile — Play button',
                storyId: 'organisms-gametile--docs',
                note: "with onPlay the hover ▶ is a real button that launches, apart from the tile's own press; it shows on keyboard focus too.",
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Forge switches agent stories',
                note: 'removing an agent in Forge stops it answering in Nova and takes its entry points and warnings with it. The built stories — Catch Me Up, Did I Just Waste My Money, Who Made This — are added on a first run.',
              },
              {
                label: 'Per-game actions',
                note: "an agent or module adds rows to a game's panel through one contract instead of a button of its own on each surface.",
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
                label: 'My Games reorder handle',
                note: 'sits level with the section label instead of a row above it.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.45',
    date: 'October 26, 2026',
    committer: 'Chris Meyer, Junchao Yang',
    reviewer: 'Chris Meyer',
    summary:
      'The PC is a device: the computer the app runs on gets its own page — lighting, cooler cap, power supply, fans, macros. Plus a cleaner default dashboard, and native scrollbars that follow the theme.',
    tasks: ['TH-498', 'TH-499', 'TH-500'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'DeviceCard — parts',
                note: 'one line per part with a window of its own (the desktop\'s cooler cap): a way in, not a setting, so ⋮ › Customize does not choose it.',
              },
            ],
          },
          {
            tier: 'Pages',
            items: [
              {
                label: 'This PC',
                note: 'the desktop or laptop the app runs on has its own page — chassis lighting by zone on a 3D tower, the cooler cap screen, the power supply, fans, macros, the laptop\'s built-in keyboard. My Devices lists it first as a directory of its parts, and the dashboard\'s PC card follows whichever machine This PC is.',
              },
              {
                label: 'June 2027 scope',
                note: 'a switch that shows the MVP without OMEN hardware control.',
              },
              {
                label: 'Simulator',
                note: 'the review\'s switches (Machine, Scope, OMEN AI, Session) — hidden by default; Admin Panel › Simulator or a ?sim=1 link turns it on.',
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
                label: 'Native parts follow the theme',
                note: 'scrollbars, date/time glyphs and form controls draw dark in the dark theme and light in the light.',
              },
            ],
          },
          {
            tier: 'Pages',
            items: [
              {
                label: 'Default dashboard',
                note: 'This PC, Cloud III, Last Played, Saga Pro, Origins 65, SoloCast 2 Pro, OMEN OLED 27 and Processor; Home device cards start with icons only, and ⋮ › Customize adds controls.',
              },
              {
                label: 'Lighting presets',
                note: 'OMEN Gaming Hub\'s effects join the library as factory presets, in one list.',
              },
              {
                label: 'Personalize Lighting',
                note: 'a 3D overview of the desk; each device opens its own lighting.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.44',
    date: 'October 21, 2026',
    committer: 'Chris Meyer, Kristy Cheng',
    reviewer: 'Chris Meyer',
    summary:
      'Responsive from phone to 4K — a breakpoint scale, a bottom nav on phones and an interface size; Nova gets a resizable sidebar; the type ramp becomes tokens; Personalize becomes your profile.',
    tasks: [
      'TH-478', 'TH-479', 'TH-480', 'TH-481', 'TH-482', 'TH-483', 'TH-484', 'TH-485', 'TH-486', 'TH-487',
      'TH-488', 'TH-489', 'TH-490', 'TH-491', 'TH-492', 'TH-493', 'TH-494', 'TH-495', 'TH-496', 'TH-497',
    ],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Foundations',
            items: [
              {
                label: 'Breakpoints',
                note: 'five named steps by the space a layout has, not the device — compact, medium, expanded, wide, ultra. Pages query the page container, so an open sidebar counts against the width. A name off the scale fails the build.',
              },
              {
                label: 'Interface size',
                note: 'Settings › Appearance › Auto / 100 / 125 / 150. Auto zooms 4K-class screens to 150%; new --viewport-* / --vw / --vh tokens stay true under the zoom.',
              },
              {
                label: 'Type ramp tokens',
                storyId: 'atoms-typography--docs',
                note: 'the text styles read --type-* size, line-height, weight and tracking tokens — the Figma styles verbatim. No visual change.',
              },
              {
                label: '--touch-target and --nav-bottom-h',
                note: 'a 44px touch target, and the room the phone nav takes at the foot of the page.',
              },
            ],
          },
          {
            tier: 'Atoms',
            items: [
              {
                label: 'ResizeHandle',
                storyId: 'components-resizehandle--docs',
                note: 'a WAI-ARIA window splitter — drag, ←/→ (Shift ×4), Home and End; the grip shows on hover, focus and drag.',
              },
              {
                label: 'Rating',
                storyId: 'components-rating--docs',
                note: 'neutral gray stars; the outline-vs-fill shape carries the value.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Toast / ToastStack',
                storyId: 'components-toast--docs',
                note: 'rewritten — tones, an action and a stack.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Menu — bar variant + shortLabel',
                storyId: 'organisms-menu--docs',
                note: 'the nav pill as a phone tab bar: icon over label, 44px slots, and More for whatever does not fit.',
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
                label: 'Sidebars reserve their default width',
                note: 'anything wider floats over the page, and a sidebar floats outright when the page beside it would drop under 600px.',
              },
            ],
          },
          {
            tier: 'Pages',
            items: [
              {
                label: 'Home board',
                note: 'grows by whole widgets — 8 columns at 1523px and up, 10 at 1898px and up — and stays left-aligned; the hero carousel is a grid cell.',
              },
              {
                label: 'Nova',
                note: 'out of the nav, opened from the chat button. The sidebar resizes and floats past its default width; drag past the maximum to open it full screen. The composer grows to four lines.',
              },
              {
                label: 'Personalize',
                note: 'no status line on device cards; each card shows one control until you pick more; the profile band shows the name and when it turns on by itself, and says why only when something else switched it.',
              },
              {
                label: 'Keyboard lighting',
                note: 'a multicolor preset spreads its colors across the keys instead of painting them one.',
              },
              {
                label: 'Profiles modal',
                note: 'takes the standard modal frame, like the Module Browser.',
              },
              {
                label: 'Forge',
                note: 'replaces the Agent Catalog in the same slot; cards are quieter, and a card\'s ⋮ shows on hover or focus.',
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
                label: 'Textarea',
                storyId: 'molecules-input--docs',
                note: 'grows with rows again — a theme rule had pinned every multi-line field to one control height.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'GameTile',
                storyId: 'organisms-gametile--docs',
                note: 'answers Enter and Space; it could be focused but not pressed.',
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
                label: 'Home carousel side slots',
                note: 'and their ⋮ rows; the board grows by whole widgets instead.',
              },
              {
                label: 'Per-profile lighting preset list',
                note: 'a profile keeps one preset per device; the numbered badges and «N in profile» are gone.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.43',
    date: 'October 18, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Device overlays and a preset editor from Figma: keycaps and button callouts sit on the product renders, a light preset is a stack of effects, and context menus share the Hadouken panel surface.',
    tasks: ['TH-471', 'TH-472', 'TH-473', 'TH-474', 'TH-475', 'TH-476', 'TH-477'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Atoms',
            items: [
              {
                label: 'Keycap',
                storyId: 'atoms-keycap--docs',
                note: 'the control over one cap of a keyboard render — selected, assigned, FN-layer dim, drop target, and the Lights tab\'s invisible pick target. The dim legend is lighter than Figma\'s so it passes AA.',
              },
              {
                label: 'AngleDial',
                storyId: 'atoms-angledial--docs',
                note: 'a round direction control: drag it, or use the arrow keys. Pair it with a small Stepper.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'OverlayPanel',
                storyId: 'molecules-overlaypanel--docs',
                note: 'a floating panel — title, body, footer — on the context menu\'s surface.',
              },
              {
                label: 'GradientStops',
                storyId: 'molecules-gradientstops--docs',
                note: 'a gradient bar with one handle per evenly spaced stop; a handle opens that stop for editing, the bar adds a stop.',
              },
            ],
          },
          {
            tier: 'Foundations',
            items: [
              {
                label: 'Title gradient',
                storyId: 'atoms-typography--docs',
                note: 'the Hadouken title fill as a token, and a .gradient modifier on the title and headline type.',
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
                label: 'Callout — overlay variant + CalloutLeader',
                storyId: 'atoms-callout--docs',
                note: 'the Figma Button Overlay: a fixed box with no dot or motion, Disabled in red, a drag-over state, and a leader line that follows the callout\'s state. The existing callout is unchanged.',
              },
              {
                label: 'Stepper — small',
                storyId: 'atoms-stepper--docs',
                note: 'a short field for three-digit values.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'ContextMenu',
                storyId: 'molecules-contextmenu--docs',
                note: 'now the Hadouken Menu Modal surface — a 2px stroke, a dark hairline and a 32px blur. Every context menu in the app takes it.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Device overlay tokens',
                note: 'a 6px key radius, the assigned and disabled washes, the callout size and the leader halo.',
              },
            ],
          },
          {
            tier: 'Pages',
            items: [
              {
                label: 'Keyboard and mouse device pages',
                note: 'the Origins 65 and the Saga Pro show their top-down renders with keycaps and callouts at Figma\'s coordinates and an animated backlight, and the keyboard keeps one size across its tabs. Other devices are unchanged.',
              },
              {
                label: 'Light preset editor',
                note: 'matches the Figma Lights frames. A preset is a stack of effects — Solid, Wave, Rainbow and more — each with its own colors, direction, speed and opacity.',
              },
              {
                label: 'Shell nav',
                note: 'the profile switcher takes the top-left corner the HyperX logo held.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.42',
    date: 'October 16, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'The React app is the one Treehouse prototype: the vanilla prototype and the hand-built design-system page are retired, Storybook is the only catalog, and the default accent is the Hadouken blue read from Figma.',
    tasks: ['TH-468'],
    groups: [
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Foundations',
            items: [
              {
                label: 'Accent — the default is Hadouken blue',
                note: 'the default accent comes from the Figma Hadouken variables, so it follows the design file when tokens are re-synced. The first accent choice is now called Blue, and its swatch shows exactly the color it applies in both themes. A saved «Cyan» choice turns into Blue on its own.',
              },
              {
                label: 'Figma primitives',
                note: 'the Hadouken primitives — 258 colors, radii, spacing and blur values — are synced into the system for semantic tokens to build on. Small radius stays 4px on purpose, not Figma’s 10px.',
              },
            ],
          },
          {
            tier: 'Atoms',
            items: [
              {
                label: 'Swatch',
                storyId: 'atoms-swatch--docs',
                note: 'the rainbow and palette stories use the blue accent in place of cyan.',
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
                label: 'Widget Board — a remembered slot no longer limits a card',
                storyId: 'organisms-widget-board--docs',
                note: 'a card that once sat beside the carousel keeps that slot’s fixed width and two rows only while it’s drawn there. On a narrow window it resizes freely, and growing it no longer pushes out the card that shares its slot.',
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
                label: 'The vanilla prototype and design-system.html',
                note: 'retired along with their simulator, showcase and sandbox pages and proof-of-concept demos. The React app is the prototype, Storybook is the only catalog, and the landing page has a single Treehouse Prototype link. The SKU editor’s links and previews now open the React app.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.41',
    date: 'October 14, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'A Personalize device card says each thing once: the status line under its name leaves out whatever its controls already show, and the card drops its tab shortcuts.',
    tasks: ['TH-466', 'TH-467'],
    groups: [
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Device card \u2014 the status line says what the face does not',
                note: 'each part of the line under a device\u2019s name leaves while the control that shows it is on the card: with the DPI buttons showing, the mouse no longer also reads \u00ab1600 DPI\u00bb. With nothing left, the line goes and gives its space back. A muted mic\u2019s warning is the one line that always stays.',
              },
              {
                label: 'Device card \u2014 no tab shortcuts in Personalize',
                note: 'a Personalize card\u2019s controls sit on the card and the card itself opens the device, so the shortcuts to its tabs are gone there. Home cards keep them. (Kristy Cheng)',
              },
              {
                label: 'Customize \u2014 everything off keeps the card\u2019s place',
                note: 'in Personalize, a card with every control switched off keeps its shape, so its name and photo stay level with the cards beside it instead of sliding to the bottom. (Kristy Cheng)',
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
                label: 'Device card \u2014 lighting swatches',
                note: 'more space between swatches and under their label, so the selected swatch\u2019s ring no longer crowds its neighbors. (Kristy Cheng)',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.40',
    date: 'October 13, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Every card on Home carries one \u22ee menu \u2014 what the card can do, then what the board can do with it. A device card shows the controls you pick, and a card in Personalize can put itself on Home carrying them.',
    tasks: ['TH-459', 'TH-460', 'TH-461', 'TH-462', 'TH-463', 'TH-464', 'TH-465'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Card Menu',
                storyId: 'organisms-card-menu--docs',
                note: 'the \u22ee in a card\u2019s top-right corner, on every card. Two groups with a rule between: what the card holds \u2014 its link, Customize \u2014 then what the board does with it, Move and Remove from Home. It replaces the corner \u00d7 that appeared on hover, and a card with options of its own draws one \u22ee, not two. (Cindy Jung)',
              },
              {
                label: 'Personalize \u2014 Add to Home Dashboard',
                note: 'a device card can put itself on the Home board, carrying the controls you have chosen for it. From then on the two are separate: Personalize is where you set the device up, Home is the glance, and each remembers its own rows.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Device card \u2014 controls on the face',
                note: 'a device card can carry its most-used settings \u2014 a mouse\u2019s DPI, a headset\u2019s volume and EQ, a display\u2019s picture \u2014 and its \u22ee picks which. (Kristy Cheng)',
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
                label: 'Device card \u2014 the surface decides the shape',
                note: 'the same card is drawn two ways on purpose. In Personalize it grows to its content; on the Home board it fills the cell it was given, so the photo scales with the card and a card beside the carousel can be made taller. One card\u2019s layout is no longer the other\u2019s.',
              },
              {
                label: 'Customize \u2014 everything can be off',
                note: 'the last control no longer has to stay on. Turn them all off and the card is its name, its photo and its shortcuts again; the \u22ee is still there to bring them back.',
              },
            ],
          },
          {
            tier: 'Pages',
            items: [
              {
                label: 'Personalize \u2014 the band, the devices, the Profiles window',
                note: 'the band keeps one labelled Manage Profiles button and switching lives in the nav switcher; Devices follows the desk, minus anything unplugged; the Profiles window is as tall as its content rather than the screen. (Kristy Cheng)',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.39',
    date: 'October 12, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'The theme asks two questions instead of offering three options, the mouse gets the Settings tab it never had, and a Settings panel is held in rather than stretched across the canvas.',
    tasks: ['TH-455', 'TH-456', 'TH-457', 'TH-458'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Device windows \u2014 the mouse\u2019s Settings tab',
                note: 'the Pulsefire Saga Pro\u2019s Settings tab said \u201ccoming soon\u201d; it is now the device card and a low-power alert beside the Windows pointer properties, over a hand-off to the control panel that owns them. Sensitivity and double-click carry Windows\u2019 own ranges rather than invented ones, because the panel mirrors Mouse Properties and sends you there. All four values belong to the profile, so they switch with it and a profile capture takes them.',
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
                label: 'Theme \u2014 \u201cUse system theme\u201d, then Dark or Light',
                note: 'picking the theme was one three-way control that put \u201cfollow the OS\u201d on the same rail as the two themes it chooses between. It is now a switch, with Dark/Light appearing under it only when the switch is off \u2014 and turning it off returns you to your own last pick rather than to whatever the OS happens to be saying. Both the avatar menu and Settings \u203a Appearance ask it the same way.',
              },
              {
                label: 'Device windows \u2014 a Settings panel is held in',
                note: 'the mouse\u2019s and the keyboard\u2019s Settings panels spanned the full canvas, which left their sliders and copy far wider than anything they set. Both now sit at the narrow measure the headset, mic and notebook already used, easing between widths when you change tab.',
              },
              {
                label: 'Device windows \u2014 one settings card everywhere',
                note: 'the keyboard drew its own name, firmware line and buttons; it now uses the same card as every other device, so the four read identically. A device\u2019s firmware is SKU data rather than a string typed into the screen.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Section deep links and the feature manifest',
                note: 'a page section can be addressed with ?section=, and a manifest names the regions a UX assessment walks, reporting each one\u2019s live position.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.38',
    date: 'October 8, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Personalize is the active profile: a band at the top names the profile you are in and says what switched it, the quick controls are yours to arrange, and one lighting model runs the desk and the device panels together. Kristy Cheng\u2019s arc, merged whole.',
    // Her branch's numbers, which collide with main's TH-439\u2026TH-448 (already in
    // v0.2.34 and v0.2.37). Labelled rather than renumbered; HANDOFF.md's
    // thirty-second session maps them.
    tasks: ['Kristy\u2019s TH-439\u2026TH-448'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Pages',
            items: [
              {
                label: 'Personalize \u2014 the profile band',
                note: 'a band at the top of the page IS the active profile: it names it, and when a linked game or a schedule switched it, it says so and offers Undo. A guess \u2014 a meeting on the calendar \u2014 asks first rather than switching behind you. A quick control the profile owns saves to it as you move it. (Kristy Cheng)',
              },
              {
                label: 'Personalize \u2014 quick controls you arrange',
                note: 'the positions are yours. Context highlights a tile and never moves one; a star brings a tile to the front and removing the star puts it back where it was; the tiles drag the way the Home board\u2019s widgets do, and a tile\u2019s foot shows the icon of the device it belongs to. (Kristy Cheng)',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Settings \u2014 an Account group and an Appearance panel',
                note: 'two groups now: Account is who you are (name, avatar, linked accounts), App is how Treehouse behaves. Appearance became its own panel \u2014 a Look applies wallpaper, accent and theme in one press with Undo; an accent can be taken from your wallpaper or typed as a HEX value, and one too dark to see on the app is refused with the contrast it measured rather than accepted. (Kristy Cheng)',
              },
              {
                label: 'Device windows \u2014 Lights for the mouse and the tower',
                note: 'both have a lit zone the desk in Personalize sets, and neither had a panel that could set it. A profile also keeps an ordered list of lighting presets per device \u2014 numbered in the Lights tab, cycled by the device\u2019s own lighting button. (Kristy Cheng)',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Tile \u2014 a plain marker',
                storyId: 'molecules-tile--docs',
                note: 'the small icon saying why a tile is there can be shown without its tooltip. On a tile you drag, the help cursor and the hover chip on that icon fought the drag; the plain marker lets the tile\u2019s own cursor through. (Kristy Cheng)',
              },
            ],
          },
          {
            tier: 'Foundations',
            items: [
              {
                label: 'Mouse and keyboard icons',
                note: 'the set had neither, so any list of device types had two gaps in it. Device-type icons now cover keyboard, mouse, headset and microphone. (Kristy Cheng)',
              },
            ],
          },
        ],
      },
      {
        kind: 'changed',
        tiers: [
          {
            tier: 'Templates',
            items: [
              {
                label: 'ModalShell \u2014 phone width, and labelled nav groups',
                storyId: 'templates-modalshell--docs',
                note: 'the shell\u2019s inset is a desktop margin: on a 375px phone it left a 159px-wide modal, Profiles and Settings and Admin alike. Below 600px the shell takes the screen less a small gutter. The section switcher in the left slot can also carry group labels, which is what lets Settings show Account and App as two runs. (Kristy Cheng)',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Input',
                storyId: 'molecules-input--docs',
                note: 'the field declares which theme it is drawn in, so the browser\u2019s own clock and calendar glyphs are visible. On the dark theme they were drawn dark on a dark field and simply vanished \u2014 nothing was broken, there was nothing to see. (Kristy Cheng)',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Profiles modal \u2014 Profile Details',
                note: 'NGENUITY\u2019s two-column layout, with cards side by side sharing one height. Profile Details lists one device per row with its type icon, presets first, and key and button assignments as keycaps; any group can be copied to another profile. The Game Link picker floats over the cards instead of resizing them. (Kristy Cheng)',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'One lighting model',
                note: 'the desk in Personalize and a device\u2019s own Lights tab used to be two lightings \u2014 set the keyboard to Banana in its panel and the desk stayed on Wave. They are kept in step in both directions now, for every lit device, and the desk\u2019s lighting belongs to the active profile the way its accent does. (Kristy Cheng)',
              },
              {
                label: 'Cards side by side end on one line',
                note: 'a rule, not a fix to one screen: every card and widget in a row shares one height, the row stretches rather than aligning to the top, and where one side is a stack of cards its last card takes the slack. Content stays top-aligned inside the card. Measure the bottoms in the browser \u2014 a mismatch is a bug, and an exception needs a comment at the rule saying why. (Kristy Cheng)',
              },
              {
                label: 'Drag to reorder, in one place',
                note: 'the Home board\u2019s pick-up-and-drop is a shared hook, so Personalize\u2019s quick controls move by the same code. The Home board still runs its own copy, because it also drags into the hero band\u2019s slots and the shared hook has no notion of those \u2014 one gesture in two implementations until that is settled.',
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
                label: 'Personalize \u2014 the app stops redrawing for nothing',
                note: 'Settings subscribed to the whole profiles value, so ANY profile edit \u2014 a rename, a schedule day, a Game Link toggle \u2014 re-rendered every screen that reads a setting: 50\u2013100ms of work per click in the Profiles modal. It now subscribes to just the overrides it resolves. The 3D desk also pauses while something covers it. (Kristy Cheng)',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'ListItem with a Checkbox',
                storyId: 'molecules-listitem--docs',
                note: 'a checkbox inside a clickable row toggled three times for one click \u2014 the row and the control both answered the same press. Fixed where it ships, in the Profiles modal. The pattern in the stories is deliberately untouched, so this shape can still be built wrong; treat it as a trap until the stories are fixed too. (Kristy Cheng)',
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
                label: 'Profiles manager (the card grid)',
                note: 'the grid of profile cards on Personalize is gone. The band at the top of the page is where a profile is named and switched; the Profiles modal is where one is edited. It was a section of that page rather than a dashboard widget, so no saved dashboard changes.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.37',
    date: 'October 7, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Ask for a widget and the local model composes it \u2014 from almost anything the app knows, choosing how each thing is shown \u2014 and the card is on screen from the moment you ask.',
    tasks: ['TH-452', 'TH-453', 'TH-454'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Meter',
                storyId: 'molecules-meter--docs',
                note: 'a reading as a level: the label and the number over a filled bar. Read-only \u2014 a level someone can move is still a slider \u2014 and it fills against the reading\u2019s own limits, so a temperature is not measured against 100.',
              },
              {
                label: 'Sparkline',
                storyId: 'molecules-sparkline--docs',
                note: 'a reading over time: the last two minutes as a line over a faint area, with the current number beside the label. No axes \u2014 at this size the number is the axis that matters. It draws from the same live feed the card\u2019s other readings use, so two cards never disagree about what the memory did a minute ago.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Custom Widget \u2014 a dial, a bar or a graph',
                storyId: 'organisms-custom-widget--docs',
                note: 'a reading used to be a number in a tile. It can be a tile, a dial, a level bar or a two-minute graph now, and the request decides which. A form a reading cannot support is never offered: a graph needs a history behind it, and a bar or a dial needs a scale to fill against.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Everything a widget can hold',
                note: 'the vocabulary is one table now, a row per bindable thing, and it has grown from twenty-three to eighty-four: every system reading, every per-device setting on the headset, microphone, mouse and keyboard, the app\u2019s own appearance and display settings, the monitor\u2019s picture, and what Nova has cost. A row carries its own words, its scale, its measured height on the board and whether this desk can bind it at all \u2014 so adding the next thing is adding a row, not a renderer plus a parser rule plus a height.',
              },
              {
                label: 'A control the active profile is already setting',
                note: 'where a profile sets the value \u2014 accent, wallpaper, and its blur and opacity \u2014 the control on the card shows the profile\u2019s value and locks, and says why. It used to accept the change and write underneath, where the profile went on hiding it.',
              },
              {
                label: 'Running the local model',
                note: 'the setup another machine needs is written down and published with the catalog \u2014 the install, the one model, and the two settings that matter \u2014 so composing can be tried by someone who did not build it.',
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
                label: 'How a widget request is answered',
                note: 'the patterns used to answer alone unless they were unsure. The model sees every request now, and how much it may change follows how much was read: on a sentence read completely the items are settled and the model only names the card and says what it is for; on a half-read one it fills in what was missed; on a bare \u201cbuild me a widget\u201d it chooses. The sentence still decides card or overlay, how many rows a list gets, and which device a shared word belongs to.',
              },
              {
                label: 'The wait',
                note: 'the card is on screen as soon as you ask \u2014 the real card, live, with \u201ccomposing\u201d under it and no buttons yet \u2014 and the model\u2019s version replaces it in place. Nothing moves out from under a reader, which is why the buttons arrive once, at the end. If the model is missing or slow, what is already there is the answer.',
              },
              {
                label: 'An overlay, composed',
                note: 'an overlay that names something is composed the way a card is, up to four items, readings before controls. A bare \u201coverlay\u201d is still the frame-rate-and-temperatures readout, immediately and without asking the model \u2014 a HUD has an obvious default in a way a card does not.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Gauge',
                note: 'the dial takes a size. The two smaller sizes the Vitals window had hand-rolled for itself are a property of the component now, so a dial on a card is the same dial.',
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
                label: 'Custom Widget \u2014 the form you asked for',
                storyId: 'organisms-custom-widget--docs',
                note: 'asking for a reading in a particular form only worked when the request had been half-understood. \u201cA gauge for my cpu temp\u201d was understood, which meant the model\u2019s answer \u2014 the dial included \u2014 was dropped in favour of what the patterns had already built: a tile. The items are the sentence\u2019s and the forms are the model\u2019s, and both survive now.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'ChatMessage',
                storyId: 'molecules-chatmessage--docs',
                note: 'a reply in progress says so in its markup as well as in its appearance, so anything reading a conversation can tell a half-written answer from a finished one.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.36',
    date: 'October 5, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'A dashboard card can hold almost any control in the app now, wired to the real setting rather than a copy of it \u2014 and the hero band\u2019s left-hand card is no longer washed by the carousel\u2019s glow.',
    tasks: ['TH-450', 'TH-451'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Atoms',
            items: [
              {
                label: 'Price',
                storyId: 'atoms-price--docs',
                note: 'a price, or a sale price beside the struck-through original. The store cards already drew this pair; it is a component now, so the shop, the deals widget and a composed card all quote a price the same way. Green is reserved for a genuine saving \u2014 a plain price is not one.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Custom Widget \u2014 controls and panels',
                storyId: 'organisms-custom-widget--docs',
                note: 'a card built on request held live readings and little else. It now holds three kinds of thing: readings, controls bound to real settings, and panels lifted from the app \u2014 what you played recently, what is on sale, what Nova has cost, and Nova itself with a field to ask it something. Its height follows from what it holds, so a card that would be clipped on the board is shown clipped before it is added rather than after.',
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
                label: 'Bound controls',
                note: 'the set a card or an on-screen overlay can carry has grown from five to thirteen: display brightness, the fan curve, mouse sensitivity, power mode, the headset\u2019s equalizer, volume, mic level and mic monitoring, the microphone\u2019s gain, monitor mix, headphone volume and monitoring, and the desk lights. A control bound to a device writes to the active profile, exactly as that device\u2019s own window does, so a value is never shown in two places with two answers. Adding another is one row of a table \u2014 the same row decides what the control is called, how tall it is, and whether this desk can bind it at all.',
              },
              {
                label: 'A switch inside a bound control',
                note: 'a toggle now sits on a row beside its state, so monitoring, lights and the other on/off controls read as part of the set the sliders belong to instead of floating in it.',
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
                label: 'Light Studio',
                storyId: 'organisms-widget-gallery--docs',
                note: 'the card\u2019s switch and brightness slider kept a state of their own, so moving them changed nothing on the desk and nothing anywhere else agreed with them. They drive the real lighting now; and a display mode that deliberately holds the light dim keeps the slider locked, so the card cannot quietly undo it.',
              },
              {
                label: 'Today\u2019s Deals',
                storyId: 'organisms-widget-gallery--docs',
                note: 'the two deals and their savings were written by hand and had drifted from the store \u2014 the card offered 65% off a game the shop was selling at 83% off. Both come from the catalog the shop prices from now, deepest saving first.',
              },
              {
                label: 'Widget Board \u2014 the hero band',
                storyId: 'organisms-widget-board--docs',
                note: 'on a wide screen the card to the left of the carousel sat under the carousel\u2019s glow, which tinted it and softened its contents while the card on the right stayed clean. The glow is the band\u2019s backdrop again and passes behind both sides.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.35',
    date: 'October 4, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Three features the system no longer needs are gone, and the prototype stops talking to servers that were switched off in July.',
    tasks: ['TH-446', 'TH-447'],
    groups: [
      {
        kind: 'removed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Weather',
                note: 'the board widget is retired. A saved dashboard that still names it keeps every other widget \u2014 an id the catalog no longer knows is dropped when the layout is read, not treated as an error \u2014 and the \u201cAdd a widget\u201d gallery simply no longer offers it.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Live peripheral lighting over OpenRGB',
                note: 'the local sidecar and the bridge to it are gone. Lighting is driven entirely by the app\u2019s own state now, which is what every screen has shown since the service stopped being run.',
              },
              {
                label: 'The Discord connection',
                note: 'the stored account tokens and the presence card are removed. Discord remains an ordinary application name in the lists where Spotify and Steam also appear \u2014 what has gone is the claim that Treehouse is signed in to it.',
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
                label: 'The prototype loads without errors',
                note: 'it had been opening connections to a sensor service and a game-library service that were switched off in July, logging sixteen failures on every load. Nothing depended on them \u2014 each surface had been showing its fallback for months \u2014 but the console was too noisy to find a real fault in.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.34',
    date: 'October 3, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Nova stops guessing about your machine and starts building for it \u2014 a real local model answers from the actual desk, proposes a dashboard you can see before you take it, and composes a widget out of what you asked to watch.',
    tasks: ['TH-441', 'TH-442', 'TH-443', 'TH-444'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Custom Widget',
                storyId: 'organisms-custom-widget--docs',
                note: 'a dashboard widget composed from a spec rather than written as a component: a titled list of live readings and bound controls on the same shell every other widget uses, so it drags, resizes, slots beside the carousel and is removed like one.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'A card and an overlay are the same thing',
                note: 'one titled list of readings. Give it a position and it floats over the game; give it the board and it is a widget. One vocabulary, one validator, and it reads identically in both homes.',
              },
              {
                label: 'A reply can propose the whole dashboard',
                note: "Nova draws the proposed board as a diagram using the board's own column count and placement arithmetic, names the widgets in prose as well \u2014 a diagram label ellipses to nothing in the pinned panel \u2014 and moves nothing until you press the chip. \u201cPut it back\u201d restores the board that was really there rather than recomputing one.",
              },
              {
                label: 'A local model can shape a reply, inside a schema',
                note: 'the patterns answer what they can match and the model answers what they could not. A confident reply is never traded for a slower one, and a model that is missing, slow or wrong leaves you the reply that already existed.',
              },
              {
                label: 'The system says what it cannot do',
                note: 'asked for a widget showing Spotify, or storage, Nova says so plainly and points at the widget that does show it, instead of quietly building something adjacent.',
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
                label: 'Home',
                note: 'the add-widget picker gained a Custom group, so a composed card survives its \u2715 the way every catalog widget does, and that group is the one place it can be forgotten.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Nova is grounded in the actual machine',
                note: 'replies name the real desk, the real devices and the active profile instead of inventing them with total confidence.',
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
                label: 'Widget and stat-tile sizing',
                note: '`.w` and `.ds-stat-tile` are content-box, and there is no global border-box reset. Any explicit width or flex-basis on either must set `box-sizing` itself, or the layout is silently ignored \u2014 the card renders beautifully and simply does not do what it was told.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'StatTile',
                storyId: 'molecules-stattile--docs',
                note: 'compact tiles laid out 2-up inside a widget keep their intended row instead of each wrapping onto its own line.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.33',
    date: 'October 3, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Nova moves in beside you and stops taking the wheel — the chat pins to the right rail, replies offer rather than act, and they can carry the real control or build you an overlay. The home dashboard widens on a big screen.',
    tasks: ['TH-434', 'TH-435', 'TH-436', 'TH-437', 'TH-438', 'TH-439', 'TH-440'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Molecules',
            items: [
              {
                label: 'FanCurve',
                storyId: 'molecules-fancurve--docs',
                note: 'fan speed against temperature, eight stops you drag — or focus and move with the arrow keys, which the editor it replaces could not do. Read-only, editable, and a compact form for a card. One curve everywhere: the tuning window, the Performance card and a chat reply now draw the same stored shape, where before each drew its own and none was saved.',
              },
              {
                label: 'Hud',
                storyId: 'molecules-hud--docs',
                note: 'an overlay card meant to sit over a game: a grip, a title, a hide button, and a row of compact stat tiles or live controls on a translucent surface. Placement belongs to the host — the grip is the pointer handle and the keyboard handle both.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'A control can live inside a conversation',
                note: 'a reply can carry the real thing — a brightness slider, a fan curve, an EQ or DPI picker, the power mode — bound to the same state as its home elsewhere, so moving it in the chat is moving it in the app. It names the device it bound to, and locks when that device is running an onboard slot, the way any software-only region does.',
              },
              {
                label: 'Overlays',
                note: 'small readouts placed anywhere on screen and kept there: frame rate, temperatures, a DPI or power-mode switcher. Dragged by the grip or nudged with the arrow keys, clamped to the window, hidden without being thrown away. One telemetry stream feeds them all, so two overlays never disagree.',
              },
              {
                label: 'A route can widen past the content cap',
                note: 'a page can opt into more width on a large screen while every other page keeps the cap. Unlike the full-bleed trick the Play page uses, it still reserves room for the Devices panel instead of sliding under it.',
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
                label: 'Chip',
                storyId: 'atoms-chip--docs',
                note: 'a chip that is given a role — a radio inside a radiogroup — no longer also claims to be a pressed button. One control cannot assert two toggle models at once; the look still follows `selected`.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'StatTile',
                storyId: 'molecules-stattile--docs',
                note: 'a compact form for an overlay: tighter, smaller, no surface of its own. At that size the number is body text rather than large text under WCAG, and the accent no longer clears 4.5:1 on a translucent card — so compact keeps the number in primary ink and carries the accent as a bar beside it.',
              },
              {
                label: 'ChatMessage',
                storyId: 'molecules-chatmessage--docs',
                note: 'a slot for live controls inside the bubble, and a wide form that sizes to the control it carries rather than to the sentence — capped by whatever column it is in, so the same reply fits a 380px panel and a page.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Widget Board',
                storyId: 'organisms-widget-board--docs',
                note: 'on a screen 1600px or wider, widgets can sit to the left and right of the hero carousel, two rows each, while the carousel keeps exactly the width it has at every narrower size. Drag one there like anywhere else, or use the move button on the card. Below that width the sides fold back into the grid and are remembered.',
              },
            ],
          },
          {
            tier: 'Pages',
            items: [
              {
                label: 'Nova',
                storyId: 'pages-nova--docs',
                note: 'pins to the right rail and follows you across the app — the same conversation, not a copy. And a reply no longer navigates, opens a window or switches your profile on its own: it explains, then offers a button. It can also build you an overlay from what you asked for and show you the real card before you place it.',
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
                label: 'Device card',
                note: 'the battery badge no longer lands on the subtitle when the card is taller than it is wide.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.32',
    date: 'October 2, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary:
      'Nova — an AI workspace that explains and acts: scripted-first chat with an optional local model, tokenomics against real cloud rates, and an Agents dashboard.',
    tasks: ['TH-427', 'TH-428', 'TH-429', 'TH-430', 'TH-431', 'TH-432', 'TH-433'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Pages',
            items: [
              {
                label: 'Nova',
                storyId: 'pages-nova--docs',
                note: 'an AI workspace, opt-in from the Module Browser. Chat puts your conversations on the left, the log in the middle, and the context Nova reasons over on the right — the active profile, the devices on the desk, the topics it can help with. The quick prompts and topics play scripted interactions that explain and then act: open the page, switch the profile, start the tool. Anything unscripted goes to a local model on this machine when you turn one on, streamed in as it arrives; nothing leaves the machine, and a model it cannot reach gets a plain reply rather than an empty bubble. The Agents view shows what your agents have done — usage, a week of tokens, recent activity — and holds the catalog itself. Below 1024px the rails become drawers.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'ChatMessage',
                storyId: 'molecules-chatmessage--docs',
                note: 'one turn of a conversation. The person sits right on the accent wash, the assistant left on the surface; a streaming reply shows typing dots until text arrives, and keeps them beside the text that already has; the things a reply did become chips under it that do them again. The system’s first chat bubble — built as a system piece because a bubble recurs wherever an agent is given a voice.',
              },
              {
                label: 'StatTile',
                storyId: 'molecules-stattile--docs',
                note: 'one number with its name — a dashboard KPI or a popover total — composing the stat typography the widgets already use, and adding only the surface and the number’s size, which a host sets with one custom property. Its label sits a step brighter than the stat label it inherits: the muted ink measured 4.85:1 in the dark theme, passing with no margin.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'A page that owns the viewport',
                note: 'a route can now hold a full-height, internally scrolling region inside the app shell: the shell marks the route and hands the height down, so the page fills what is left of the window and owns its own scrolling. No nav-height number is involved — that number was always an assertion — and the page narrows beside the Devices panel rather than sliding under it. Nova is the first; the next one adds its path to the same list.',
              },
              {
                label: 'A page’s own sub-view is its own parameter',
                note: 'Nova’s views are the URL: the parameter is read as the value and written when you choose a view, so Back flips between them and a pasted link opens where it says. It is deliberately not the `tab` parameter, which belongs to the modal hosts and is cleared whenever a modal closes — a page that borrowed it would lose its view every time someone opened and closed a modal.',
              },
            ],
          },
          {
            tier: 'Foundations',
            items: [
              {
                label: 'Visually hidden utility',
                note: 'a utility for content that belongs in the accessibility tree and out of the layout — a page’s heading when the chrome carries its name another way, a live region that announces but never shows. It was a one-off on the Perform page, whose own note said it was worth promoting once a second surface needed one.',
              },
              {
                label: 'Icons — send, tokens',
                note: 'two glyphs the set did not have: an up-arrow in a circle for a composer’s send, and a star in a speech bubble for token usage.',
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
                label: 'Agent Catalog',
                storyId: 'pages-agent-catalog--docs',
                note: 'its body — the category nav, the search, the grid that swaps to a detail page — is now a shared piece: the modal wraps it, and Nova’s Agents view renders the same thing inline. Same look, same behavior, one place it lives. A card can carry a line of what that agent has done where the surface showing it knows.',
              },
            ],
          },
          {
            tier: 'Atoms',
            items: [
              {
                label: 'Icon Button',
                storyId: 'atoms-iconbutton--docs',
                note: 'forwards its ref, so a popover built on it can hand focus back to the button that opened it.',
              },
            ],
          },
          {
            tier: 'Molecules',
            items: [
              {
                label: 'Context Menu',
                storyId: 'molecules-contextmenu--docs',
                note: 'forwards its ref and keeps its role ahead of the props it spreads, so the same floating panel can be used as a dialog and take focus when it opens.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'A widget owns its stylesheet',
                note: 'the trend chart’s styles moved out of the page they were written for and into the widget itself, after a second surface had to import a page’s stylesheet to draw a chart. A component that renders classes nobody imports looks fine until the page it borrowed them from moves, and then it loses its styling silently.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.31',
    date: 'October 2, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'A gaming notebook joins the roster as a real device, the Play page gains an alternate top, and a second store opens beside the Module Browser.',
    tasks: ['TH-424', 'TH-425', 'TH-426'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Pages',
            items: [
              {
                label: 'Agent Catalog',
                storyId: 'pages-agent-catalog--docs',
                note: 'a second store, opened from the shell’s utility row beside the Module Browser and built on the same shell — left nav, searchable pane, grid that swaps to a detail view. Its cards are text rather than preview art, because an agent has nothing to show until it has run. Agents are the inverse of modules: they default to absent and are added, where a module ships installed and is removed. Nine agents across five categories. Nothing in the app is gated on an added agent yet, so adding one is a catalog action for now.',
              },
              {
                label: 'Play — “Jump Back In”',
                note: 'an alternate top for the Play page: four large covers of the games you were last in, in the normal content flow, instead of the full-bleed hero and its rail. Choose it from Admin Settings; Hero is still the default, so a shared link always opens on the hero. The four games are declared as a recency list beside the library rather than taken from the head of the installed catalog — drawn from the catalog they repeated the opening row of the grid below, and the same four covers twice on one screen reads as a bug.',
              },
              {
                label: 'Device modal — HyperX OMEN 16 VALORANT',
                note: 'the gaming notebook is now a device like any other — a card in the default board, a four-tab modal, and a place in the widget picker, Metro and the global Devices panel. Its keyboard is four-zone RGB, not per-key, so the Lights tab paints bands: clicking any cap selects the whole band it belongs to, the rail offers zones instead of key groups, and the marquee tool is withheld because there is nothing to marquee. Every key on the board belongs to exactly one zone.',
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
                label: 'Keyboard hero',
                note: 'the hero that draws a keyboard now varies by prop instead of being forked per board: quick-select, the marquee tool and the volume knob can each be withheld. One hero serves a per-key desktop board and a four-zone notebook, so a fix to either reaches both.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Device modals route on declared capability',
                note: 'which modal a device opens is decided by what the SKU declares it can do, not by its type. Routing the notebook modal on the type alone silently replaced the spec sheets on two reference notebooks that are in the roster to be read, not operated. A device type is a category; what a screen can offer is a capability.',
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
                label: 'Icon-button overrides need full specificity',
                note: 'positioning an icon button inside a new block has to be written at the same specificity as the system’s own icon-button rules, which set `position` for their sheen. A plain class loses `position` while keeping `top`/`right`, and those offsets then nudge the button from wherever it already sits — so it renders, it is clickable, and it is a few pixels wrong. Half a rule applying is the failure mode, not no rule applying.',
              },
            ],
          },
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Device modal — hero on short screens',
                note: 'the hero floor now yields on short viewports, so a tall hero cannot push a modal’s tabs out of reach on a laptop screen.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.30',
    date: 'October 1, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'The board\u2019s \u201cAdd a widget\u201d cell is always the last thing on the board, and every device photo glows the same way.',
    tasks: ['TH-423'],
    groups: [
      {
        kind: 'fixed',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Widget Board \u2014 \u201cAdd a widget\u201d',
                storyId: 'organisms-widget-board--docs',
                note: 'the add cell is now always last, whatever mix of widget sizes the board holds. It used to be pulled forward into whatever gap a taller widget left behind, so on a board with an uneven bottom edge it could sit in the middle of the grid with widgets after it. The board now works out each cell\u2019s position itself rather than leaving it to the browser\u2019s dense packing, so the add cell lands after the last widget \u2014 beside it when that row has room, otherwise on a new row. Every widget keeps the position it had, and drag-to-reorder, resize and the saved layout are unchanged.',
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
                label: 'Device card \u2014 photo glow',
                note: 'every device photo now glows with the accent, monitors included. A monitor with an under-glow strip used to repaint its own glow from the strip\u2019s current color and brightness, which meant one product carried a rule nothing else could follow. One glow treatment across the whole roster is the sustainable version; the strip still drives the desk map, where showing its real color is the point.',
              },
              {
                label: 'Carousel \u2014 title',
                storyId: 'organisms-carousel--docs',
                note: 'the slide title now uses the branded display face instead of the UI sans.',
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
                label: 'Dead service scripts',
                note: 'the two Discord auth scripts are gone from the root package. They were left over from the vanilla prototype and pointed at a service directory that was removed long ago, so both failed on contact.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    version: '0.2.29',
    date: 'September 30, 2026',
    committer: 'Chris Meyer',
    reviewer: 'Chris Meyer',
    summary: 'Advertising placement concepts, off by default and gated in Admin; the README and onboarding describe the real system.',
    tasks: ['TH-420', 'TH-421', 'TH-422'],
    groups: [
      {
        kind: 'added',
        tiers: [
          {
            tier: 'Organisms',
            items: [
              {
                label: 'Ad Slot',
                storyId: 'organisms-ad-slot--docs',
                note: 'one advertising unit at its fixed IAB size — a 300×250 tile or a 728×90 banner — rendered as a solid fill captioned with its size until there is real creative. Three placement concepts use it, to hold beside the layouts our partners are working on: a Bottom Left Tile, a Bottom Banner flush to the bottom edge (with an optional blurred strip behind it, and the page reserving the banner\'s height so nothing ends up stuck behind it), and a Banner Below Carousel on Home. Every one is off by default; a fresh install renders no ad markup and reserves no space. The dimensions are ad-network units, not design tokens, declared once in the ads stylesheet.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Admin Settings — Advertising, gated',
                note: 'the row that chooses a placement is hidden until a Konami-style key sequence is typed while the modal is open. The unlock persists per browser; typing the sequence again hides the row and turns the ad off. The sequence is not documented here — ask Chris.',
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
                label: 'README and onboarding',
                note: 'both were rewritten against the current state. The README names the real source of truth — shared/tokens.css, shared/components.css and the React wrappers — with the correct ports and commands, the skills and the checking agents, the verification suites, this release process, and a new rule: grep shared/components.css for a root class before adding a .ds- block, because two components sharing one fails silently and only in the older one. The onboarding guide no longer describes the retired static-server workflow.',
              },
              {
                label: 'docs/gotchas.md',
                note: 'the things that have actually bitten — the Draco decoder wiring, the backdrop-filter stacking context, the Kintsugi html:root specificity layer and the rest — now live in their own file, each with the ticket and the date, instead of at the foot of a 4,000-line handoff. Worth reading once before you debug anything.',
              },
              {
                label: 'Published site',
                note: 'the site root now serves only the prototype, the app and the catalog. Internal documents — the handoff, the operating contract, planning files — are no longer published with it.',
              },
            ],
          },
        ],
      },
    ],
  },
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
