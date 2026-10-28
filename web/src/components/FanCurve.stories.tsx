import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FanCurve } from './FanCurve';
import { DEFAULT_FAN_CURVE, type FanCurvePoint } from '../state/fanCurve';

const meta: Meta<typeof FanCurve> = {
  title: 'Molecules/FanCurve',
  component: FanCurve,
  parameters: {
    docs: {
      description: {
        component:
          'Fan speed against temperature, eight stops. With `onChange` each stop is a vertical slider: drag it, or focus it and use the arrow keys. One model everywhere (state/fanCurve.ts): the OMEN AI modal edits it, the Performance card shows it compact, a Nova reply can carry it live. Avalonia: a Canvas-based templated control, each stop a Thumb with a RangeValue automation peer.',
      },
    },
  },
  args: { compact: false, liveTemp: 43 },
  argTypes: { compact: { control: 'boolean' }, liveTemp: { control: { type: 'range', min: 40, max: 95 } } },
};
export default meta;

type Story = StoryObj<typeof FanCurve>;

/** Read-only: no `onChange`, so the points are not sliders. */
export const ReadOnly: Story = {
  render: (args) => (
    <div style={{ width: 340 }}>
      <FanCurve {...args} />
    </div>
  ),
};

/** Editable: drag a point, or Tab to one and use ↑/↓ (Home/End for 0/100). */
export const Editable: Story = {
  render: (args) => {
    const [points, setPoints] = useState<FanCurvePoint[]>([...DEFAULT_FAN_CURVE]);
    return (
      <div style={{ width: 340, display: 'grid', gap: 'var(--gutter-xs)', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)' }}>
        <FanCurve {...args} points={points} onChange={setPoints} />
        <div>{points.map((p) => `${p.t}°→${p.r}%`).join(' · ')}</div>
      </div>
    );
  },
};

/** Compact: the card / chat glyph — line and area only, scaled to its box. */
export const Compact: Story = {
  args: { compact: true },
  render: (args) => (
    <div style={{ width: 200 }}>
      <FanCurve {...args} />
    </div>
  ),
};

export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--gutter)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ width: 340 }}>
        <FanCurve liveTemp={43} />
      </div>
      <div style={{ width: 340 }}>
        <FanCurve liveTemp={71} onChange={() => {}} />
      </div>
      <div style={{ width: 200 }}>
        <FanCurve compact liveTemp={62} />
      </div>
    </div>
  ),
};
