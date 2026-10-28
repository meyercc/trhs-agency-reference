import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ResizeHandle } from './ResizeHandle';

const meta: Meta<typeof ResizeHandle> = {
  title: 'Components/ResizeHandle',
  component: ResizeHandle,
  parameters: {
    docs: {
      description: {
        component:
          'The edge of a resizable surface — a WAI-ARIA window splitter (`role="separator"`, `aria-valuenow/min/max`). ' +
          'Drag it, or focus it and use ←/→ (Shift ×4), Home for the narrowest, End for the widest. The grip shows on hover, ' +
          'focus and drag. It reports the size ASKED for, unclamped while dragging, so the owner decides — Nova’s panel turns ' +
          '"past the widest" into full screen. Avalonia: a GridSplitter (ResizeDirection=Columns).',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof ResizeHandle>;

function Demo({ edge = 'left' as const }: { edge?: 'left' | 'right' }) {
  const [w, setW] = useState(320);
  const clamp = (v: number) => Math.max(240, Math.min(560, v));
  return (
    <div style={{ display: 'flex', justifyContent: edge === 'left' ? 'flex-end' : 'flex-start', width: '100%' }}>
      <div
        style={{
          position: 'relative',
          width: w,
          height: 'calc(var(--gutter) * 10)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-dim)',
          fontSize: 'var(--text-caption)',
        }}
      >
        {w}px — drag the {edge} edge
        <ResizeHandle label="Resize panel" edge={edge} value={w} min={240} max={560} onChange={(v) => setW(clamp(v))} />
      </div>
    </div>
  );
}

/** A right-hand panel, resized from its left edge — Nova's. */
export const LeftEdge: Story = { render: () => <Demo edge="left" /> };
/** A left-hand rail, resized from its right edge. */
export const RightEdge: Story = { render: () => <Demo edge="right" /> };

function HeightDemo() {
  const [h, setH] = useState(200);
  const clamp = (v: number) => Math.max(120, Math.min(360, v));
  return (
    // Pinned at the bottom, as the Nova window is above its button: the top edge grows it upward.
    <div style={{ display: 'flex', alignItems: 'flex-end', height: 'calc(var(--gutter) * 16)' }}>
      <div
        style={{
          position: 'relative',
          width: 'calc(var(--gutter) * 14)',
          height: h,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-dim)',
          fontSize: 'var(--text-caption)',
        }}
      >
        {h}px — drag the top edge, or ↑/↓
        <ResizeHandle label="Resize panel height" edge="top" value={h} min={120} max={360} onChange={(v) => setH(clamp(v))} />
      </div>
    </div>
  );
}

/** A surface pinned at its bottom, resized in height from its top edge — the Nova window (TH-507). */
export const TopEdge: Story = { render: () => <HeightDemo /> };
