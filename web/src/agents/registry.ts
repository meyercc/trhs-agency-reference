// ══════════════════════════════════════════════════════════════════════════
// Agent registry — the single source of truth for every agent's identity:
// name, Forge type and version (the Forge store reads these, forge/listings.ts),
// plus the catalog copy.
//
// An agent is a standing assistant you add to the app: it watches one slice of
// the machine or the library and acts on it. Where a MODULE adds surfaces you
// operate yourself (`modules/registry.ts`), an agent operates them for you, so
// the two catalogs stay separate rather than one list with a type column.
//
// Add an agent → add an AGENTS entry and a persona (nova/personas.ts). An agent
// Nova actually answers as is a RECIPE: it also has a manifest entry
// (agents/recipes.tsx — the `nova-agent` skill has the steps).
//
// Forge's Add / Remove IS the switch (Chris, 2026-10-26, reversing the
// morning's call): a recipe that is not added does not answer in Nova, its
// entry points elsewhere in the app disappear, and its watcher stands down.
// `addedByDefault` is what a first run has already added — the built stories,
// so a viewer sees the feature before seeing it can be removed. Ask Chris
// whether a new agent story is added by default; never assume.
// ══════════════════════════════════════════════════════════════════════════
import type { IconName } from '../components';

export type AgentCategory = 'performance' | 'personalization' | 'play' | 'shop' | 'support';

/** One row in the detail page's "Access & tools" panel. */
export interface AgentAccess {
  icon: IconName;
  label: string;
  /** Shown dim under the label — what the access is actually for. */
  note?: string;
}

export interface AgentDef {
  id: string;
  name: string;
  category: AgentCategory;
  icon: IconName;
  /** The two-line description on the card. */
  tagline: string;
  /** The Overview tab's body. */
  description: string;
  /** Byline under the card title — who publishes it. */
  publisher: string;
  /** What Forge files it as — the store's taxonomy (forge/types.ts `ForgeType`). */
  type: 'skill' | 'recipe' | 'assistant';
  /** The release Forge shows; Forge's listing reads it from here. */
  version: string;
  /** Relative wording, as the catalog would render a timestamp. */
  updated: string;
  /** Already added on a first run (state/Agents.tsx) — Chris's call per agent story. */
  addedByDefault?: boolean;
  /** Surfaced under "New" on the landing. */
  isNew?: boolean;
  /** Surfaced under "Recommended" on the landing. */
  recommended?: boolean;
  /** Chips under the description — how the catalog files it, not its category. */
  tags: string[];
  /** The Capabilities tab, and the count on the tab strip. */
  capabilities: string[];
  /** The Commands tab — what you can ask it for in words. */
  commands: string[];
  /** The right-hand panel. An agent that reaches outside the app says so here. */
  access: AgentAccess[];
}

// ── Category metadata (drives the left nav, in order) ──────────────────────
export interface AgentCategoryDef {
  id: AgentCategory;
  label: string;
  icon: IconName;
}
export const AGENT_CATEGORIES: AgentCategoryDef[] = [
  { id: 'performance', label: 'Performance', icon: 'performance' },
  { id: 'personalization', label: 'Personalization', icon: 'lights' },
  { id: 'play', label: 'Play', icon: 'play' },
  { id: 'shop', label: 'Shop', icon: 'shop' },
  { id: 'support', label: 'Support', icon: 'chat-support' },
];

