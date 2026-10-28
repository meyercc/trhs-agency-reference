import type { Meta, StoryObj } from '@storybook/react';
import { OverlayPanel } from './OverlayPanel';
import { Button } from './Button';
import { Icon } from './Icon';
import { Ng3Section, Ng3Label } from './Ng3Section';

const meta: Meta<typeof OverlayPanel> = {
  title: 'Molecules/OverlayPanel',
  component: OverlayPanel,
  parameters: {
    docs: {
      description: {
        component:
          'Figma "Overlay Panel" — a floating panel over a canvas or another panel, on the context menu\'s Hadouken surface. Avalonia: a Border with the panel ControlTheme around a DockPanel.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof OverlayPanel>;

const footer = (
  <>
    <Button variant="default">
      <Icon name="close" size="sm" />
      Cancel
    </Button>
    <Button variant="accent">
      <Icon name="check" size="sm" />
      Save
    </Button>
  </>
);

/** Title, a body of sections, and the Cancel / Save footer — the preset editor's shape. */
export const Default: Story = {
  render: () => (
    <div style={{ height: 'calc(var(--widget-row) * 2)', display: 'flex' }}>
      <OverlayPanel title="Gaming Preset" footer={footer} style={{ flex: 1 }}>
        <Ng3Section style={{ flex: '0 0 calc(var(--sidebar-w) * 0.75)' }}>
          <Ng3Label strong>Effects</Ng3Label>
        </Ng3Section>
        <Ng3Section style={{ flex: 1 }}>
          <Ng3Label strong>Color</Ng3Label>
        </Ng3Section>
      </OverlayPanel>
    </div>
  ),
};

/** No footer — a panel that only shows. */
export const NoFooter: Story = {
  render: () => (
    <div style={{ height: 'var(--widget-row)', display: 'flex' }}>
      <OverlayPanel title="Details" style={{ flex: 1 }}>
        <Ng3Section style={{ flex: 1 }}>
          <Ng3Label strong>Section</Ng3Label>
        </Ng3Section>
      </OverlayPanel>
    </div>
  ),
};
