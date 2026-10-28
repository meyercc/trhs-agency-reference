import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { IconName, ToastTone } from '../components';

// ── Toasts (TH-484) ──────────────────────────────────────────────────────
// What the app is telling you that you did not ask for. A leaf context —
// raising a toast must not drag a provider's imports into the widget catalog
// (gotcha 51). AppShell hosts the one `ToastStack` that draws them.

export interface ToastAction {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'accent' | 'ghost';
}

export interface ToastSpec {
  /** Raising the same id again replaces the toast instead of stacking a copy. */
  id: string;
  title: string;
  message?: string;
  tone?: ToastTone;
  icon?: IconName;
  actions?: ToastAction[];
}

interface ToastsValue {
  toasts: ToastSpec[];
  notify: (t: ToastSpec) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastsContext = createContext<ToastsValue | null>(null);

export function ToastsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastSpec[]>([]);
  const notify = useCallback((t: ToastSpec) => setToasts((ts) => [...ts.filter((x) => x.id !== t.id), t]), []);
  const dismiss = useCallback((id: string) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);
  const clear = useCallback(() => setToasts([]), []);
  const value = useMemo(() => ({ toasts, notify, dismiss, clear }), [toasts, notify, dismiss, clear]);
  return <ToastsContext.Provider value={value}>{children}</ToastsContext.Provider>;
}

export function useToasts(): ToastsValue {
  const ctx = useContext(ToastsContext);
  if (!ctx) throw new Error('useToasts must be used within <ToastsProvider>');
  return ctx;
}
