import { useState } from 'react';
import { Icon } from '../components';

/**
 * The surround-sound stage (Figma Audio 14725:221255 "Surround Sound Module"):
 * the listener in the middle, the virtual speaker ring around them, compass
 * labels, and the subwoofer sitting off-ring. Headset-specific presentation —
 * device-scoped like `KeyboardHero`, not a DS component.
 *
 * The nodes are *buttons*: clicking one "tests" that channel (a ping ripple),
 * so the stage demonstrates the layout instead of just picturing it. Accent
 * nodes are the channels the spatial engine synthesises from the stereo input
 * (FL/FR/RL/RR); neutral nodes are carried through (C, sides, sub).
 *
 * Geometry (ring radius, bearings) is data, like `keyboardLayout` — every
 * visual value in the CSS is a token.
 */

interface ChannelNode {
  id: string;
  label: string;
  /** Compass bearing on the ring: 0 = front (top), clockwise. */
  bearing: number;
  /** Synthesised by the spatial engine (accent) vs carried through (neutral). */
  virtual: boolean;
  /** Only present in 7.1 layouts. */
  sideOnly?: boolean;
}

const RING: ChannelNode[] = [
  { id: 'c', label: 'Center', bearing: 0, virtual: false },
  { id: 'fr', label: 'Front right', bearing: 45, virtual: true },
  { id: 'sr', label: 'Side right', bearing: 90, virtual: false, sideOnly: true },
  { id: 'rr', label: 'Rear right', bearing: 135, virtual: true },
  { id: 'rl', label: 'Rear left', bearing: 225, virtual: true },
  { id: 'sl', label: 'Side left', bearing: 270, virtual: false, sideOnly: true },
  { id: 'fl', label: 'Front left', bearing: 315, virtual: true },
];

/** Distance from stage centre to a ring node's centre, in px (stage is 198). */
const RING_RADIUS = 82;

export function SurroundStage({ output }: { output: string }) {
  // Channel being "tested" — drives the ping ripple, cleared when it ends.
  const [testing, setTesting] = useState<string | null>(null);
  // 5.1 drops the side pair; anything else shows the full 7.1 ring.
  const nodes = RING.filter((n) => !(n.sideOnly && output.startsWith('5')));

  const nodeStyle = (bearing: number) => {
    const rad = (bearing * Math.PI) / 180;
    const x = Math.sin(rad) * RING_RADIUS;
    const y = -Math.cos(rad) * RING_RADIUS;
    return { transform: `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px))` };
  };

  return (
    <div className="hc-stage" role="group" aria-label={`${output} surround stage — select a speaker to test it`}>
      {/* Base disc + faint concentric rings */}
      <span className="hc-stage-disc" aria-hidden="true" />

      {/* Compass — orientation only */}
      <div className="hc-compass" aria-hidden="true">
        <span className="hc-compass-n">Front</span>
        <span className="hc-compass-s">Rear</span>
        <span className="hc-compass-w">Left</span>
        <span className="hc-compass-e">Right</span>
      </div>

      {/* The listener — the person the ring surrounds */}
      <span className="hc-listener" aria-hidden="true">
        <Icon name="spatial-audio" size={24} />
      </span>

      {/* Channel ring */}
      {nodes.map((n) => (
        <button
          key={n.id}
          type="button"
          className={
            'hc-node' + (n.virtual ? ' virtual' : '') + (testing === n.id ? ' testing' : '')
          }
          style={nodeStyle(n.bearing)}
          aria-label={`Test ${n.label.toLowerCase()} speaker`}
          onClick={() => setTesting(n.id)}
          onAnimationEnd={() => setTesting((t) => (t === n.id ? null : t))}
        >
          {/* Speaker glyph faces the listener */}
          <Icon name="audio" size={12} style={{ transform: `rotate(${n.bearing + 90}deg)` }} />
        </button>
      ))}

      {/* The .1 — subwoofer, off the ring (bass is non-directional) */}
      <button
        type="button"
        className={'hc-node hc-sub' + (testing === 'sub' ? ' testing' : '')}
        aria-label="Test subwoofer"
        onClick={() => setTesting('sub')}
        onAnimationEnd={() => setTesting((t) => (t === 'sub' ? null : t))}
      >
        <Icon name="audio" size={14} />
      </button>
    </div>
  );
}
