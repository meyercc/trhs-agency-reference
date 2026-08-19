import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useModules } from '../state/Modules';

/**
 * Route guard for module-gated pages: if the module is removed, redirect home
 * instead of rendering the page (covers direct visits + stale deep links, since
 * the nav tab alone being hidden doesn't stop `#/shop`). The React port of the
 * vanilla PAGE_MODULE_MAP redirect in setTab().
 */
export function ModuleGate({ module, children }: { module: string; children: ReactNode }) {
  const { has } = useModules();
  if (!has(module)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
