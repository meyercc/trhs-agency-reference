import type { Meta, StoryObj } from '@storybook/react';
import { RecapCard } from './RecapCard';

/**
 * Catch Me Up's recap (TH-478) — what a Nova reply shows for "catch me up on
 * <game>". Composed from Badge, Separator and the ds-text ramp; the rows come
 * from `data/catchUp.ts`, so each game here is the fixture's own entry.
 * Shown at the pinned panel's bubble width.
 */
const meta: Meta<typeof RecapCard> = {
  title: 'Organisms/RecapCard',
  component: RecapCard,
  args: { gameId: 'cyberpunk', section: 'all' },
  argTypes: {
    gameId: { control: 'select', options: ['cyberpunk', 'eldenring', 'reddead2'] },
    section: { control: 'inline-radio', options: ['all', 'build'] },
  },
  decorators: [(Story) => <div style={{ width: 'calc(var(--text-section) * 20)' }}>{Story()}</div>],
};
export default meta;

type Story = StoryObj<typeof RecapCard>;

export const Cyberpunk: Story = {};
/** The follow-up: the build and only the updates that touched it. */
export const BuildOnly: Story = { args: { section: 'build' } };
export const EldenRing: Story = { args: { gameId: 'eldenring' } };
/** No updates since the last session: the section says so rather than vanishing. */
export const NoUpdates: Story = { args: { gameId: 'reddead2' } };
