import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { ModulesProvider } from '../state/Modules';
import { ModuleBrowserModal } from './ModuleBrowserModal';

// The modal reads module state (ModulesProvider); RemoveConfirm/links are
// self-contained. MemoryRouter guards against any transitive router hook.
const meta: Meta<typeof ModuleBrowserModal> = {
  title: 'Pages/Module Browser',
  component: ModuleBrowserModal,
  parameters: { layout: 'fullscreen' },
  args: { onClose: () => {} },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <ModulesProvider>
          <Story />
        </ModulesProvider>
      </MemoryRouter>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ModuleBrowserModal>;

/** Lands on the "What's New" page — recommended hero + Recommended/New lists. */
export const WhatsNew: Story = {};

/** Deep-linked into a category (`?modal=modules&cat=performance`). */
export const PerformanceCategory: Story = { args: { initialSection: 'performance' } };
