import type { Meta, StoryObj } from '@storybook/react';
import { StatTile } from './StatTile';

const meta: Meta<typeof StatTile> = {
  title: 'Molecules/StatTile',
  component: StatTile,
  parameters: {
    docs: {
      description: {
        component:
          'One number with its name — a dashboard KPI or a popover total, composing the stat typography the widgets already use. Avalonia: a Border with a vertical StackPanel of three TextBlocks.',
      },
    },
  },
  args: { label: 'Tokens today', value: '12.4k' },
  argTypes: { tone: { control: 'inline-radio', options: ['accent', 'neutral', 'positive'] } },
  decorators: [(Story) => <div style={{ width: 200 }}><Story /></div>],
};
export default meta;

type Story = StoryObj<typeof StatTile>;

export const Default: Story = {};
export const WithUnit: Story = { args: { label: 'Local energy', value: '0.42', unit: 'Wh' } };
export const WithDelta: Story = { args: { label: 'Cloud cost', value: '$0.031', delta: 'estimated · since reset' } };
export const Neutral: Story = { args: { tone: 'neutral', label: 'Agents added', value: '3' } };
export const Positive: Story = { args: { tone: 'positive', label: 'Cost avoided', value: '96', unit: '%' } };
export const WithIcon: Story = { args: { icon: 'tokens', label: 'Tokens today', value: '12.4k' } };

export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  decorators: [(Story) => <div style={{ width: 'min(900px, 92vw)' }}><Story /></div>],
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--gutter-sm)' }}>
      <StatTile label="Tokens today" value="12.4k" />
      <StatTile label="Local energy" value="0.42" unit="Wh" />
      <StatTile label="Cloud cost" value="$0.031" delta="estimated" />
      <StatTile tone="neutral" label="Agents added" value="3" />
      <StatTile tone="positive" label="Cost avoided" value="96" unit="%" />
      <StatTile icon="tokens" label="Runs today" value="14" delta="+3 vs yesterday" />
    </div>
  ),
};
