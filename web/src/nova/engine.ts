/**
 * Walks one scripted interaction: typing dots, paragraphs, the things it
 * offers to do. Pure of React — the provider hands it a patch function, the
 * speed and an abort signal, and it reports the text and the offers. Lives
 * apart from the provider so it can be read as the one place the "demo
 * speed" and "explain, then offer" rules are implemented.
 *
 * It does not act. `performAction` is here because the provider runs it when
 * a chip is pressed — the one moment Nova is allowed to move the app (TH-435).
 */
import { SPEED, type NovaActionCall, type NovaScript } from './scripts';
import type { DemoSpeed, NovaActionRecord, NovaControlRecord } from '../state/Nova';
import type { Persona } from './personas';

export interface NovaActions {
  navigate: (to: string) => void;
  openModal: (id: string, params?: Record<string, string>) => void;
  selectProfile: (id: string) => void;
  /** Overlays (TH-439): put a built one on screen, or take one away. */
  placeOverlay: (spec: import('../state/overlays').OverlaySpec) => void;
  removeOverlay: (id: string) => void;
  /**
   * The home dashboard's arrangement (TH-442). `apply` MERGES onto what is
   * there — the board hides rather than deletes a widget whose module or device
   * is away, and a proposal only ever names the visible ones, so an assignment
   * would silently delete the rest. `restore` is the undo and assigns exactly.
   */
  applyLayout: (items: import('../widgets/catalog').BoardItem[]) => void;
  restoreLayout: (items: import('../widgets/catalog').BoardItem[]) => void;
  /**
   * A custom card (TH-443): the spec into the store and its id onto the board,
   * as one write. `takeCardOff` is the undo and takes it OFF THE BOARD ONLY —
   * exactly what the cell's own ✕ does for every widget, so the card is still
   * in the picker's "Custom" group rather than gone.
   */
  addCard: (spec: import('../state/overlays').CardSpec) => void;
  takeCardOff: (id: string) => void;
  /** One catalog widget onto the end of the board, keeping the rest (TH-443). */
  addWidget: (id: string) => void;
  /** Pick a game back up: its linked profile applies, then Play opens on it (TH-478). */
  resumeGame: (gameId: string) => void;
  /** Autocast's session moves (TH-509) — the shell owns the store, Forge's add and the launch. */
  autocast: (call: Extract<NovaActionCall, { type: 'autocast' }>) => void;
}

export interface RunContext {
  speed: DemoSpeed;
  signal: AbortSignal;
  /** The agent answering, if one is selected — its opener leads the first paragraph. */
  persona?: Persona;
  /** Push the reply's current text, offers and live controls to the message. */
  patch: (p: { text?: string; actions?: NovaActionRecord[]; controls?: NovaControlRecord[]; typing?: boolean }) => void;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('aborted', 'AbortError'));
    }, { once: true });
  });

export function performAction(actions: NovaActions | null, call: NovaActionCall): boolean {
  // Leaving the app needs no router, so it works before the shell registers.
  if (call.type === 'openUrl') {
    window.open(call.url, '_blank', 'noopener,noreferrer');
    return true;
  }
  if (!actions) return false;
  switch (call.type) {
    case 'navigate':
      actions.navigate(call.to);
      return true;
    case 'openModal':
      actions.openModal(call.id, call.params);
      return true;
    case 'selectProfile':
      actions.selectProfile(call.id);
      return true;
    case 'placeOverlay':
      actions.placeOverlay(call.spec);
      return true;
    case 'removeOverlay':
      actions.removeOverlay(call.id);
      return true;
    case 'applyLayout':
      actions.applyLayout(call.items);
      return true;
    case 'restoreLayout':
      actions.restoreLayout(call.items);
      return true;
    case 'addCard':
      actions.addCard(call.spec);
      return true;
    case 'takeCardOff':
      actions.takeCardOff(call.id);
      return true;
    case 'addWidget':
      actions.addWidget(call.id);
      return true;
    case 'resumeGame':
      actions.resumeGame(call.gameId);
      return true;
    case 'autocast':
      actions.autocast(call);
      return true;
    // A follow-up question is sent, not performed — the provider's `perform`
    // takes it before it gets here, since only the provider can `send`.
    case 'ask':
      return false;
  }
}

/** Resolves with the final text and the actions taken. Rejects only on abort. */
export async function runScript(script: NovaScript, ctx: RunContext): Promise<{ text: string; actions: NovaActionRecord[] }> {
  const k = SPEED[ctx.speed];
  const paragraphs: string[] = [];
  const actions: NovaActionRecord[] = [];
  const controls: NovaControlRecord[] = [];
  let first = true;

  for (const step of script.steps) {
    if ('pause' in step) {
      await sleep(step.pause * k, ctx.signal);
      continue;
    }
    if (step.delay) await sleep(step.delay * k, ctx.signal);
    if ('say' in step) {
      ctx.patch({ typing: true });
      await sleep((step.typing ?? 600) * k, ctx.signal);
      const text = first && ctx.persona ? `${ctx.persona.opener} ${step.say}` : step.say;
      first = false;
      paragraphs.push(text);
      ctx.patch({ text: paragraphs.join('\n\n'), typing: false });
    } else if ('control' in step) {
      // A descriptor, not a component: the message persists, and the control
      // is rebuilt from the kind when the log renders (ChatLog → ChatControl).
      controls.push({
        kind: step.control,
        at: Date.now(),
        ...(step.spec ? { spec: step.spec } : {}),
        ...(step.card ? { card: step.card } : {}),
        ...(step.layout ? { layout: step.layout } : {}),
        ...(step.agentCard ? { agentCard: step.agentCard } : {}),
      });
      ctx.patch({ controls: [...controls] });
    } else {
      // The call rides on the record, so the chip performs exactly what was
      // offered rather than re-finding it by label across every script.
      actions.push({ type: step.offer.type, label: step.label, at: Date.now(), call: step.offer });
      ctx.patch({ actions: [...actions] });
    }
  }
  return { text: paragraphs.join('\n\n'), actions };
}
