import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { type AgentCardRef, type NovaControlKind, SCRIPT_BY_ID, SPEED, matchScript, scriptForScope, type NovaActionCall, type NovaScript, type RefineKind } from '../nova/scripts';
import { useSettings } from './Settings';
import { performAction, runScript, type NovaActions } from '../nova/engine';
import { overlayScriptFor } from '../nova/overlayBuilder';
import type { CardSpec, OverlaySpec } from './overlays';
import { BREVITY, CONTEXT_CONTRACT, NOVA_SYSTEM, PERSONAS } from '../nova/personas';
import { LlmError, requestJson, streamChat, type ChatTurn } from '../nova/llm';
import { catalogOf, layoutContextOf, renderSnapshot, type NovaSnapshotGetter } from '../nova/grounding';
import { layoutScriptFor } from '../nova/layoutBuilder';
import { cardScriptFor } from '../nova/cardBuilder';
import { recipeScriptFor } from '../agents/recipeScripts';
import { useAgents } from './Agents';
import { IDLE as AUTOCAST_IDLE, snapshotOf, useAutocastOptional } from './Autocast';
import { usePlaytime } from './Playtime';
import { NovaAskContext } from './novaAsk';
import { LAYOUT_SYSTEM, layoutSchema, refineScript, type LayoutProposal } from '../nova/specs';
import { OVERLAY_CLAUSE, RETRIEVE_N, retrieveBindings, WIDGET_SYSTEM, widgetSchema, type WidgetProposal } from '../nova/widgetSpec';
import type { BoardItem } from '../widgets/catalog';
import { AGENT_BY_ID } from '../agents/registry';
import { seedConversations, seedLedger } from '../nova/seed';
import { LOCAL_MODEL_ID, costUsd } from '../nova/models';
import { dayKey, estimateTokens, startOfToday } from '../nova/format';

// ── Nova state ────────────────────────────────────────────────────────────
// Everything Nova remembers, under ONE localStorage key so "Reset demo state"
// is one removeItem: its settings, the conversations, the usage ledger and
// the activity feed. Deliberately not in the global Settings SCHEMA — none of
// it should resolve through profile overrides, and it is one feature's demo
// state, not an app preference. Same shape as `trhs-modules` / `trhs-agents`.
//
// The script runner lives HERE rather than in the page: a reply that opens
// Play unmounts Nova, and the reply must still finish. The page registers its
// router-bound actions on mount; a step that acts uses whatever is
// registered at that moment.
const KEY = 'trhs-nova';

export type DemoSpeed = 'compressed' | 'fast' | 'instant';
export type NovaModelId = string;
export type MessageSource = 'scripted' | 'llm' | 'fallback';

export interface NovaSettings {
  llmEnabled: boolean;
  /** The full chat-completions URL — what the settings screenshot shows. */
  endpoint: string;
  model: string;
  demoSpeed: DemoSpeed;
  /** Assumed cloud price, USD per 1M tokens — what a local reply would have cost. */
  cloudRatePerM: number;
  /** Assumed draw while the local model answers, in watts. */
  localWatts: number;
}
export interface NovaUsage {
  inTokens: number;
  outTokens: number;
  seconds: number;
  estimated: boolean;
}
export interface NovaActionRecord {
  type: NovaActionCall['type'];
  label: string;
  at: number;
  /** What the chip performs. Optional only for records persisted before TH-435. */
  call?: NovaActionCall;
}
/** A live control in a reply (TH-437) — a kind, rebuilt into the bound component on render. */
export interface NovaControlRecord {
  kind: NovaControlKind;
  at: number;
  /** For `overlay`: the HUD that was built (TH-439). */
  spec?: OverlaySpec;
  /** For `card`: the dashboard widget that was composed (TH-443). */
  card?: CardSpec;
  /**
   * For `layout`: the arrangement that was proposed (TH-442). Persisted, so an
   * old conversation re-renders its diagram — which is why the preview
   * re-normalizes on render rather than trusting what was stored.
   */
  layout?: BoardItem[];
  /** For `agent-card`: which recipe card, and its props (agents/recipes.tsx). */
  agentCard?: AgentCardRef;
  /**
   * Conversations saved before the recipe manifest (2026-10-26) carry Catch Me
   * Up's card as kind `recap` and the refund agent's as kind `refund`, with
   * their props here. Read only by ChatLog's `agentCardOf`; nothing writes them.
   */
  recap?: Record<string, unknown>;
  refund?: Record<string, unknown>;
  /**
   * The built spec shown while the model composes (TH-453): the real card, no
   * chips, "composing" under it. Replaced by the model's record — same id —
   * or by the deterministic one when the call does not land. A stored record
   * that still carries it is rendered plainly: composing is a streaming state.
   */
  preview?: boolean;
}
export interface NovaMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  source: MessageSource;
  modelId: NovaModelId;
  agentId: string | null;
  status?: 'streaming' | 'error';
  actions?: NovaActionRecord[];
  controls?: NovaControlRecord[];
  usage?: NovaUsage;
}
export interface NovaConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: NovaMessage[];
  seeded?: boolean;
}
export interface UsageEvent {
  at: number;
  agentId: string | null;
  modelId: NovaModelId;
  inTokens: number;
  outTokens: number;
  seconds: number;
  costUsd: number;
  wh: number;
}
export interface NovaLedger {
  events: UsageEvent[];
  byAgent: Record<string, { runs: number; tokens: number; lastUsed: number }>;
  byDay: Record<string, { runs: number; tokens: number }>;
}
export interface ActivityItem {
  id: string;
  at: number;
  kind: 'run' | 'action' | 'agent-added' | 'agent-removed';
  agentId: string | null;
  text: string;
}

