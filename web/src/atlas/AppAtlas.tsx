import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  MarkerType,
  useNodesState,
  useEdgesState,
  useNodesInitialized,
  useReactFlow,
  type Node,
  type Edge,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ATLAS_NODES, ATLAS_EDGES, EDGE_STYLE, KIND_LABEL, type EdgeKind, type SurfaceKind } from './atlasData';
import { SurfaceNode } from './SurfaceNode';
import './atlas.css';

const nodeTypes = { surface: SurfaceNode };
// v2: layout changed (Devices panel node added, device modals moved under it).
const POS_KEY = 'trhs-atlas-pos-v2';

/** Merge saved positions over the authored defaults (drag layout persists). */
function loadPositions(): Record<string, { x: number; y: number }> {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY) || '{}');
  } catch {
    return {};
  }
}

function buildNodes(): Node[] {
  const saved = loadPositions();
  return ATLAS_NODES.map((n) => ({
    id: n.id,
    type: 'surface',
    position: saved[n.id] || n.position,
    data: n.data,
  }));
}

function buildEdges(): Edge[] {
  return ATLAS_EDGES.map((e) => {
    const style = EDGE_STYLE[e.kind];
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.from || 'b',
      targetHandle: e.to || 't',
      label: e.label,
      type: 'default',
      animated: e.kind === 'opens-feature' || e.kind === 'opens-device',
      markerEnd: e.kind === 'nav' ? undefined : { type: MarkerType.ArrowClosed, color: style.color },
      style: {
        stroke: style.color,
        strokeWidth: e.kind === 'nav' ? 1.5 : 2,
        strokeDasharray: style.dashed ? '5 5' : undefined,
      },
      labelStyle: { fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-display)' },
      labelBgStyle: { fill: 'var(--bg-elevated)', fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 3,
    };
  });
}

const MINIMAP_COLOR: Record<SurfaceKind, string> = {
  page: '#00c8d7',
  'feature-modal': '#7cc5ff',
  'device-modal': '#f6a13c',
  panel: '#56d364',
  alt: '#b38cf0',
};

export function AppAtlas() {
  // Provider so the canvas can use useReactFlow()/useNodesInitialized() to
  // re-fit once the custom nodes have measured (they have no fixed height).
  return (
    <ReactFlowProvider>
      <AtlasCanvas />
    </ReactFlowProvider>
  );
}

function AtlasCanvas() {
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState(useMemo(buildNodes, []));
  const [edges, , onEdgesChange] = useEdgesState(useMemo(buildEdges, []));

  // The initial `fitView` runs before the custom nodes are measured, so it
  // over-zooms/clips a wide graph. Re-fit once measurement completes.
  const nodesInitialized = useNodesInitialized();
  const { fitView } = useReactFlow();
  useEffect(() => {
    // Extra padding keeps the corner nodes (Dashboard, Devices Panel) clear of
    // the floating titlebar + legend HUD panels.
    if (nodesInitialized) fitView({ padding: 0.22 });
  }, [nodesInitialized, fitView]);

  // Persist positions after any drag.
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      if (changes.some((c) => c.type === 'position' && c.dragging === false)) {
        setNodes((cur) => {
          const pos: Record<string, { x: number; y: number }> = {};
          cur.forEach((n) => (pos[n.id] = n.position));
          try {
            localStorage.setItem(POS_KEY, JSON.stringify(pos));
          } catch {
            /* storage unavailable */
          }
          return cur;
        });
      }
    },
    [onNodesChange, setNodes],
  );

  const resetLayout = useCallback(() => {
    try {
      localStorage.removeItem(POS_KEY);
    } catch {
      /* ignore */
    }
    setNodes(buildNodes());
  }, [setNodes]);

  return (
    <div className="atlas-root">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.15}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ interactionWidth: 0 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(255,255,255,0.06)" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => MINIMAP_COLOR[(n.data as { kind: SurfaceKind }).kind] ?? '#888'}
          maskColor="rgba(0,0,0,0.55)"
        />

        <Panel position="top-left" className="atlas-titlebar">
          <div className="atlas-title">
            <span className="atlas-title-main">App Atlas</span>
            <span className="atlas-title-sub">Every page &amp; modal, and how they connect</span>
          </div>
          <button type="button" className="atlas-btn" onClick={() => navigate('/')}>
            ← Back to app
          </button>
          <button type="button" className="atlas-btn ghost" onClick={resetLayout}>
            Reset layout
          </button>
        </Panel>

        <Panel position="top-right" className="atlas-legend">
          <div className="atlas-legend-group">
            <div className="atlas-legend-heading">Surfaces</div>
            {(Object.keys(KIND_LABEL) as SurfaceKind[]).map((k) => (
              <div key={k} className="atlas-legend-row">
                <span className="atlas-legend-dot" style={{ background: MINIMAP_COLOR[k] }} />
                {KIND_LABEL[k]}
              </div>
            ))}
          </div>
          <div className="atlas-legend-group">
            <div className="atlas-legend-heading">Connections</div>
            {(Object.keys(EDGE_STYLE) as EdgeKind[]).map((k) => (
              <div key={k} className="atlas-legend-row">
                <span
                  className={'atlas-legend-line' + (EDGE_STYLE[k].dashed ? ' dashed' : '')}
                  style={{ background: EDGE_STYLE[k].color }}
                />
                {EDGE_STYLE[k].label}
              </div>
            ))}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