export const AGENTS: AgentDef[] = [
  // ── Performance ─────────────────────────────────────────────────────────
  {
    id: 'frame-doctor',
    name: 'Frame Doctor',
    category: 'performance',
    // Not `heartbeat` — the glyph is a plain heart and reads as "favorite".
    icon: 'vu-meter',
    tagline: 'Watches frame pacing while you play and tells you what caused a stutter.',
    description:
      'Average frame rate hides the thing you actually felt. Frame Doctor watches the time between frames, not the count, so a run that reads 140 fps but hitches every few seconds is reported as the problem it is. After a session it names the likely cause — a shader compile, a background process, a thermal limit, a VRAM ceiling — and offers the one change most likely to fix it rather than a page of sliders.',
    publisher: 'OMEN Labs',
    type: 'skill',
    version: '1.2.0',
    updated: 'updated 2 days ago',
    isNew: true,
    recommended: true,
    tags: ['Performance', 'Diagnostics', 'Per-game'],
    capabilities: [
      'Frame-time capture during play, with the 1% and 0.1% lows kept',
      'Stutter attribution — shader compile, background load, thermal, VRAM',
      'A per-game record, so "it got worse" can be checked rather than argued',
      'One suggested change per finding, with the expected cost',
    ],
    commands: ['Why did that stutter?', 'Compare this session to last week', 'What is my worst game right now?'],
    access: [
      { icon: 'performance', label: 'Performance telemetry', note: 'Frame times, GPU and CPU load while a game is running' },
      { icon: 'library', label: 'Game library', note: 'To file findings against the right title' },
    ],
  },
  {
    id: 'thermal-warden',
    name: 'Thermal Warden',
    category: 'performance',
    icon: 'thermometer',
    tagline: 'Keeps the machine quiet until it has to be loud, and says when that changes.',
    description:
      'Fan curves are set once and then forgotten, usually in summer or winter — whichever it was when you cared. Thermal Warden holds a target noise level instead of a fan speed, and moves the curve underneath it as the room, the dust and the season change. When it can no longer hold the target it says so plainly, and what it would cost to keep it.',
    publisher: 'OMEN Labs',
    type: 'skill',
    version: '1.0.4',
    updated: 'updated last week',
    tags: ['Performance', 'Thermals', 'Acoustics'],
    capabilities: [
      'A noise target rather than a fixed curve',
      'Seasonal drift tracking — the same game, the same settings, a hotter room',
      'An honest warning when quiet and cool can no longer both be had',
      'Per-profile targets, so a stream and a LAN night are not the same machine',
    ],
    commands: ['Keep it under 35 dB tonight', 'Why are the fans up?', 'What changed since last month?'],
    access: [
      { icon: 'thermometer', label: 'Thermal sensors', note: 'CPU, GPU and chassis temperatures' },
      { icon: 'settings', label: 'Fan control', note: 'Writes the curve it is holding' },
    ],
  },

  // ── Personalization ─────────────────────────────────────────────────────
  {
    id: 'lighting-director',
    name: 'Lighting Director',
    category: 'personalization',
    icon: 'lights',
    tagline: 'Builds a lighting scene per game from its art, and dims it when you are not playing.',
    description:
      'Most lighting ends up as one scene you chose months ago. Lighting Director reads a game’s cover art and key art, pulls a palette that is actually in the picture, and composes a scene across every device that carries a light. It respects the room: the same scene is quieter at night than at noon, and goes to a low neutral when nothing is running.',
    publisher: 'HyperX',
    type: 'skill',
    version: '2.0.0',
    updated: 'updated yesterday',
    isNew: true,
    tags: ['Personalization', 'Lighting', 'Per-game'],
    capabilities: [
      'Palette extraction from cover and key art',
      'One scene composed across every lit device on the desk',
      'Room-aware level — the scene dims with the hour and the ambient reading',
      'An idle state, so an empty desk is not running a light show',
    ],
    commands: ['Make a scene for this game', 'Calm it down', 'Match the monitor to the keyboard'],
    access: [
      { icon: 'lights', label: 'Device lighting', note: 'Every device on the desk that carries a light' },
      { icon: 'image', label: 'Game art', note: 'Cover and key art from the library' },
    ],
  },
  {
    id: 'profile-keeper',
    name: 'Profile Keeper',
    category: 'personalization',
    icon: 'profile',
    tagline: 'Notices the settings you keep changing by hand and offers to make them a profile.',
    description:
      'Every repeated adjustment is a profile you have not written down yet. Profile Keeper watches for the pattern — the same DPI before the same game, the sidetone you always drop on a call — and offers the profile once it is sure, with the evidence. It never saves one behind your back, and it will tell you when a profile you already have has quietly stopped matching what you do.',
    publisher: 'HyperX',
    type: 'assistant',
    version: '1.1.0',
    updated: 'updated 3 weeks ago',
    tags: ['Personalization', 'Profiles', 'Automation'],
    capabilities: [
      'Pattern detection across devices and apps',
      'A proposed profile with the changes that justified it',
      'Drift warnings when a saved profile no longer matches your habits',
      'Nothing saved without a yes',
    ],
    commands: ['What have I been changing?', 'Turn that into a profile', 'Is my FPS profile still right?'],
    access: [
      { icon: 'profile', label: 'Profiles', note: 'Reads your profiles and proposes new ones' },
      { icon: 'devices', label: 'Device settings', note: 'Observes the values you change by hand' },
    ],
  },

  // ── Play ────────────────────────────────────────────────────────────────
  {
    id: 'backlog-triage',
    name: 'Backlog Triage',
    category: 'play',
    icon: 'library',
    tagline: 'Sorts the pile you will never finish into the three things you would actually play tonight.',
    description:
      'A library is not a to-do list, but it starts to feel like one. Backlog Triage reads how long you have, what you finished last, and what your friends are in right now, then names three — a short one, a long one, and something you dropped and could pick back up. It is allowed to say "nothing tonight", which is the recommendation most backlog tools will not make.',
    publisher: 'OMEN Labs',
    type: 'recipe',
    version: '1.0.3',
    updated: 'updated 5 days ago',
    recommended: true,
    tags: ['Play', 'Library', 'Recommendations'],
    capabilities: [
      'Three picks sized to the time you have, not a ranked list of forty',
      'Resume detection — what you were partway through and where',
      'Friend presence as an input, not an advertisement',
      'Permission to recommend nothing',
    ],
    commands: ['I have 40 minutes', 'What was I in the middle of?', 'Something short and co-op'],
    access: [
      { icon: 'library', label: 'Game library', note: 'Titles, playtime and completion' },
      { icon: 'profile', label: 'Friends', note: 'Who is online and what they are in' },
    ],
  },
  {
    // The press demo's agent (TH-478). Backlog Triage looks forward — what to
    // play tonight; this one looks back — what you need to remember to keep going.
    id: 'catch-me-up',
    name: 'Catch Me Up',
    category: 'play',
    icon: 'hourglass',
    tagline: 'Gets you back into a game you drifted from, without spoiling anything you have not seen.',
    description:
      'The reason most people never finish a long game is not that they stopped liking it. They came back after three months, did not remember who anyone was or what they were building, and quit again. Catch Me Up reads your save, your playtime and the updates released since your last session, then tells you the story so far, the build you were running, where you were and what changed. It stops exactly where you stopped, and goes deeper only when you ask.',
    publisher: 'OMEN Labs',
    type: 'recipe',
    version: '1.0.0',
    updated: 'updated 2 days ago',
    isNew: true,
    addedByDefault: true,
    tags: ['Play', 'Library', 'Spoiler-safe'],
    capabilities: [
      'A recap that ends at your progress, never past it',
      'Your build and what the updates since your last session did to it',
      'Where you were and the one thing you were about to do',
      'Resume with the game’s lighting and device profile applied',
    ],
    commands: ['Catch me up on Cyberpunk', 'How does that affect my build?', 'Keep me caught up on everything I’ve drifted from'],
    access: [
      { icon: 'library', label: 'Game library', note: 'Saves, playtime and progress' },
      { icon: 'download', label: 'Patch notes', note: 'Updates released since your last session' },
    ],
  },
  {
    // Row 54 of the Gamer-First recipes sheet, the Lore moment
    // (docs/who-made-this-demo-plan.md): IMDb for the game you are playing.
    id: 'who-made-this',
    name: 'Who Made This',
    category: 'play',
    icon: 'microphone',
    tagline: 'Tells you who voices a game and who made it, and what else each of them has worked on.',
    description:
      'You hear a voice in a game and know it from somewhere; film has a cast list for that and games make you tab out to a wiki. Who Made This reads a game’s credits and answers like a film buff would: the voice cast and who they play, the director, the writers, the composer and the artists, and the other games each of them worked on — with the ones already in your library called out. It states credits as credits, says when it is not sure of one, and never spoils the story.',
    publisher: 'OMEN Labs',
    type: 'recipe',
    version: '1.0.0',
    updated: 'updated today',
    isNew: true,
    addedByDefault: true,
    tags: ['Lore', 'Credits', 'Voice cast'],
    capabilities: [
      'The voice cast and the character each one plays',
      'The people behind it — direction, writing, art and music',
      'Everything else each of them has worked on, with your own games called out',
      'A character’s voice, when you only know the name on screen',
    ],
    commands: ['Who’s in Cyberpunk 2077?', 'Who made Elden Ring?', 'What else has Neil Newbon been in?'],
    access: [
      { icon: 'library', label: 'Game library', note: 'To say which of a person’s games you already own' },
      { icon: 'link-on', label: 'Can send data to other services', note: 'Looks a game up in a public credits database; sends only its title' },
    ],
  },
  {
    // TH-509 (docs/autocast-demo-plan.md): the clipping skill Nova hands a
    // game session to. Forge's concept listing `autocast` (listings.data.ts)
    // becomes this agent (CONCEPT_AGENT). NOT added by default (Chris,
    // 2026-10-28): the story starts with Nova unable to clip and offering it.
    id: 'autocast',
    name: 'Autocast AI',
    category: 'play',
    icon: 'video-capture',
    tagline: 'Records your session, marks the moments worth keeping and cuts them into clips you approve.',
    description:
      'Ask Nova for highlights from your next game and it hands the job to Autocast. Autocast records locally while you play, marks the moments worth keeping — kills, clutches, the round everybody shouted — and cuts the best of them to the length and format you asked for, captioned. The clips land in the chat for you to watch, approve or discard; the approved ones go to your Gallery. Nothing posts, uploads or leaves this PC without you.',
    publisher: 'OMEN',
    type: 'skill',
    version: '1.4.0',
    updated: 'updated this week',
    addedByDefault: false,
    tags: ['Clips', 'Capture', 'Highlights'],
    capabilities: [
      'Record gameplay on this PC while a game is running',
      'Mark highlight moments and cut them to your plan',
      'Reframe and caption each clip',
      'Save the ones you approve to your Gallery',
    ],
    commands: ['Record 8 highlight videos of 6 seconds in 9:16 format from my next game session', 'End session now', 'Approve all'],
    access: [
      { icon: 'video-capture', label: 'Screen and game audio', note: 'Only while a game is running and a plan is armed' },
      { icon: 'library', label: 'Game library', note: 'To label clips with the right game' },
    ],
  },
  {
    id: 'clip-keeper',
    name: 'Clip Keeper',
    category: 'play',
    icon: 'video-capture',
    tagline: 'Keeps the thirty seconds worth keeping and throws the rest away.',
    description:
      'Always-on capture leaves you with a drive full of footage and no way in. Clip Keeper marks the moments the session actually turned — a comeback, a streak, the round everybody shouted — and keeps those, at full quality, with the rest discarded on a schedule you set. It titles what it keeps, so the folder reads like a highlight list instead of a wall of timestamps.',
    publisher: 'HyperX',
    type: 'assistant',
    version: '1.4.0',
    updated: 'updated last month',
    tags: ['Play', 'Capture', 'Storage'],
    capabilities: [
      'Moment detection from game audio and input, not just a hotkey',
      'Full-quality keeps, scheduled deletion for everything else',
      'Titled clips, so the folder is readable a month later',
      'A disk budget it will not exceed',
    ],
    commands: ['Keep that', 'Show me tonight’s best', 'How much space is this using?'],
    access: [
      { icon: 'video-capture', label: 'Screen capture', note: 'Records and trims gameplay footage' },
      { icon: 'folder', label: 'Local storage', note: 'Writes and deletes inside its own budget' },
    ],
  },

  // ── Shop ────────────────────────────────────────────────────────────────
  {
    id: 'deal-watcher',
    name: 'Deal Watcher',
    category: 'shop',
    icon: 'shop',
    tagline: 'Watches the games on your list and tells you once, when the price is actually good.',
    description:
      'A wishlist alert that fires on every small discount trains you to ignore it. Deal Watcher keeps each title’s price history and only speaks when the current price is near its real floor, with the floor shown so you can disagree. One notification per title per sale, and it stays quiet about anything you already own.',
    publisher: 'OMEN Labs',
    type: 'skill',
    version: '1.2.4',
    updated: 'updated 2 months ago',
    tags: ['Shop', 'Pricing', 'Wishlist'],
    capabilities: [
      'Price history per title, with the historical low shown',
      'One alert per sale, not one per price change',
      'Silence on anything already in your library',
      'A threshold you can set yourself if you disagree with the floor',
    ],
    commands: ['Watch this one', 'Is this a good price?', 'What is on sale that I wanted?'],
    access: [
      { icon: 'shop', label: 'Store catalog', note: 'Prices and sale history' },
      { icon: 'link-on', label: 'Can send data to other services', note: 'Checks prices at the stores you link' },
    ],
  },

  {
    // TH-484 (docs/refund-window-demo-plan.md) — row 19 of the Gamer-First
    // recipes sheet. Same id as its Forge listing, which becomes this agent.
    id: 'did-i-just-waste-my-money',
    name: 'Did I Just Waste My Money',
    category: 'shop',
    icon: 'hourglass',
    tagline: 'Tells you how long you have left to refund a new game, and warns you before the window closes.',
    description:
      'The two-hour Steam window passes while you are still deciding whether you like something. This agent watches the playtime on what you have just bought and checks it against the store’s refund rule — Steam and Epic count hours played, GOG counts days — so you always know whether you are in the clear. It speaks up with fifteen minutes left, tells you what it saw if the game has not been running well, and gives you the exact steps to ask for your money back. It never files a refund for you.',
    publisher: 'OMEN Labs',
    type: 'recipe',
    version: '1.0.3',
    updated: 'updated today',
    isNew: true,
    addedByDefault: true,
    tags: ['Shop', 'Refunds', 'Playtime'],
    capabilities: [
      'Playtime against each store’s refund rule — Steam, Epic and GOG',
      'A warning with fifteen minutes of the window left',
      'What this PC saw while you played, if it did not run well',
      'The exact steps and the page to ask for a refund',
    ],
    commands: ['Did I just waste my money on Monster Hunter Wilds?', 'How do I refund it?', 'Keep an eye on everything I can still return'],
    access: [
      { icon: 'library', label: 'Game library', note: 'Playtime and when each game was bought' },
      { icon: 'shop', label: 'Purchase history', note: 'Store, date and price, from the stores you link' },
      { icon: 'performance', label: 'Performance telemetry', note: 'Only to say whether a game ran well on this PC' },
    ],
  },

  // ── Support ─────────────────────────────────────────────────────────────
  {
    id: 'driver-concierge',
    name: 'Driver Concierge',
    category: 'support',
    icon: 'download',
    tagline: 'Updates drivers and firmware on a schedule, and knows how to put one back.',
    description:
      'The right time to update a graphics driver is never the hour before a match. Driver Concierge collects what is waiting, holds it until a window you chose, and applies it with a known-good version kept aside. If frame times get worse after an update it says so unprompted and offers the rollback, which is the part most update tools leave to you.',
    publisher: 'HP',
    type: 'skill',
    version: '1.6.1',
    updated: 'updated 4 days ago',
    isNew: true,
    tags: ['Support', 'Drivers', 'Firmware'],
    capabilities: [
      'A held queue applied in a window you set, never mid-session',
      'A known-good version kept for every update it applies',
      'Post-update regression check against your own frame times',
      'One-step rollback, offered rather than buried',
    ],
    commands: ['What is waiting?', 'Update tonight at 3am', 'Put the old driver back'],
    access: [
      { icon: 'download', label: 'Driver and firmware updates', note: 'Downloads and applies on your schedule' },
      { icon: 'devices', label: 'Connected devices', note: 'To match firmware to the hardware on the desk' },
      { icon: 'link-on', label: 'Can send data to other services', note: 'Contacts HP and vendor update servers' },
    ],
  },
  {
    id: 'setup-assistant',
    name: 'Setup Assistant',
    category: 'support',
    // `sparks` belongs to the Discover nav item; reuse would read as an echo.
    icon: 'assign',
    tagline: 'Walks a new device onto the desk and carries your settings across to it.',
    description:
      'A new headset arrives and you spend an evening finding the settings you already made on the old one. Setup Assistant recognises the device, maps what it can from the thing it is replacing, and shows you the handful that have no equivalent rather than silently dropping them. It leaves the old device’s profile intact until you say the new one is right.',
    publisher: 'HyperX',
    type: 'assistant',
    version: '1.3.2',
    updated: 'updated 3 weeks ago',
    tags: ['Support', 'Onboarding', 'Migration'],
    capabilities: [
      'Device recognition and a guided first-run',
      'Settings carried across from the device being replaced',
      'An explicit list of what could not be mapped, instead of a silent drop',
      'The old profile kept until you confirm',
    ],
    commands: ['Set up my new headset', 'Move my settings across', 'What did not transfer?'],
    access: [
      { icon: 'devices', label: 'Connected devices', note: 'Detects and configures new hardware' },
      { icon: 'profile', label: 'Profiles', note: 'Copies settings between devices' },
    ],
  },
];

export const AGENT_BY_ID: Record<string, AgentDef> = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

/** What a first run has already added from Forge (state/Agents.tsx). */
export const DEFAULT_AGENT_IDS: readonly string[] = AGENTS.filter((a) => a.addedByDefault).map((a) => a.id);
