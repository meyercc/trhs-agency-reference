/**
 * Demo seeds: eight past conversations and a week of agent usage, generated
 * from a fixed-seed PRNG so every fresh install looks the same, with
 * timestamps relative to today so "Today / Yesterday / Earlier" is always
 * right. The user turns are the pill phrases and the replies are the script
 * table's own words — the seeds demonstrate the scripts and stay in sync
 * with them. Nothing here is written to storage; a seed that is continued is
 * copied into the store on the first new message (copy-on-write).
 */
import type { NovaConversation, NovaMessage, NovaLedger } from '../state/Nova';
import { SCRIPT_BY_ID } from './scripts';
import { dayKey, estimateTokens, startOfToday } from './format';

/** mulberry32 — a tiny seeded PRNG, enough for believable demo numbers. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface SeedSpec {
  id: string;
  /** Offset from the start of today, in hours (negative = earlier days). */
  hoursFromToday: number;
  scriptId: string;
  agentId?: string;
}

// Three today, two yesterday, three earlier — in the order the rail shows them.
const SPECS: SeedSpec[] = [
  { id: 'seed-1', hoursFromToday: 9.5, scriptId: 'power-modes' },
  { id: 'seed-2', hoursFromToday: 8.2, scriptId: 'overlay' },
  { id: 'seed-3', hoursFromToday: 7.1, scriptId: 'fan-learning', agentId: 'thermal-warden' },
  { id: 'seed-4', hoursFromToday: -5, scriptId: 'launch-game' },
  { id: 'seed-5', hoursFromToday: -9, scriptId: 'omen-ai' },
  { id: 'seed-6', hoursFromToday: -30, scriptId: 'recorder', agentId: 'clip-keeper' },
  { id: 'seed-7', hoursFromToday: -52, scriptId: 'booster-training' },
  { id: 'seed-8', hoursFromToday: -100, scriptId: 'optimus' },
];

function replyText(scriptId: string): string {
  const s = SCRIPT_BY_ID[scriptId];
  return s.steps
    .map((st) => ('say' in st ? st.say : null))
    .filter((x): x is string => !!x)
    .join('\n\n');
}

function controlsOf(scriptId: string, at: number) {
  const s = SCRIPT_BY_ID[scriptId];
  return s.steps.map((st) => ('control' in st ? { kind: st.control, at, ...(st.spec ? { spec: st.spec } : {}) } : null)).filter((x): x is NonNullable<typeof x> => !!x);
}

function actionsOf(scriptId: string, at: number) {
  const s = SCRIPT_BY_ID[scriptId];
  return s.steps
    .map((st) => ('offer' in st ? { type: st.offer.type, label: st.label, at, call: st.offer } : null))
    .filter((x): x is NonNullable<typeof x> => !!x);
}

export function seedConversations(now = Date.now()): NovaConversation[] {
  const today = startOfToday(now);
  return SPECS.map((spec) => {
    const at = today + spec.hoursFromToday * HOUR;
    const script = SCRIPT_BY_ID[spec.scriptId];
    const userText = script.label ?? spec.scriptId;
    const reply = replyText(spec.scriptId);
    const seconds = 2.4 + (reply.length / 400) * 1.8;
    const messages: NovaMessage[] = [
      { id: `${spec.id}-u`, role: 'user', text: userText, at, source: 'scripted', modelId: 'local', agentId: null },
      {
        id: `${spec.id}-a`,
        role: 'assistant',
        text: reply,
        at: at + seconds * 1000,
        source: 'scripted',
        modelId: 'local',
        agentId: spec.agentId ?? null,
        actions: actionsOf(spec.scriptId, at + seconds * 1000),
        controls: controlsOf(spec.scriptId, at + seconds * 1000),
        usage: { inTokens: estimateTokens(userText), outTokens: estimateTokens(reply), seconds, estimated: true },
      },
    ];
    return { id: spec.id, title: userText, createdAt: at, updatedAt: messages[1].at, messages, seeded: true };
  });
}

/** A week of usage for the Agents dashboard — tokens and runs per day, and two agents' totals. */
export function seedLedger(now = Date.now()): NovaLedger {
  const rand = mulberry32(0x6e6f7661); // "nova"
  const today = startOfToday(now);
  const byDay: NovaLedger['byDay'] = {};
  for (let d = 6; d >= 0; d--) {
    const at = today - d * DAY;
    byDay[dayKey(at)] = { runs: 3 + Math.floor(rand() * 11), tokens: 8000 + Math.floor(rand() * 32000) };
  }
  const byAgent: NovaLedger['byAgent'] = {
    'thermal-warden': { runs: 14, tokens: 21_400, lastUsed: today + 7.1 * HOUR },
    'clip-keeper': { runs: 6, tokens: 9_800, lastUsed: today - 30 * HOUR },
  };
  return { events: [], byAgent, byDay };
}