interface NovaStore {
  v: 1;
  settings: NovaSettings;
  conversations: NovaConversation[];
  activeConversationId: string | null;
  modelId: NovaModelId;
  agentId: string | null;
  ledger: NovaLedger;
  activity: ActivityItem[];
}

export const DEFAULT_SETTINGS: NovaSettings = {
  llmEnabled: false,
  endpoint: 'http://localhost:11434/v1/chat/completions',
  model: 'granite4.2:8b',
  demoSpeed: 'compressed',
  cloudRatePerM: 4,
  localWatts: 180,
};

/**
 * The endpoint and model `DEFAULT_SETTINGS` shipped BEFORE TH-441 (v0.2.32 and
 * v0.2.33, a llama-server setup). Kept so `migrateSettings` can recognise a
 * store that still carries them. Do not reuse these for anything else.
 */
const PRE_TH441_ENDPOINT = 'http://localhost:8086/v1/chat/completions';
const PRE_TH441_MODEL = 'hermes-4-14b';

/**
 * A persisted default is not a default. `loadStore` merges saved settings OVER
 * the defaults, so repointing `DEFAULT_SETTINGS` at Ollama fixed nothing for
 * anyone who had already opened Nova — their store still held `:8086` and the
 * reply read "could not reach it", with nothing to connect that to the cause.
 * This moves exactly that one stale pair forward.
 *
 * What it will NOT touch:
 *  • An endpoint that is anything other than the old shipped default. That is a
 *    choice someone made, and it is theirs.
 *  • The model, unless the endpoint moved too. Someone running a custom
 *    llama-server on `hermes-4-14b` must not have their model rewritten to
 *    `granite4.2:8b`, which that server does not have.
 *
 * Idempotent by construction: once rewritten the condition no longer matches.
 *
 * NOT a `v` bump, deliberately — `loadStore` DISCARDS the whole store when
 * `saved.v !== 1`, so bumping the version would throw away the conversations
 * and the usage ledger to fix two string fields. Please do not "tidy" this into
 * a version bump.
 */
function migrateSettings(s: NovaSettings): NovaSettings {
  if (s.endpoint !== PRE_TH441_ENDPOINT) return s;
  return {
    ...s,
    endpoint: DEFAULT_SETTINGS.endpoint,
    model: s.model === PRE_TH441_MODEL ? DEFAULT_SETTINGS.model : s.model,
  };
}

const EVENTS_CAP = 500;
const ACTIVITY_CAP = 200;
/** How much of a conversation the local model is shown. */
const HISTORY_TURNS = 12;

function initialStore(): NovaStore {
  return {
    v: 1,
    settings: { ...DEFAULT_SETTINGS },
    conversations: [],
    activeConversationId: null,
    modelId: LOCAL_MODEL_ID,
    agentId: null,
    ledger: { events: [], byAgent: {}, byDay: {} },
    activity: [],
  };
}

function loadStore(): NovaStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialStore();
    const saved = JSON.parse(raw) as Partial<NovaStore>;
    if (saved.v !== 1) return initialStore();
    const base = initialStore();
    return {
      ...base,
      ...saved,
      v: 1,
      // Saved settings win over the defaults — which is right for a preference
      // and wrong for a default that MOVED. See migrateSettings.
      settings: migrateSettings({ ...base.settings, ...(saved.settings ?? {}) }),
      ledger: { ...base.ledger, ...(saved.ledger ?? {}) },
    };
  } catch {
    /* storage unavailable / malformed */
    return initialStore();
  }
}

