import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { KIND_LABEL, type SurfaceNodeData } from './atlasData';

// The iframe renders the real app at a fixed "virtual" viewport, then we scale
// it down to thumbnail size. 16:9 keeps device modals + pages readable.
const VW = 1440;
const VH = 810;
const PREVIEW_W = 400;
const SCALE = PREVIEW_W / VW; // ~0.278
const PREVIEW_H = Math.round(VH * SCALE);

/** Base URL of the app (respects the Pages subpath in prod), for iframe src. */
const BASE = import.meta.env.BASE_URL || '/';

/**
 * One surface on the atlas canvas: a titled card whose body is a live, on-demand
 * scaled iframe of the real app at this surface's hash. Kept as a cheap
 * placeholder until "Live preview" is clicked, so the canvas doesn't boot a
 * dozen app instances at once. `interact` lifts pointer-events so you can click
 * through the preview (node dragging is suppressed while interacting).
 */
export function SurfaceNode({ data }: NodeProps & { data: SurfaceNodeData }) {
  const [live, setLive] = useState(false);
  const [interact, setInteract] = useState(false);
  const src = `${BASE}${data.hash}`;

  return (
    <div className={`atlas-node kind-${data.kind}`} data-interacting={interact || undefined}>
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Right} id="r" />

      <header className="atlas-node-head">
        <span className="atlas-node-kind">{KIND_LABEL[data.kind]}</span>
        <span className="atlas-node-title">{data.title}</span>
        {data.global && <span className="atlas-node-badge">global</span>}
      </header>

      <p className="atlas-node-blurb">{data.blurb}</p>

      <div
        className="atlas-preview"
        style={{ width: PREVIEW_W, height: PREVIEW_H }}
        // While interacting, stop React Flow from treating drags as node moves.
        onPointerDownCapture={interact ? (e) => e.stopPropagation() : undefined}
      >
        {live ? (
          <iframe
            className="atlas-frame nodrag"
            title={data.title}
            src={src}
            loading="lazy"
            style={{
              width: VW,
              height: VH,
              transform: `scale(${SCALE})`,
              pointerEvents: interact ? 'auto' : 'none',
            }}
          />
        ) : (
          <button type="button" className="atlas-preview-load" onClick={() => setLive(true)}>
            <span className="atlas-preview-play">▶</span>
            Live preview
          </button>
        )}
      </div>

      <footer className="atlas-node-foot">
        <code className="atlas-node-src">{data.source}</code>
        <div className="atlas-node-actions">
          {live && (
            <button
              type="button"
              className={'atlas-mini-btn' + (interact ? ' on' : '')}
              onClick={() => setInteract((v) => !v)}
              title="Click through the live preview"
            >
              {interact ? 'Interacting' : 'Interact'}
            </button>
          )}
          <a className="atlas-mini-btn" href={src} target="_blank" rel="noreferrer" title="Open in a new tab">
            Open ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
