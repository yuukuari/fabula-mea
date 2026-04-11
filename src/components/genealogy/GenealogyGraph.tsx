import { useMemo, useState, useCallback, useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { Character } from '@/types';
import { computeGenealogyLayout, getConnectedIds, type GenealogyNodeLayout } from '@/lib/genealogy-layout';
import { GenealogyNode } from './GenealogyNode';
import { GenealogyEdges } from './GenealogyEdge';

interface GenealogyGraphProps {
  centerId: string;
  characters: Character[];
  onNodeClick: (characterId: string) => void;
  onEditNode?: (characterId: string) => void;
}

const ZOOM_STEP = 0.15;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const PADDING = 80;

export function GenealogyGraph({ centerId, characters, onNodeClick, onEditNode }: GenealogyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const obsRef = useRef<ResizeObserver | null>(null);

  // Callback ref to track container dimensions
  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    if (obsRef.current) {
      obsRef.current.disconnect();
      obsRef.current = null;
    }
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (!el) return;
    setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    obsRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    obsRef.current.observe(el);
  }, []);

  const layout = useMemo(
    () => computeGenealogyLayout(centerId, characters),
    [centerId, characters],
  );

  const nodeMap = useMemo(() => {
    const map = new Map<string, GenealogyNodeLayout>();
    for (const n of layout.nodes) map.set(n.characterId, n);
    return map;
  }, [layout.nodes]);

  const charMap = useMemo(() => {
    const map = new Map<string, Character>();
    for (const c of characters) map.set(c.id, c);
    return map;
  }, [characters]);

  // Hover highlighting
  const connectedIds = useMemo(() => {
    if (!hoveredId) return null;
    return getConnectedIds(hoveredId, characters);
  }, [hoveredId, characters]);

  // Fit-to-view
  const fitToView = useCallback(() => {
    if (containerSize.width === 0 || layout.nodes.length === 0) return;
    const contentW = layout.maxX - layout.minX + PADDING * 2;
    const contentH = layout.maxY - layout.minY + PADDING * 2;
    const scaleX = containerSize.width / contentW;
    const scaleY = containerSize.height / contentH;
    const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), MIN_ZOOM), MAX_ZOOM);
    setScale(newScale);
    setPanX(0);
    setPanY(0);
  }, [layout, containerSize]);

  // Auto fit on center change or container resize
  // Using a ref to track previous values to avoid stale closure
  const prevFitKey = useRef('');
  const fitKey = `${centerId}-${containerSize.width}-${containerSize.height}`;
  if (fitKey !== prevFitKey.current && containerSize.width > 0) {
    prevFitKey.current = fitKey;
    // Schedule fit after render
    requestAnimationFrame(() => fitToView());
  }

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.ctrlKey ? e.deltaY * 0.01 : e.deltaY * 0.002;
    setScale((s) => Math.min(Math.max(s - delta, MIN_ZOOM), MAX_ZOOM));
  }, []);

  // Pan handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragStart.current = { x: e.clientX, y: e.clientY, panX, panY };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [panX, panY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPanX(dragStart.current.panX + dx / scale);
    setPanY(dragStart.current.panY + dy / scale);
  }, [scale]);

  const handlePointerUp = useCallback(() => {
    dragStart.current = null;
    setDragging(false);
  }, []);

  const handleHoverStart = useCallback((charId: string) => {
    setHoveredId(charId);
  }, []);

  const handleHoverEnd = useCallback(() => {
    setHoveredId(null);
  }, []);

  if (layout.nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-300">
        <p>Aucune relation généalogique définie.</p>
      </div>
    );
  }

  // Compute viewBox centered on content
  const cx = (layout.minX + layout.maxX) / 2;
  const cy = (layout.minY + layout.maxY) / 2;

  return (
    <div ref={setContainerRef} className="relative flex-1 overflow-hidden bg-parchment-50">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <button
          onClick={() => setScale((s) => Math.min(s + ZOOM_STEP, MAX_ZOOM))}
          className="w-8 h-8 bg-white/90 rounded-lg shadow flex items-center justify-center hover:bg-white transition-colors"
        >
          <ZoomIn className="w-4 h-4 text-ink-500" />
        </button>
        <button
          onClick={() => setScale((s) => Math.max(s - ZOOM_STEP, MIN_ZOOM))}
          className="w-8 h-8 bg-white/90 rounded-lg shadow flex items-center justify-center hover:bg-white transition-colors"
        >
          <ZoomOut className="w-4 h-4 text-ink-500" />
        </button>
        <button
          onClick={fitToView}
          className="w-8 h-8 bg-white/90 rounded-lg shadow flex items-center justify-center hover:bg-white transition-colors"
        >
          <Maximize2 className="w-4 h-4 text-ink-500" />
        </button>
      </div>

      <svg
        className={`w-full h-full ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        <g transform={`translate(${containerSize.width / 2}, ${containerSize.height / 2}) scale(${scale}) translate(${panX - cx}, ${panY - cy})`}>
          {/* Edges first */}
          <GenealogyEdges
            coupleEdges={layout.coupleEdges}
            parentChildEdges={layout.parentChildEdges}
            nodeMap={nodeMap}
            dimmedIds={connectedIds}
          />

          {/* Nodes on top */}
          {layout.nodes.map((node) => {
            const char = charMap.get(node.characterId);
            if (!char) return null;
            const isDimmed = connectedIds !== null && !connectedIds.has(node.characterId);
            return (
              <GenealogyNode
                key={node.characterId}
                character={char}
                x={node.x}
                y={node.y}
                isCenter={node.isCenter}
                badges={layout.badges.get(node.characterId)}
                dimmed={isDimmed}
                onClick={onNodeClick}
                onEdit={onEditNode}
                onHoverStart={handleHoverStart}
                onHoverEnd={handleHoverEnd}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