let idSeq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idSeq++).toString(36)}`;

export interface NovaTotals {
  tokensIn: number;
  tokensOut: number;
  seconds: number;
  cloudCostUsd: number;
  localWh: number;
  /** Of everything that would have cost cloud money, the share answered locally. */
  costAvoidedPct: number;
  runsToday: number;
  tokensToday: number;
}

export interface SendOptions {
  /** How the text arrived — the chips pass their script id so a label never has to round-trip through matching. */
  scriptId?: string;
}

interface NovaValue {
  settings: NovaSettings;
  setSetting: <K extends keyof NovaSettings>(key: K, value: NovaSettings[K]) => void;
  /** Seeds and the person's own, newest first. */
  conversations: NovaConversation[];
  active: NovaConversation | null;
  select: (id: string | null) => void;
  newConversation: () => void;
  send: (text: string, opts?: SendOptions) => void;
  /**
   * Nova speaks FIRST (TH-484): an agent's message with no question before it —
   * a warning it is watching for. Runs `script` as its agent in a new
   * conversation titled `title`, makes that the active one, and returns its id
   * so the caller can bring the panel up on it. Scripted only; never the model.
   */
  speak: (script: NovaScript, title: string) => string;
  /**
   * A follow-up in an EXISTING conversation (TH-509): an agent's next stage
   * message, arriving later, where the request was made — the composer stays
   * free between. False when the conversation is gone (a reset), so the
   * caller can stand down. Scripted only; never the model.
   */
  speakIn: (convId: string, script: NovaScript) => boolean;
  /** Perform one of a reply's offers — the chip's click. The only way Nova moves the app (TH-435). */
  perform: (call: NovaActionCall, label: string) => void;
  /** True while a reply is being produced in the active conversation. */
  busy: boolean;
  modelId: NovaModelId;
  setModelId: (id: NovaModelId) => void;
  agentId: string | null;
  setAgentId: (id: string | null) => void;
  ledger: NovaLedger;
  totals: NovaTotals;
  /** The last seven days, oldest first, seeds and live usage summed. */
  byDay7: { day: string; tokens: number; runs: number }[];
  activity: ActivityItem[];
  log: (item: Omit<ActivityItem, 'id' | 'at'>) => void;
  resetDemo: () => void;
  /** The page registers its router-bound actions on mount, and clears them on unmount. */
  registerActions: (actions: NovaActions | null) => void;
  /**
   * The shell registers a snapshot GETTER of real app state (TH-441). A getter,
   * not a value: this provider sits ABOVE DeviceSim and the router (main.tsx),
   * so it cannot read them itself, and reading at send time keeps the snapshot
   * current without a re-render per change.
   */
  registerContext: (get: NovaSnapshotGetter | null) => void;
}

const NovaContext = createContext<NovaValue | null>(null);

export function NovaProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<NovaStore>(loadStore);
  const storeRef = useRef(store);
  storeRef.current = store;
  // Admin's MVP scope, read at send time (send is memoised).
  const { mvpScope } = useSettings();
  const scopeRef = useRef(mvpScope);
  scopeRef.current = mvpScope;
  // Seeds are relative to today, regenerated per mount, never written.
  const seeds = useMemo(() => seedConversations(), []);
  const seedLed = useMemo(() => seedLedger(), []);
  const actionsRef = useRef<NovaActions | null>(null);
  // Live playtime for the recipes' replies (`RecipeCtx.playedMin` — the refund
  // agent's clock, TH-484). A ref, read at send time, so the clock ticking does
  // not re-create `send`.
  const playtime = usePlaytime();
  const playedMinRef = useRef(playtime.playedMin);
  playedMinRef.current = playtime.playedMin;
  // Forge's Add / Remove is a recipe's switch (Chris, 2026-10-26): routing
  // asks `has` at send time, through a ref as the clock is, so `send` need
  // not be rebuilt whenever the store changes.
  const agents = useAgents();
  const addedRef = useRef(agents.has);
  addedRef.current = agents.has;
  // Autocast's phase for its scripts (TH-509) — the same way, a ref at send time.
  const autocast = useAutocastOptional();
  const autocastRef = useRef(autocast?.session ?? AUTOCAST_IDLE);
  autocastRef.current = autocast?.session ?? AUTOCAST_IDLE;
  const contextRef = useRef<NovaSnapshotGetter | null>(null);
  const runs = useRef(new Map<string, AbortController>());
  const [busyIds, setBusyIds] = useState<string[]>([]);

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      /* storage full / unavailable */
    }
  }, [store]);

  const update = useCallback((fn: (s: NovaStore) => NovaStore) => setStore((s) => fn(s)), []);

  // ── Conversations ──────────────────────────────────────────────────────
  const conversations = useMemo(() => {
    const own = new Map(store.conversations.map((c) => [c.id, c]));
    const merged = [...seeds.filter((s) => !own.has(s.id)), ...store.conversations];
    return merged.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [store.conversations, seeds]);
  const active = useMemo(
    () => (store.activeConversationId ? conversations.find((c) => c.id === store.activeConversationId) ?? null : null),
    [conversations, store.activeConversationId],
  );

  const abortRun = useCallback((convId: string) => {
    runs.current.get(convId)?.abort();
    runs.current.delete(convId);
  }, []);

  const select = useCallback(
    (id: string | null) => {
      update((s) => ({ ...s, activeConversationId: id }));
    },
    [update],
  );
  const newConversation = useCallback(() => select(null), [select]);

  /** Make sure a conversation is in the store (copy-on-write for seeds) and return its id. */
  const materialize = (s: NovaStore, id: string | null, firstText: string): { store: NovaStore; id: string } => {
    if (id && s.conversations.some((c) => c.id === id)) return { store: s, id };
    const seed = id ? seeds.find((c) => c.id === id) : null;
    const conv: NovaConversation = seed
      ? { ...seed, messages: [...seed.messages] }
      : { id: newId('c'), title: firstText.slice(0, 60), createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    return { store: { ...s, conversations: [...s.conversations, conv], activeConversationId: conv.id }, id: conv.id };
  };

  const appendMessage = (convId: string, m: NovaMessage) =>
    update((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, m], updatedAt: m.at } : c)),
    }));
  const patchMessage = (convId: string, msgId: string, patch: Partial<NovaMessage>) =>
    update((s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id === convId ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) } : c,
      ),
    }));

  // ── Ledger ─────────────────────────────────────────────────────────────
  // Cost and energy are fixed at the moment of the reply: a local reply is
  // priced at the assumed cloud rate (what it would have cost), a reply
  // "answered as" a vendor model at that model's published rates. Changing an
  // assumption later applies going forward — history is not rewritten.
  const recordUsage = (e: Omit<UsageEvent, 'costUsd' | 'wh'>) =>
    update((s) => {
      const cost = costUsd(e.modelId, e.inTokens, e.outTokens, s.settings);
      const wh = e.modelId === LOCAL_MODEL_ID ? (e.seconds * s.settings.localWatts) / 3600 : 0;
      const ev: UsageEvent = { ...e, costUsd: cost, wh };
      const day = dayKey(e.at);
      const tokens = e.inTokens + e.outTokens;
      const byDay = { ...s.ledger.byDay, [day]: { runs: (s.ledger.byDay[day]?.runs ?? 0) + 1, tokens: (s.ledger.byDay[day]?.tokens ?? 0) + tokens } };
      const byAgent = e.agentId
        ? {
            ...s.ledger.byAgent,
            [e.agentId]: {
              runs: (s.ledger.byAgent[e.agentId]?.runs ?? 0) + 1,
              tokens: (s.ledger.byAgent[e.agentId]?.tokens ?? 0) + tokens,
              lastUsed: e.at,
            },
          }
        : s.ledger.byAgent;
      return { ...s, ledger: { events: [...s.ledger.events, ev].slice(-EVENTS_CAP), byDay, byAgent } };
    });

  const log = useCallback(
    (item: Omit<ActivityItem, 'id' | 'at'>) =>
      update((s) => ({ ...s, activity: [{ ...item, id: newId('a'), at: Date.now() }, ...s.activity].slice(0, ACTIVITY_CAP) })),
    [update],
  );

  // ── The runner ─────────────────────────────────────────────────────────
  /** The last turns of a conversation as the model should see them. */
  const turnsFor = (conv: NovaConversation | undefined, agentId: string | null, upTo: string): ChatTurn[] => {
    // One append teaches all ten speakers — Nova and the nine personas — both
    // the grounding contract and the length limit. Putting either in
    // NOVA_SYSTEM would teach exactly one of them (see personas.ts BREVITY).
    const system = (agentId ? PERSONAS[agentId]?.system ?? NOVA_SYSTEM : NOVA_SYSTEM) + BREVITY + CONTEXT_CONTRACT;
    const history = (conv?.messages ?? [])
      .filter((m) => m.id !== upTo && m.text.trim() && m.status !== 'error')
      .slice(-HISTORY_TURNS)
      .map<ChatTurn>((m) => ({ role: m.role, content: m.text }));
    return [{ role: 'system', content: system }, ...history];
  };

  /**
   * Unmatched input with a local model on: stream it in. Any failure but a
   * deliberate abort becomes the plain "could not reach it" reply — with
   * whatever text had arrived kept above it — never an empty bubble.
   */
  const runLlm = (convId: string, replyId: string, userText: string, agentId: string | null, s: NovaStore, ac: AbortController, started: number) => {
    const conv = s.conversations.find((c) => c.id === convId);
    // Grounding (TH-441). The block rides on the TAIL of this one turn, not the
    // system message: volatile state at the front of the prompt invalidates the
    // KV prefix every turn, and Granite drops a system message that is not
    // messages[0]. Because `turnsFor` maps the STORED `m.text`, augmenting only
    // this request's content keeps the log, the conversation preview and every
    // later turn exactly what the person typed. A throw here must never reach
    // the .catch below, which is not allowed to reject (verify-nova:115-121).
    let grounded = userText;
    try {
      const snap = contextRef.current?.();
      if (snap) grounded = `${userText}\n\n${renderSnapshot(snap, catalogOf(snap))}`;
    } catch {
      grounded = userText;
    }
    const messages = [...turnsFor(conv, agentId, replyId), { role: 'user' as const, content: grounded }];
    let acc = '';
    return streamChat({
      endpoint: s.settings.endpoint,
      model: s.settings.model,
      messages,
      signal: ac.signal,
      // A cold model load is the normal first question of a session, not a
      // fault: Ollama loads several GB before it writes a byte. The 5s default
      // in llm.ts would turn that into the "could not reach it" reply while the
      // server worked perfectly — the house failure mode exactly (TH-441).
      connectTimeoutMs: 30_000,
      // Nova wants three grounded sentences, not a train of thought it then
      // discards — `streamChat` reads only `delta.content`, so reasoning is
      // billed and thrown away. Measured on granite4.2:8b: 149 completion
      // tokens with it, 24 without. The cap is the backstop, and must never be
      // set without this, or the budget can go entirely on reasoning and leave
      // an empty bubble (TH-441).
      reasoningEffort: 'none',
      maxTokens: 320,
      onToken: (d) => {
        acc += d;
        patchMessage(convId, replyId, { text: acc });
      },
    })
      .then((r) => {
        const usage: NovaUsage = r.usage
          ? { inTokens: r.usage.prompt_tokens, outTokens: r.usage.completion_tokens, seconds: r.seconds, estimated: false }
          : { inTokens: estimateTokens(messages.map((m) => m.content).join('\n')), outTokens: estimateTokens(r.text), seconds: r.seconds, estimated: true };
        patchMessage(convId, replyId, { text: r.text, status: undefined, usage });
        recordUsage({ at: Date.now(), agentId, modelId: s.modelId, inTokens: usage.inTokens, outTokens: usage.outTokens, seconds: usage.seconds });
        log({ kind: 'run', agentId, text: `${agentId ? AGENT_BY_ID[agentId]?.name ?? agentId : 'Nova'} answered “${userText}” (local model)` });
      })
      .catch((e: unknown) => {
        const err = e instanceof LlmError ? e : new LlmError('unreachable', String(e));
        if (err.kind === 'aborted') {
          patchMessage(convId, replyId, { status: undefined });
          return;
        }
        const note = SCRIPT_BY_ID['llm-unreachable'].steps.map((st) => ('say' in st ? st.say : '')).join('');
        const text = acc ? `${acc}\n\n${note}` : note;
        const seconds = (Date.now() - started) / 1000;
        patchMessage(convId, replyId, { text, status: 'error', source: 'fallback', usage: { inTokens: estimateTokens(userText), outTokens: estimateTokens(text), seconds, estimated: true } });
        log({ kind: 'run', agentId, text: `Local model unreachable (${err.kind}) — answered “${userText}” in demo mode` });
      });
  };

  /**
   * The schema-constrained call (TH-444) — the one place `specs.ts` is used.
   *
   * It runs ONLY for a reply the builder marked `refine`, i.e. one where the
   * regex recognised the kind of request and not its content. That is the whole
   * policy: the patterns answer what they can match, and the model answers what
   * they could not. A confident deterministic reply is never traded for a slower
   * one, and `fallback` means a model that is missing, slow or wrong still
   * produces the reply that was already going to be shown — never an error.
   *
   * It BLOCKS rather than refining in place, with the typing dots already
   * showing. Swapping a card or a board after the person can see it would move
   * the spec out from under the chips they are reading, which is the same class
   * of problem TH-435 exists to prevent. Waiting a few seconds for the right
   * answer is the honest trade, and it is only ever paid on a guess — which,
   * before this, was answered with something simply wrong.
   *
   * No `<nova-context>` block here, deliberately. The ids and their names ride
   * in the schema's `enum` and the request's own system message, where they cost
   * nothing in the chat's context budget and cannot be ignored the way prose can
   * (see `specs.ts`). Grounding is for conversation, not for a lookup table.
   */
  const runStructured = (
    convId: string,
    replyId: string,
    text: string,
    agentId: string | null,
    s: NovaStore,
    script: NovaScript,
    /**
     * Passed rather than read off `script.refine`, so the type system carries
     * the guarantee instead of a `!`. The gate that guarantees it lives in
     * `send`, and the assumption used to live here — widening one without the
     * other threw a TypeError in render rather than failing a check.
     */
    kind: RefineKind,
    ac: AbortController,
  ) => {
    let snap: ReturnType<NovaSnapshotGetter> | null = null;
    try {
      snap = contextRef.current?.() ?? null;
    } catch {
      snap = null;
    }
    const ctx = snap ? layoutContextOf(snap) : {};
    const surface = script.refine?.surface ?? 'card';
    // The widget's enum is RETRIEVED, not the whole registry (TH-452): the rows
    // the sentence named, their domains' siblings, and the core — capped at the
    // measured `RETRIEVE_N`. Prompt length is the latency dial.
    const candidates = kind === 'widget' ? retrieveBindings(text, ctx.gate, RETRIEVE_N) : [];
    const spec = kind === 'layout' ? layoutSchema(ctx) : widgetSchema(candidates, surface);
    // The catalog lines go in THIS request's system message, so their
    // completion tokens are paid on these turns and on no others.
    const system = kind === 'layout' ? `${LAYOUT_SYSTEM}

