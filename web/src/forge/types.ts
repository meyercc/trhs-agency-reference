import type { IconName } from '../components';

// ══════════════════════════════════════════════════════════════════════════
// Forge — the store that replaced the Agent Catalog (`?modal=agents`).
//
// One listing type for four kinds of thing: an App (its own window), a Skill
// (a recipe plus tools that act), a Recipe (plain instructions Nova follows)
// and an Assistant (a standing agent with its own personality). The Agent
// Catalog's agents are Assistants here; `agentId` ties them back to
// `agents/registry.ts`, which Nova still names its replies through.
// ══════════════════════════════════════════════════════════════════════════

export type ForgeType = 'app' | 'skill' | 'recipe' | 'assistant';

export type ForgeCategory =
  | 'find'
  | 'together'
  | 'better'
  | 'stream'
  | 'tune'
  | 'gear'
  | 'deals'
  | 'community'
  | 'family'
  | 'lore';

/** The hue of a listing's icon tile — one of the themed `--accent-*` palette tokens. */
export type ForgeTone = 'blue' | 'indigo' | 'purple' | 'orange' | 'green' | 'red' | 'yellow' | 'pink';

/** `core` is out now, `launch` ships with Forge, `later` is announced and not yet out. */
export type ForgeTier = 'core' | 'launch' | 'later';

/** Where a listing came from — drives the Discover groups. */
export type ForgeSource = 'forge' | 'sheet' | 'partner' | 'agent';

/** One row of the detail page's "What it can touch" panel. */
export interface ForgeAccess {
  icon: IconName;
  label: string;
  note: string;
}

export interface ForgeListingData {
  id: string;
  name: string;
  /** Byline — who publishes it. */
  pub: string;
  pubKind: 'official' | 'verified';
  type: ForgeType;
  cat: ForgeCategory;
  icon: string;
  tone: ForgeTone;
  /** Partner apps carry a brand mark instead of an icon tile. */
  logo?: string;
  /** The mark is light-on-dark and needs a dark plate in both themes. */
  logoDark?: boolean;
  summary: string;
  dl: number;
  dl30: number;
  saves: number;
  likes: number;
  up: number;
  down: number;
  ver: string;
  /** Days since the last update. */
  upd: number;
  isNew: boolean;
  featured: boolean;
  games: string[];
  access: { icon: string; label: string; note: string }[];
  desc: string;
  does: string[];
  asks: string[];
  risk: string;
  mit: string;
  side: string;
  tier: ForgeTier;
  src: ForgeSource;
  url?: string;
  license?: string;
  platforms?: string;
}

export interface ForgeListing extends Omit<ForgeListingData, 'icon' | 'access'> {
  icon: IconName;
  access: ForgeAccess[];
  /** Set on listings that are agents — the id Nova knows them by. */
  agentId?: string;
}

export interface ForgeCategoryDef {
  id: ForgeCategory;
  label: string;
  icon: IconName;
}
