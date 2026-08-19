import type { Meta, StoryObj } from '@storybook/react';
import { WidgetShell } from './WidgetShell';

const meta: Meta<typeof WidgetShell> = {
  title: 'Molecules/WidgetShell',
  component: WidgetShell,
};
export default meta;

type Story = StoryObj<typeof WidgetShell>;

const Placeholder = ({ h = 80 }: { h?: number }) => (
  <div style={{ height: h, marginTop: 'var(--gutter-sm)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-light)' }} />
);

export const WithAction: Story = {
  render: () => (
    <div style={{ width: 340 }}>
      <WidgetShell title="System Vitals" action={{ label: 'Full Details →' }}>
        <Placeholder />
      </WidgetShell>
    </div>
  ),
};

export const NoAction: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <WidgetShell title="Power Mode">
        <Placeholder h={64} />
      </WidgetShell>
    </div>
  ),
};
