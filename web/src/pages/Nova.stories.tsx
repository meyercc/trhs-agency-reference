import type { Meta, StoryObj } from '@storybook/react';
import { AppProviders } from '../../.storybook/AppProviders';
import { Nova } from './Nova';

/**
 * The page owns the viewport in the app (shell.css `.page-full` hands it a
 * flex height chain). In Storybook there is no shell, so the frame below
 * stands in for it: an explicitly sized, flex-column box that gives `.nova`'s
 * `flex: 1; min-height: 0` a definite ancestor (gotcha 27), inside the app
 * providers it reads (Nova store, agents, profiles, desk state).
 */
const frame = (initial: string) => (Story: React.ComponentType) => (
  <AppProviders initialEntries={[initial]}>
    <div style={{ width: 'min(1400px, 96vw)', height: 860, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Story />
    </div>
  </AppProviders>
);

const meta: Meta<typeof Nova> = {
  title: 'Pages/Nova',
  component: Nova,
  parameters: {
    docs: {
      description: {
        component:
          'The AI workspace: Chat (conversations rail · log · composer · context rail) and Agents, with the tokenomics and settings popovers in its own bar. Scripted-first — the quick prompts and topics play scripted interactions that explain and act; seeded conversations show the scripts in use.',
      },
      story: { inline: false, iframeHeight: 900 },
    },
  },
};
export default meta;

type Story = StoryObj<typeof Nova>;

/** `#/nova` — a fresh chat with the seeded history in the rail. */
export const Chat: Story = { decorators: [frame('/nova')] };

/** `#/nova?view=agents` — the Agents view. */
export const Agents: Story = { decorators: [frame('/nova?view=agents')] };
