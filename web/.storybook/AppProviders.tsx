import type { ReactNode } from 'react';
import type { Decorator } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsProvider } from '../src/state/Settings';
import { ProfilesProvider } from '../src/state/Profiles';
import { ModulesProvider } from '../src/state/Modules';
import { AgentsProvider } from '../src/state/Agents';
import { PlaytimeProvider } from '../src/state/Playtime';
import { ToastsProvider } from '../src/state/Toasts';
import { NovaProvider } from '../src/state/Nova';
import { DeviceProfilesProvider } from '../src/state/DeviceProfiles';
import { DeviceSimProvider } from '../src/state/DeviceSim';

/**
 * The app's context stack, in main.tsx order, for stories whose components
 * read app state (Settings, modules, agents, Nova, device profiles, the device
 * simulator).
 * MemoryRouter stands in for the app's HashRouter so `useSearchParams` /
 * `useNavigate` work without touching the Storybook manager URL; a page story
 * that reads the URL passes `initialEntries` to start on its deep link.
 *
 * Opt-in per story (`decorators: [withAppProviders]`), not global: atoms and
 * molecules should keep rendering without app state, so a primitive that
 * grows a hidden dependency on it fails loudly in its own story.
 */
export function AppProviders({ children, initialEntries }: { children: ReactNode; initialEntries?: string[] }) {
  return (
    <ProfilesProvider>
      <SettingsProvider>
        <ModulesProvider>
          <AgentsProvider>
            <PlaytimeProvider>
              <ToastsProvider>
                <NovaProvider>
                  <DeviceProfilesProvider>
                    <DeviceSimProvider>
                      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
                    </DeviceSimProvider>
                  </DeviceProfilesProvider>
                </NovaProvider>
              </ToastsProvider>
            </PlaytimeProvider>
          </AgentsProvider>
        </ModulesProvider>
      </SettingsProvider>
    </ProfilesProvider>
  );
}

export const withAppProviders: Decorator = (Story) => (
  <AppProviders>
    <Story />
  </AppProviders>
);
