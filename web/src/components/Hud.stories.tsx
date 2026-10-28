import type { Meta, StoryObj } from '@storybook/react';
import { Hud } from './Hud';
import { StatTile } from './StatTile';
import { Chip } from './Chip';

const meta: Meta<typeof Hud> = {
  title: 'Molecules/Hud',
  component: Hud,
  parameters: {
    docs: {
      description: {
        component:
          'The overlay card (TH-438): a grip, a title, a hide button and a row of compact StatTiles or live controls, translucent over whatever is behind it. OverlayHost places, drags and persists it; the grip is the pointer handle and the keyboard handle. Avalonia: a Border with the HUD ControlTheme inside a Canvas, the grip a Thumb.',
      },
    },
  },
  args: { title: 'FPS overlay' },
};
export default meta;

type Story = StoryObj<typeof Hud>;

export const Metrics: Story = {
  render: (args) => (
    <Hud {...args} onClose={() => {}}>
      <StatTile compact label="FPS" value={142} />
      <StatTile compact label="CPU temp" value={58} unit="°C" tone="neutral" />
      <StatTile compact label="GPU temp" value={61} unit="°C" tone="neutral" />
    </Hud>
  ),
};

export const WithControl: Story = {
  args: { title: 'DPI overlay' },
  render: (args) => (
    <Hud {...args} onClose={() => {}}>
      <StatTile compact label="FPS" value={138} />
      <div className="ds-live-control">
        <div className="ds-live-control-head">
          <span className="ds-live-control-title">Pulsefire Saga Pro DPI</span>
          <span className="ds-live-control-value">1,600 DPI</span>
        </div>
        <div className="ds-live-control-chips" role="radiogroup" aria-label="DPI preset">
          {[400, 800, 1600, 2400, 3200].map((p) => (
            <Chip key={p} role="radio" aria-checked={p === 1600} selected={p === 1600}>
              {p.toLocaleString()}
            </Chip>
          ))}
        </div>
      </div>
    </Hud>
  ),
};

/** The form a Nova reply previews: no grip, no ✕ — it is not on screen yet. */
export const Preview: Story = {
  args: { grip: false },
  render: (args) => (
    <Hud {...args}>
      <StatTile compact label="FPS" value={142} />
      <StatTile compact label="GPU temp" value={55} unit="°C" tone="neutral" />
    </Hud>
  ),
};

export const Dragging: Story = {
  args: { dragging: true },
  render: (args) => (
    <Hud {...args}>
      <StatTile compact label="FPS" value={142} />
    </Hud>
  ),
};

export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--gutter)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <Hud title="FPS overlay" onClose={() => {}}>
        <StatTile compact label="FPS" value={142} />
      </Hud>
      <Hud title="Temps overlay" onClose={() => {}}>
        <StatTile compact label="CPU temp" value={58} unit="°C" tone="neutral" />
        <StatTile compact label="GPU temp" value={61} unit="°C" tone="neutral" />
      </Hud>
    </div>
  ),
};
