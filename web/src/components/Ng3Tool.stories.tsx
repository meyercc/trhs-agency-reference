import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Ng3Tool } from './Ng3Tool';
import type { IconName } from './Icon';

const meta: Meta<typeof Ng3Tool> = {
  title: 'Molecules/Ng3Tool',
  component: Ng3Tool,
  parameters: {
    docs: {
      description: {
        component:
          'A tool in the `Ng3Panel` tab strip. Icon-only, so its `title` supplies both the ' +
          'accessible label and the hover/focus tooltip — one prop, so the two cannot drift. ' +
          'Avalonia: a ToggleButton with a ToolTip bound to the same title.',
      },
    },
  },
  args: { icon: 'settings', title: 'Settings' },
  argTypes: {
    icon: { control: 'select', options: ['lights', 'buttons', 'calibration', 'sensor', 'settings'] },
    active: { control: 'boolean' },
    tooltipOpen: { control: 'boolean' },
  },
  // The tooltip flies upward out of the trigger; the top padding is what keeps
  // it inside the story canvas.
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', gap: 'var(--gutter)', padding: 'calc(var(--gutter) * 2) var(--gutter) var(--gutter)' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Ng3Tool>;

/** Resting state — muted glyph; the tooltip arrives on hover or keyboard focus. */
export const Default: Story = {};

/** Selected — brighter stroke plus a filled glyph interior, so it isn't color alone. */
export const Active: Story = { args: { active: true } };

/** The tooltip forced open, so the catalog shows it without a hover. */
export const TooltipOpen: Story = { args: { tooltipOpen: true } };

const TABS: { icon: IconName; title: string }[] = [
  { icon: 'lights', title: 'Lights' },
  { icon: 'buttons', title: 'Buttons' },
  { icon: 'calibration', title: 'Calibration' },
  { icon: 'sensor', title: 'Sensor' },
  { icon: 'settings', title: 'Settings' },
];

function Strip() {
  const [sel, setSel] = useState(0);
  return (
    <div className="ds-ng3-toolbar">
      {TABS.map((t, i) => (
        <Ng3Tool key={t.icon} icon={t.icon} title={t.title} active={i === sel} onClick={() => setSel(i)} />
      ))}
    </div>
  );
}

/** A whole tab strip, as a device canvas renders it — hover any tool to name it. */
export const InToolbar: Story = {
  parameters: { controls: { disable: true } },
  render: () => <Strip />,
};