The widgets available right now:
${spec.catalog}` : `${WIDGET_SYSTEM}${surface === 'overlay' ? OVERLAY_CLAUSE : ''}

The vocabulary available right now:
${spec.catalog}`;

    // The built spec goes up at once as a PREVIEW (TH-453) — the real card, no
    // chips, "composing" under it — so the seconds the model takes are never an
    // empty bubble, and nothing moves out from under a reader: the model's card
    // keeps this id, its items begin with these, and the chips arrive once, at
    // the end. TH-444 rejected an in-place swap because the chips moved; with
    // no chips until the final card there is nothing to move.
    const built = script.refine?.built;
    if (built) {
      patchMessage(convId, replyId, {
        controls: [surface === 'overlay'
          ? { kind: 'overlay', at: Date.now(), preview: true, spec: built as OverlaySpec }
          : { kind: 'card', at: Date.now(), preview: true, card: built as CardSpec }],
      });
    }

    const startedAt = Date.now();
    /**
     * Walk a script and finish the message the way the scripted path does —
     * ledger included. A reply that skipped `recordUsage` would be the only one
     * in the app missing from Tokenomics, which is the kind of hole that only
     * shows up as a number being slightly wrong.
     */
    const walk = (toRun: NovaScript, usage?: NovaUsage, note?: string) =>
      runScript(toRun, {
        speed: s.settings.demoSpeed,
        signal: ac.signal,
        persona: agentId ? PERSONAS[agentId] : undefined,
        patch: (p) => patchMessage(convId, replyId, { ...(p.text != null ? { text: p.text } : {}), ...(p.actions ? { actions: p.actions } : {}), ...(p.controls ? { controls: p.controls } : {}) }),
      })
        .then(({ text: finalText }) => {
          const seconds = (Date.now() - startedAt) / 1000;
          const u: NovaUsage = usage ?? { inTokens: estimateTokens(text), outTokens: estimateTokens(finalText), seconds, estimated: true };
          patchMessage(convId, replyId, { status: undefined, usage: u });
          recordUsage({ at: Date.now(), agentId, modelId: s.modelId, inTokens: u.inTokens, outTokens: u.outTokens, seconds: u.seconds });
          if (note) log({ kind: 'run', agentId, text: note });
        })
        // Aborted: the conversation was switched or reset mid-reply. Leave what
        // arrived and drop the typing state — `runScript` rejects on abort, and
        // an uncaught one here is an unhandled rejection, not a visible failure.
        .catch(() => patchMessage(convId, replyId, { status: undefined }));

    /** The deterministic reply, exactly as it would have been shown. */
    const fallback = (why: string) =>
      walk(script, undefined, `Structured ${kind} call did not land (${why}) — answered “${text}” from the builder`);

    return requestJson<LayoutProposal | WidgetProposal>({
      endpoint: s.settings.endpoint,
      model: s.settings.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: text }],
      signal: ac.signal,
      schema: spec.schema,
      schemaName: spec.name,
      // A layout request carries ~26 ids and measured 9–17s against ~4s for a
      // card; both budgets are the measurement plus room for a cold load, and
      // both end in the deterministic reply rather than in an error.
      connectTimeoutMs: kind === 'layout' ? 25_000 : 20_000,
      // Same pair as `runLlm`, and for the same reason: without
      // `reasoning_effort` the cap can go entirely on reasoning and return
      // valid JSON cut off mid-object (gotcha 43).
      reasoningEffort: 'none',
      maxTokens: 400,
    })
      .then((r) => {
        const refined = refineScript(kind, r.value, ctx, snap?.boardLayout ?? [], text, script.refine ? { items: script.refine.seed, absent: script.refine.absent, readAll: script.refine.readAll, built: script.refine.built } : undefined, candidates, surface);
        if (!refined) return fallback('the proposal held nothing renderable');
        // The model's OWN numbers when it reported them — one call, one ledger
        // entry, so Tokenomics still shows what was really spent.
        const usage: NovaUsage = r.usage
          ? { inTokens: r.usage.prompt_tokens, outTokens: r.usage.completion_tokens, seconds: r.seconds, estimated: false }
          : { inTokens: estimateTokens(system + text), outTokens: estimateTokens(JSON.stringify(r.value)), seconds: r.seconds, estimated: true };
        patchMessage(convId, replyId, { source: 'llm' });
        return walk(refined, usage, `Nova composed a ${kind} for “${text}” (local model, ${r.seconds.toFixed(1)}s)`);
      })
      .catch((e: unknown) => {
        const err = e instanceof LlmError ? e : new LlmError('unreachable', String(e));
        // An abort is the person's own doing — leave the message as it is.
        if (err.kind === 'aborted') {
          patchMessage(convId, replyId, { status: undefined });
          return;
        }
        return fallback(err.kind);
      });
  };

  const send = useCallback(
    (text: string, opts: SendOptions = {}) => {
      const t = text.trim();
      if (!t) return;
      const s0 = storeRef.current;
      const { store: s1, id: convId } = materialize(s0, s0.activeConversationId, t);
      const now = Date.now();
      const userMsg: NovaMessage = { id: newId('m'), role: 'user', text: t, at: now, source: 'scripted', modelId: s0.modelId, agentId: null };
      // An overlay request is BUILT, not matched: the reply is made from what
      // it names (TH-439). The Overlay pill goes the same way, so the pill and
      // a typed "overlay" are one path.
      // Order matters, and all three builders read the same sentence:
      //
      //  1. `overlayScriptFor` — `parseOverlayRequest` requires the literal word
      //     "overlay"/"hud", which is a decision about WHERE the thing goes, so
      //     "an fps overlay" is an overlay even though it would make a fine card.
      //  2. `cardScriptFor` (TH-443) — before the layout builder, whose
      //     `BOARD_NOUN` matches `widgets?` and whose `CHANGE_VERB` matches
      //     `make`: "make me a widget with cpu temp and fps" would otherwise be
      //     read as "rearrange my dashboard" and answered with a recipe, the
      //     request's actual content thrown away.
      //  3. `layoutScriptFor` — and it must come BEFORE `matchScript`, whose
      //     topic regexes (/fan/i, /\bthermal/i, /bright/i, /\bdpi\b/i,
      //     /\blighting\b/i) would otherwise steal "add the thermal widget".
      let snapForLayout: ReturnType<NovaSnapshotGetter> | null = null;
      try {
        snapForLayout = contextRef.current?.() ?? null;
      } catch {
        snapForLayout = null;
      }
      const boardCtx = snapForLayout ? layoutContextOf(snapForLayout) : null;
      const cardScript = boardCtx ? cardScriptFor(t, boardCtx) : null;
      const layoutScript = boardCtx && snapForLayout ? layoutScriptFor(t, boardCtx, snapForLayout.boardLayout) : null;
      // The Nova recipes go FIRST (agents/recipeScripts.ts, in priority order):
      // a recipe's lines must never reach a builder or the model. Catch Me
      // Up's "keep me caught up on everything" has no widget noun the card
      // builder would read, a recap must be the scripted, spoiler-checked one
      // every time, and the refund agent's rule and steps must be the checked
      // ones — no `refine`, so a configured model never runs for them.
      const matched = recipeScriptFor(t, { playedMin: (id) => playedMinRef.current(id), added: (id) => addedRef.current(id), autocast: snapshotOf(autocastRef.current, SPEED[s0.settings.demoSpeed]) }) || overlayScriptFor(t) || cardScript || layoutScript || (opts.scriptId && SCRIPT_BY_ID[opts.scriptId]) || matchScript(t);
      // A script that names its speaker answers as that agent, whoever is selected.
      const agentId = matched?.agentId ?? s0.agentId;
      const useLlm = !matched && s0.settings.llmEnabled;
      // A builder that GUESSED, with a model to ask (TH-444). The reply is still
      // a built one — the model only chooses its contents — so this is not the
      // `useLlm` streaming path and must not be marked as it until the call
      // actually lands (`runStructured` patches `source`).
      const useStructured = !!matched?.refine && s0.settings.llmEnabled;
      const script: NovaScript = scriptForScope(matched ?? SCRIPT_BY_ID['demo-mode'], scopeRef.current);
      const reply: NovaMessage = {
        id: newId('m'),
        role: 'assistant',
        text: '',
        at: now + 1,
        source: useLlm ? 'llm' : script.kind === 'system' ? 'fallback' : 'scripted',
        modelId: s0.modelId,
        agentId,
        status: 'streaming',
      };
      // One update for the materialized store + both messages, then the run.
      const s2: NovaStore = {
        ...s1,
        conversations: s1.conversations.map((c) =>
          c.id === convId ? { ...c, messages: [...c.messages, userMsg, reply], updatedAt: reply.at } : c,
        ),
      };
      setStore(s2);
      // The line IS the press (TH-509, `NovaScript.confirms`): perform it now,
      // before the reply runs, so the store has moved when its card renders.
      // Through `performAction` directly — `perform` is defined below and asks
      // `send` for `ask` chips, which a confirm never is. The conversation id
      // rides on an autocast call: the store ref has not seen `s2` yet.
      if (matched?.confirms) {
        const c = matched.confirms;
        const call = c.call.type === 'autocast' ? { ...c.call, convId } : c.call;
        const performed = performAction(actionsRef.current, call);
        log({ kind: 'action', agentId: matched.agentId ?? s0.agentId, text: performed ? c.label : `${c.label} (the app was not ready)` });
      }

      abortRun(convId);
      const ac = new AbortController();
      runs.current.set(convId, ac);
      setBusyIds((b) => [...b, convId]);
      const started = Date.now();
      const done = () => {
        if (runs.current.get(convId) === ac) runs.current.delete(convId);
        setBusyIds((b) => b.filter((id) => id !== convId));
      };
      if (useLlm) {
        runLlm(convId, reply.id, t, agentId, s2, ac, started).finally(done);
        return;
      }
      if (useStructured && matched?.refine) {
        runStructured(convId, reply.id, t, agentId, s2, matched, matched.refine.kind, ac).finally(done);
        return;
      }
      runScript(script, {
        speed: s0.settings.demoSpeed,
        signal: ac.signal,
        persona: agentId ? PERSONAS[agentId] : undefined,
        patch: (p) => patchMessage(convId, reply.id, { ...(p.text != null ? { text: p.text } : {}), ...(p.actions ? { actions: p.actions } : {}), ...(p.controls ? { controls: p.controls } : {}) }),
      })
        .then(({ text: finalText }) => {
          const seconds = (Date.now() - started) / 1000;
          const usage: NovaUsage = { inTokens: estimateTokens(t), outTokens: estimateTokens(finalText), seconds, estimated: true };
          patchMessage(convId, reply.id, { status: undefined, usage });
          recordUsage({ at: Date.now(), agentId, modelId: s0.modelId, inTokens: usage.inTokens, outTokens: usage.outTokens, seconds });
          log({ kind: 'run', agentId, text: script.logText ?? `${agentId ? AGENT_BY_ID[agentId]?.name ?? agentId : 'Nova'} answered “${t}”` });
        })
        .catch(() => {
          // Aborted: the conversation was switched or reset mid-reply. Leave
          // what arrived, drop the typing state.
          patchMessage(convId, reply.id, { status: undefined });
        })
        .finally(done);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [abortRun, log, update, seeds],
  );

  /**
   * An unprompted assistant message in conversation `convId` — `speak`'s run
   * and `speakIn`'s (TH-509), one body. The run is keyed by the REPLY, not the
   * conversation: a person's own `send()` aborts the conversation's run, and
   * a stage message arriving while they type must not be the thing it kills.
   */
  const runReplyIn = (convId: string, reply: NovaMessage, script: NovaScript) => {
    const s0 = storeRef.current;
    const agentId = script.agentId ?? null;
    const ac = new AbortController();
    runs.current.set(reply.id, ac);
    setBusyIds((b) => [...b, convId]);
    const started = Date.now();
    runScript(script, {
      speed: s0.settings.demoSpeed,
      signal: ac.signal,
      persona: agentId ? PERSONAS[agentId] : undefined,
      patch: (p) => patchMessage(convId, reply.id, { ...(p.text != null ? { text: p.text } : {}), ...(p.actions ? { actions: p.actions } : {}), ...(p.controls ? { controls: p.controls } : {}) }),
    })
      .then(({ text: finalText }) => {
        const seconds = (Date.now() - started) / 1000;
        const usage: NovaUsage = { inTokens: 0, outTokens: estimateTokens(finalText), seconds, estimated: true };
        patchMessage(convId, reply.id, { status: undefined, usage });
        recordUsage({ at: Date.now(), agentId, modelId: s0.modelId, inTokens: 0, outTokens: usage.outTokens, seconds });
        log({ kind: 'run', agentId, text: script.logText ?? `${agentId ? AGENT_BY_ID[agentId]?.name ?? agentId : 'Nova'} spoke up` });
      })
      .catch(() => patchMessage(convId, reply.id, { status: undefined }))
      .finally(() => {
        if (runs.current.get(reply.id) === ac) runs.current.delete(reply.id);
        // One occurrence: two stage messages in one conversation are two busies.
        setBusyIds((b) => {
          const i = b.indexOf(convId);
          return i < 0 ? b : [...b.slice(0, i), ...b.slice(i + 1)];
        });
      });
  };

  const speak = useCallback(
    (script: NovaScript, title: string): string => {
      const s0 = storeRef.current;
      const now = Date.now();
      const convId = newId('c');
      const reply: NovaMessage = { id: newId('m'), role: 'assistant', text: '', at: now, source: 'scripted', modelId: s0.modelId, agentId: script.agentId ?? null, status: 'streaming' };
      const conv: NovaConversation = { id: convId, title, createdAt: now, updatedAt: now, messages: [reply] };
      setStore((s) => ({ ...s, conversations: [...s.conversations, conv], activeConversationId: convId }));
      runReplyIn(convId, reply, script);
      return convId;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [log],
  );

  const speakIn = useCallback(
    (convId: string, script: NovaScript): boolean => {
      const s0 = storeRef.current;
      if (!s0.conversations.some((c) => c.id === convId)) return false;
      const now = Date.now();
      const reply: NovaMessage = { id: newId('m'), role: 'assistant', text: '', at: now, source: 'scripted', modelId: s0.modelId, agentId: script.agentId ?? null, status: 'streaming' };
      setStore((s) => ({ ...s, conversations: s.conversations.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, reply], updatedAt: now } : c)) }));
      runReplyIn(convId, reply, script);
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [log],
  );

  // The activity feed records the act here, at the press, because this is
  // where it happens — a reply no longer acts on its own (TH-435).
  const perform = useCallback(
    (call: NovaActionCall, label: string) => {
      // A follow-up chip asks rather than acts (TH-478): it is the next turn.
      if (call.type === 'ask') {
        send(call.text);
        return;
      }
      const performed = performAction(actionsRef.current, call);
      log({ kind: 'action', agentId: storeRef.current.agentId, text: performed ? label : `${label} (the app was not ready)` });
    },
    [log, send],
  );

  // ── Derived ────────────────────────────────────────────────────────────
  const totals = useMemo<NovaTotals>(() => {
    const ev = store.ledger.events;
    const sum = (f: (e: UsageEvent) => number) => ev.reduce((n, e) => n + f(e), 0);
    const localCloudEq = sum((e) => (e.modelId === LOCAL_MODEL_ID ? e.costUsd : 0));
    const total = sum((e) => e.costUsd);
    const today = startOfToday();
    const todays = ev.filter((e) => e.at >= today);
    return {
      tokensIn: sum((e) => e.inTokens),
      tokensOut: sum((e) => e.outTokens),
      seconds: sum((e) => e.seconds),
      cloudCostUsd: total,
      localWh: sum((e) => e.wh),
      costAvoidedPct: total > 0 ? localCloudEq / total : 0,
      runsToday: todays.length,
      tokensToday: todays.reduce((n, e) => n + e.inTokens + e.outTokens, 0),
    };
  }, [store.ledger.events]);

  const byDay7 = useMemo(() => {
    const today = startOfToday();
    const out: { day: string; tokens: number; runs: number }[] = [];
    for (let d = 6; d >= 0; d--) {
      const key = dayKey(today - d * 86_400_000);
      const a = seedLed.byDay[key];
      const b = store.ledger.byDay[key];
      out.push({ day: key, tokens: (a?.tokens ?? 0) + (b?.tokens ?? 0), runs: (a?.runs ?? 0) + (b?.runs ?? 0) });
    }
    return out;
  }, [store.ledger.byDay, seedLed]);

  const ledger = useMemo<NovaLedger>(() => {
    const byAgent: NovaLedger['byAgent'] = { ...seedLed.byAgent };
    for (const [id, v] of Object.entries(store.ledger.byAgent)) {
      const s = byAgent[id];
      byAgent[id] = s ? { runs: s.runs + v.runs, tokens: s.tokens + v.tokens, lastUsed: Math.max(s.lastUsed, v.lastUsed) } : v;
    }
    return { events: store.ledger.events, byAgent, byDay: store.ledger.byDay };
  }, [store.ledger, seedLed]);

  const registerActions = useCallback((a: NovaActions | null) => {
    actionsRef.current = a;
  }, []);

  const registerContext = useCallback((g: NovaSnapshotGetter | null) => {
    contextRef.current = g;
  }, []);

  const resetDemo = useCallback(() => {
    runs.current.forEach((ac) => ac.abort());
    runs.current.clear();
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setStore(initialStore());
  }, []);

  const value = useMemo<NovaValue>(
    () => ({
      settings: store.settings,
      setSetting: (key, v) => update((s) => ({ ...s, settings: { ...s.settings, [key]: v } })),
      conversations,
      active,
      select,
      newConversation,
      send,
      speak,
      speakIn,
      perform,
      busy: !!active && busyIds.includes(active.id),
      modelId: store.modelId,
      setModelId: (id) => update((s) => ({ ...s, modelId: id })),
      agentId: store.agentId,
      setAgentId: (id) => update((s) => ({ ...s, agentId: id })),
      ledger,
      totals,
      byDay7,
      activity: store.activity,
      log,
      resetDemo,
      registerActions,
      registerContext,
    }),
    [store, conversations, active, select, newConversation, send, speak, speakIn, perform, busyIds, ledger, totals, byDay7, log, resetDemo, registerActions, registerContext, update],
  );

  return (
    <NovaContext.Provider value={value}>
      {/* `send` for surfaces the widget catalog imports, which must not import this file (gotcha 51). */}
      <NovaAskContext.Provider value={send}>{children}</NovaAskContext.Provider>
    </NovaContext.Provider>
  );
}

export function useNova(): NovaValue {
  const ctx = useContext(NovaContext);
  if (!ctx) throw new Error('useNova must be used within <NovaProvider>');
  return ctx;
}
