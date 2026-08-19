import type { Meta, StoryObj } from '@storybook/react';
import { ReorderableSections } from './ReorderableSections';

const meta: Meta<typeof ReorderableSections> = {
  title: 'Organisms/ReorderableSections',
  component: ReorderableSections,
};
export default meta;

type Story = StoryObj<typeof ReorderableSections>;

const Header = ({ label, count }: { label: string; count?: string }) => (
  <div className="pg-section">
    <span className="ds-text-overline pg-section-label">{label}</span>
    <span className="pg-section-rule" />
    {count && <span className="pg-section-count">{count}</span>}
  </div>
);

const Box = ({ h = 80, children }: { h?: number; children: React.ReactNode }) => (
  <div
    style={{
      height: h,
      display: 'grid',
      placeItems: 'center',
      borderRadius: 'var(--radius-card)',
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      color: 'var(--text-dim)',
    }}
  >
    {children}
  </div>
);

/** Drag the grip (appears in the left gutter on hover) to reorder. */
export const Default: Story = {
  render: () => (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 24px 24px 40px' }}>
      <ReorderableSections
        storageKey="sb-reorderable-sections"
        sections={[
          { id: 'system', header: <Header label="System" />, children: <Box>System monitors</Box> },
          { id: 'devices', header: <Header label="My Devices" count="4 connected" />, children: <Box h={120}>Device cards</Box> },
          { id: 'lighting', header: <Header label="Lighting" />, children: <Box h={100}>Light studio</Box> },
        ]}
      />
    </div>
  ),
};
