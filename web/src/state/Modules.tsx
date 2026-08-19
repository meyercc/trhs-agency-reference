import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { MODULES } from '../modules/registry';

// ── Modules state ─────────────────────────────────────────────────────────
// Owns install/remove state for every optional module, persisted to
// localStorage. Consumers gate their own surfaces with `has(id)`. The React
// port of the vanilla MODULE_REGISTRY `.installed` flags + setModuleInstalled().
const KEY = 'trhs-modules';

type InstallState = Record<string, boolean>;

function loadState(): InstallState {
  const base: InstallState = {};
  MODULES.forEach((m) => {
    base[m.id] = m.defaultInstalled !== false;
  });
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, unknown>;
    Object.keys(saved).forEach((id) => {
      if (id in base) base[id] = !!saved[id];
    });
  } catch {
    /* storage unavailable / malformed */
  }
  return base;
}

interface ModulesValue {
  installed: InstallState;
  /** Installed? Unknown ids default to true (ungated). */
  has: (id: string) => boolean;
  setInstalled: (id: string, on: boolean) => void;
  install: (id: string) => void;
  remove: (id: string) => void;
  /** Count of installed modules. */
  installedCount: number;
}

const ModulesContext = createContext<ModulesValue | null>(null);

export function ModulesProvider({ children }: { children: ReactNode }) {
  const [installed, setState] = useState<InstallState>(loadState);

  const setInstalled = (id: string, on: boolean) => {
    setState((prev) => {
      if (prev[id] === on) return prev;
      const next = { ...prev, [id]: on };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage full / unavailable */
      }
      return next;
    });
  };

  const value = useMemo<ModulesValue>(
    () => ({
      installed,
      has: (id) => installed[id] !== false,
      setInstalled,
      install: (id) => setInstalled(id, true),
      remove: (id) => setInstalled(id, false),
      installedCount: Object.values(installed).filter(Boolean).length,
    }),
    [installed],
  );

  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}

export function useModules() {
  const ctx = useContext(ModulesContext);
  if (!ctx) throw new Error('useModules must be used within <ModulesProvider>');
  return ctx;
}
