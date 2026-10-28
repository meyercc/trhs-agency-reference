import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { AgentsProvider } from '../state/Agents';
import { ForgeModal } from './ForgeModal';

// The modal reads added/engagement state (AgentsProvider). MemoryRouter guards
// against any transitive router hook, as the Module Browser's story does.
const meta: Meta<typeof ForgeModal> = {
  title: 'Pages/Forge',
  component: ForgeModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The store that replaced the Agent Catalog (`?modal=agents`). Apps, skills, recipes and ' +
          'assistants in one grid — the old agents are Assistants here. Left nav of categories with ' +
          'counts; a Discover landing led by a featured app and its clip; sort tabs and type chips; ' +
          'cards with rating, votes, likes, saves and downloads; a detail page with Overview, Ratings, ' +
          'How it works, Trust card and Versions beside a standing aside of what the listing can touch.',
      },
    },
  },
  args: { onClose: () => {} },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <AgentsProvider>
          <Story />
        </AgentsProvider>
      </MemoryRouter>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ForgeModal>;

/** Lands on Discover — hero, then the curated groups. */
export const Discover: Story = {};

/** Deep-linked into a category (`?modal=agents&cat=stream`). */
export const Category: Story = { args: { initialSection: 'stream' } };

/** A partner app's page (`&listing=voicemod`) — brand mark, licence and publisher site. */
export const PartnerListing: Story = { args: { initialListingId: 'voicemod' } };

/** A folded-in agent (`&agent=frame-doctor`) — an Assistant listing. */
export const AgentListing: Story = { args: { initialListingId: 'frame-doctor' } };

/** The featured app's page, with its clip in Overview. */
export const FeaturedListing: Story = { args: { initialListingId: 'autocast' } };

/** Nothing added yet — Yours explains where to start. */
export const YoursEmpty: Story = { args: { initialSection: 'yours' } };
