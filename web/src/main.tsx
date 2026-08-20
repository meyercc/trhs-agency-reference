import React from 'react';
import { createRoot } from 'react-dom/client';
// HashRouter so the build works under any GitHub Pages subpath with no
// server-side SPA fallback or basename config (routes live in the URL hash).
import { HashRouter, Routes, Route } from 'react-router-dom';
// Consume the real Treehouse design system. The Hadouken primitives (generated
// from Figma Variables via `npm run sync:tokens`) load first so semantic tokens
// in tokens.css can reference them, e.g. --accent-color: var(--color-accent-solid).
import '../../shared/tokens.hadouken.css';
import '../../shared/tokens.css';
import '../../shared/components.css';
import './app.css';
import { SettingsProvider } from './state/Settings';
import { ModulesProvider } from './state/Modules';
import { DeviceProfilesProvider } from './state/DeviceProfiles';
import { DeviceSimProvider } from './state/DeviceSim';
import { ModuleGate } from './modules/ModuleGate';
import { AppShell } from './app/AppShell';
import { Home } from './pages/Home';
import { Play } from './pages/Play';
import { Perform } from './pages/Perform';
import { PerformV2 } from './pages/PerformV2';
import { PerformV3 } from './pages/PerformV3';
import { PerformV4 } from './pages/PerformV4';
import { PerformV5 } from './pages/PerformV5';
import { PerformV6 } from './pages/PerformV6';
import { PerformV7 } from './pages/PerformV7';
import { Personalize } from './pages/Personalize';
import { PersonalizeV2 } from './pages/PersonalizeV2';
import { Shop } from './pages/Shop';
import { CardLab } from './pages/CardLab';
import { ModalLab } from './pages/ModalLab';
import { JYWork } from './pages/JYWork';
import { MetroDashboard } from './metro/MetroDashboard';
import { AppAtlas } from './atlas/AppAtlas';
import { Registry } from './pages/Registry';
import { Configurator } from './pages/Configurator';
import { Onboarding } from './onboarding/Onboarding';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>
      <ModulesProvider>
      <DeviceProfilesProvider>
      <DeviceSimProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="play" element={<Play />} />
            {/* Perform IS V7 at scope 1.0 (promoted 2026-08-19, agreed with Junchao):
                the same component the exploration route renders, minus the Simulator.
                The rig's axes become fixed here — scope 1.0, HyperX machine, OMEN AI
                enabled, no game running. */}
            <Route path="perform" element={<PerformV7 showcase={false} />} />
            {/* The page Perform was until the promotion, kept reachable rather than
                deleted — the V-numbering had no v1 because the baseline was /perform. */}
            <Route path="perform-v1" element={<Perform />} />
            {/* Parallel redesign preview (OGH audit reorg) — original Perform untouched. */}
            <Route path="perform-v2" element={<PerformV2 />} />
            {/* IA-spec preview (OMEN AI top-level, three forms) — see performance-page-ia-spec. */}
            <Route path="perform-v3" element={<PerformV3 />} />
            {/* Layout-grammar iteration: marks carry governance, envelope anchors its row. */}
            <Route path="perform-v4" element={<PerformV4 />} />
            {/* Framework-showcase PROPOSAL: draft typology (G9–G14) demonstrated, open decisions as toggles. */}
            <Route path="perform-v5" element={<PerformV5 />} />
            {/* Reading-forms variant over the V5 baseline: hero readings (Metric/Level) + identity icons. */}
            <Route path="perform-v6" element={<PerformV6 />} />
            {/* Modal-shell variant over the V5 baseline: single-column modals go narrow +
                centred, and the control that governs the whole modal moves into the header. */}
            <Route path="perform-v7" element={<PerformV7 />} />
            <Route path="personalize" element={<Personalize />} />
            {/* Five-family scaffold (Audio/Display/Keys/Lighting/App) — the alignment starting point. */}
            <Route path="personalize-v2" element={<PersonalizeV2 />} />
            {/* SKU tooling (admin): browsable registry + spec configurator. */}
            <Route path="registry" element={<Registry />} />
            <Route path="configurator" element={<Configurator />} />
            <Route
              path="shop"
              element={
                <ModuleGate module="shop">
                  <Shop />
                </ModuleGate>
              }
            />
            {/* Living specimens of docs/card-modal-scalability-report.md. */}
            <Route path="card-lab" element={<CardLab />} />
            {/* Living specimens of docs/modal-registry.md — the modal side. */}
            <Route path="modal-lab" element={<ModalLab />} />
            {/* JY's Work — independent index of the Perform redesign work. */}
            <Route path="jy" element={<JYWork />} />
          </Route>
          {/* Alternate dashboard — full-screen, outside the app shell. */}
          <Route path="metro" element={<MetroDashboard />} />
          {/* App Atlas — architecture map of every page + modal, full-screen. */}
          <Route path="map" element={<AppAtlas />} />
          {/* First-boot onboarding — full-screen first-run flow, outside the shell. */}
          <Route path="onboarding" element={<Onboarding />} />
        </Routes>
      </HashRouter>
      </DeviceSimProvider>
      </DeviceProfilesProvider>
      </ModulesProvider>
    </SettingsProvider>
  </React.StrictMode>,
);
