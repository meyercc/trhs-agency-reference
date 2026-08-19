import type { ReactNode } from 'react';
import type { Decorator } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsProvider } from '../src/state/Settings';
import { ModulesProvider } from '../src/state/Modules';
import { DeviceProfilesProvider } from '../src/state/DeviceProfiles';
import { DeviceSimProvider } from '../src/state/DeviceSim';

/**
 * The app's context stack, in main.tsx order, for stories whose components
 * read app state (Settings, modules, device profiles, the device simulator).
 * MemoryRouter stands in for the app's HashRouter so `useSearchParams` /
 * `useNavigate` work without touching the Storybook manager URL.
 *
 * Opt-in per story (`decorators: [withAppProviders]`), not global: atoms and
 * molecules should keep rendering without app state, so a primitive that
 * grows a hidden dependency on it fails loudly in its own story.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <ModulesProvider>
        <DeviceProfilesProvider>
          <DeviceSimProvider>
            <MemoryRouter>{children}</MemoryRouter>
          </DeviceSimProvider>
        </DeviceProfilesProvider>
      </ModulesProvider>
    </SettingsProvider>
  );
}

export const withAppProviders: Decorator = (Story) => (
  <AppProviders>
    <Story />
  </AppProviders>
);
