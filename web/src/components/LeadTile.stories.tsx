import type { Meta, StoryObj } from '@storybook/react';
import { LeadTile } from './LeadTile';
import { GameTile } from './GameTile';
import eldenring from '../../../Assets/games/eldenring.webp';
import baldursgate3 from '../../../Assets/games/baldursgate3.webp';
import monsterhunter from '../../../Assets/games/monsterhunterwilds.webp';
import cyberpunk from '../../../Assets/games/cyberpunk.webp';

const FACTS = [
  { label: 'Last played', value: 'Today' },
  { label: 'Play time', value: '96 hours' },
];

const meta: Meta<typeof LeadTile> = {
  title: 'Organisms/LeadTile',
  component: LeadTile,
  args: { cover: eldenring, title: 'Elden Ring', facts: FACTS, onPlay: () => {}, onClick: () => {} },
  argTypes: { cover: { control: false } },
  decorators: [(Story) => <div style={{ width: 543, height: 245, display: 'grid' }}><Story /></div>],
  parameters: {
    docs: {
      description: {
        component:
          'The wide tile that leads a row of covers — Play’s Featured layout. It takes the row’s height and the width the grid spans it. Avalonia: a templated Button with the cover docked right under a gradient.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof LeadTile>;

export const Default: Story = {};
/** Without Play — a tile that only opens details. */
export const NoPlay: Story = { args: { onPlay: undefined } };
/** Without facts — the title alone. */
export const TitleOnly: Story = { args: { facts: [] } };

/** In its row: spanning three of six columns, beside three covers, one height. */
export const InARow: Story = {
  decorators: [],
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--gutter)', alignItems: 'stretch', width: 1100 }}>
      <LeadTile style={{ gridColumn: 'span 3' }} cover={baldursgate3} title="Baldur's Gate 3" facts={FACTS} onPlay={() => {}} />
      <GameTile cover={eldenring} aria-label="Elden Ring" />
      <GameTile cover={monsterhunter} aria-label="Monster Hunter Wilds" />
      <GameTile cover={cyberpunk} aria-label="Cyberpunk 2077" />
    </div>
  ),
};
