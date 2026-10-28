/**
 * "Ask Nova this" for surfaces under the widget catalog (TH-478).
 *
 * A LEAF on purpose: it imports nothing from the app. Anything the catalog
 * imports must not import `state/Nova.tsx` — that closes the cycle through
 * `nova/specs.ts` → `widgets/layout.ts` and blanks the app with "Cannot access
 * 'MAX_ITEMS' before initialization" (gotcha 51). The Last Played widget's
 * "Catch me up" needs only to send a sentence, so NovaProvider hands its
 * `send` down through this context and the widget reads it here.
 *
 * Null outside a NovaProvider (Storybook) — the caller hides its button.
 */
import { createContext, useContext } from 'react';

export const NovaAskContext = createContext<((text: string) => void) | null>(null);

export function useNovaAsk(): ((text: string) => void) | null {
  return useContext(NovaAskContext);
}
