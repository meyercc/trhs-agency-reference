import { useSearchParams } from 'react-router-dom';

export type NovaView = 'chat' | 'agents';

/**
 * Nova's view IS the URL: `#/nova` is Chat, `#/nova?view=agents` is Agents.
 * Two-way — reading `?view=` as the value and writing it on change — which no
 * other `?tab=`-style param in the app does (they are one-way useState seeds,
 * the documented cause of gotcha 33). Pushed, not replaced, so Back flips the
 * view. Chat is canonical with no param, so a pasted link is as short as it
 * can be. Named `view` rather than `tab` because `?tab=` already belongs to
 * the modal hosts, which delete it whenever a modal closes.
 */
export function useNovaView(): [NovaView, (v: NovaView) => void] {
  const [params, setParams] = useSearchParams();
  const view: NovaView = params.get('view') === 'agents' ? 'agents' : 'chat';
  const setView = (v: NovaView) => {
    const p = new URLSearchParams(params);
    if (v === 'chat') p.delete('view');
    else p.set('view', v);
    setParams(p);
  };
  return [view, setView];
}
