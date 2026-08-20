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
                note: 'the battery rendered as one solid block of colour instead of an outline with a level bar. The battery icons colour themselves — only the level bar takes the status colour — so the card must leave the casing neutral. If you place one of these icons, set no colour on it and let it be.',
              },
            ],
          },
          {
            tier: 'Conventions',
            items: [
              {
                label: 'Battery level — the urgency ladder',
                note: 'worth knowing before you touch these icons: they escalate in two steps. Down to 20% the casing stays neutral and only the bar changes colour (green → yellow → red); at 0–10% the whole icon goes red, deliberately, for urgency at critical charge. That last step only works while the levels above it stay neutral, so a status colour applied over the whole icon breaks it rather than reinforcing it.',
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
                note: 'the carousel’s own button class and its three variants are gone, taking four hardcoded colour values with them. Slide CTAs use the Button component like everything else.',
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
