import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { useBookStore } from '@/store/useBookStore';
import { RELATIONSHIP_TYPE_LABELS, FAMILY_ROLE_LABELS } from '@/lib/utils';
import type { Character, CharacterSex, Relationship } from '@/types';

interface Node {
  id: string;
  name: string;
  surname?: string;
  sex?: CharacterSex;
  imageUrl?: string;
  imageOffsetY?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Edge {
  source: string;
  target: string;
  type: string;
  label: string;
  familyLabelSource?: string;
  familyLabelTarget?: string;
  bidirectional: boolean;
  arrowTarget?: string; // actual target for unidirectional arrow (may differ from normalized target)
  index: number;
  total: number;
}

const EDGE_COLORS: Record<string, string> = {
  family: '#c4a35a',
  friend: '#16a34a',
  enemy: '#dc2626',
  lover: '#ec4899',
  mentor: '#3b82f6',
  rival: '#f97316',
  colleague: '#6b7280',
  custom: '#8b5cf6',
};

const SEX_BORDER_COLORS: Record<string, string> = {
  male: '#3b82f6',
  female: '#ec4899',
};
const DEFAULT_BORDER_COLOR = '#9ca3af';
const NODE_FILL = '#e8e0d4';
const NODE_RADIUS = 16;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.15;

function getBorderColor(sex?: CharacterSex): string {
  if (sex) return SEX_BORDER_COLORS[sex] ?? DEFAULT_BORDER_COLOR;
  return DEFAULT_BORDER_COLOR;
}

function getInitials(name: string, surname?: string): string {
  const first = name.charAt(0).toUpperCase();
  if (surname) return first + surname.charAt(0).toUpperCase();
  return first;
}

function getEdgeOffset(index: number, total: number): number {
  if (total <= 1) return 0;
  const spread = 40;
  return (index - (total - 1) / 2) * spread;
}

function quadBezier(p0: number, p1: number, p2: number, t: number): number {
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
}

function quadBezierTangent(p0: number, p1: number, p2: number, t: number): number {
  return 2 * (1 - t) * (p1 - p0) + 2 * t * (p2 - p1);
}

interface TooltipData {
  screenX: number;
  screenY: number;
  character: Character;
  relationships: { rel: Relationship; target: Character | undefined }[];
}

function getViewportKey(bookId: string) {
  return `fabula-mea-graph-viewport:${bookId}`;
}

function loadSavedViewport(bookId: string): { scale: number; panX: number; panY: number } | null {
  try {
    const raw = sessionStorage.getItem(getViewportKey(bookId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.scale === 'number' && typeof parsed.panX === 'number' && typeof parsed.panY === 'number') {
      return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

export function RelationshipGraph() {
  const navigate = useNavigate();
  const { characters, graphNodePositions: rawGraphNodePositions, saveGraphNodePositions } = useEncyclopediaStore();
  const bookId = useBookStore((s) => s.id);
  const graphNodePositions = rawGraphNodePositions ?? {};
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const sizeRef = useRef({ w: 800, h: 600 });
  const mouseDraggedRef = useRef(false);

  // Zoom & pan state (refs for animation loop performance)
  const savedViewport = bookId ? loadSavedViewport(bookId) : null;
  const scaleRef = useRef(savedViewport?.scale ?? 1);
  const panRef = useRef({ x: savedViewport?.panX ?? 0, y: savedViewport?.panY ?? 0 });
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });
  // State mirror to trigger re-render for zoom buttons display
  const [scaleDisplay, setScaleDisplay] = useState(scaleRef.current);

  const saveViewport = useCallback(() => {
    if (!bookId) return;
    sessionStorage.setItem(getViewportKey(bookId), JSON.stringify({
      scale: scaleRef.current,
      panX: panRef.current.x,
      panY: panRef.current.y,
    }));
  }, [bookId]);

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback((sx: number, sy: number) => {
    return {
      x: (sx - panRef.current.x) / scaleRef.current,
      y: (sy - panRef.current.y) / scaleRef.current,
    };
  }, []);

  // Convert world coordinates to screen coordinates
  const worldToScreen = useCallback((wx: number, wy: number) => {
    return {
      x: wx * scaleRef.current + panRef.current.x,
      y: wy * scaleRef.current + panRef.current.y,
    };
  }, []);

  const applyZoom = useCallback((newScale: number, centerX: number, centerY: number) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    const ratio = clamped / scaleRef.current;
    panRef.current.x = centerX - ratio * (centerX - panRef.current.x);
    panRef.current.y = centerY - ratio * (centerY - panRef.current.y);
    scaleRef.current = clamped;
    setScaleDisplay(clamped);
    setTooltip(null);
    saveViewport();
  }, [saveViewport]);

  // Fit all nodes into the viewport with padding
  const fitToView = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    const padding = 120;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    }

    const labelMargin = 30; // space for name labels below nodes
    const nodesW = maxX - minX + NODE_RADIUS * 2 + labelMargin * 2 + padding * 2;
    const nodesH = maxY - minY + NODE_RADIUS * 2 + labelMargin * 2 + padding * 2;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(w / nodesW, h / nodesH, 1.5)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    scaleRef.current = scale;
    panRef.current.x = w / 2 - cx * scale;
    panRef.current.y = h / 2 - cy * scale;
    setScaleDisplay(scale);
    setTooltip(null);
    saveViewport();
  }, [saveViewport]);

  // Load images for characters with avatars
  useEffect(() => {
    for (const char of characters) {
      if (char.imageUrl && !imagesRef.current.has(char.id)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = char.imageUrl;
        imagesRef.current.set(char.id, img);
      }
    }
  }, [characters]);

  // Build edges
  const edges = useMemo<Edge[]>(() => {
    const edgeList: { source: string; target: string; type: string; label: string; familyLabelSource?: string; familyLabelTarget?: string; bidirectional: boolean; arrowTarget?: string }[] = [];
    const relMap = new Map<string, boolean>();
    for (const char of characters) {
      for (const rel of char.relationships) {
        relMap.set(`${char.id}|${rel.targetCharacterId}|${rel.type}`, true);
      }
    }

    const seen = new Set<string>();
    for (const char of characters) {
      for (const rel of char.relationships) {
        const reverseKey = `${rel.targetCharacterId}|${char.id}|${rel.type}`;
        const [sortedA, sortedB] = [char.id, rel.targetCharacterId].sort();
        const dedupeKey = `${sortedA}-${sortedB}|${rel.type}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const isBidirectional = relMap.has(`${char.id}|${rel.targetCharacterId}|${rel.type}`) && relMap.has(reverseKey);

        // Normalize source/target to sorted order so curve direction is consistent
        const isFlipped = char.id !== sortedA;

        let familyLabelSource: string | undefined;
        let familyLabelTarget: string | undefined;
        if (rel.type === 'family') {
          familyLabelSource = rel.familyRoleSource ? (FAMILY_ROLE_LABELS[rel.familyRoleSource] ?? rel.familyRoleSource) : undefined;
          familyLabelTarget = rel.familyRoleTarget ? (FAMILY_ROLE_LABELS[rel.familyRoleTarget] ?? rel.familyRoleTarget) : undefined;
        }

        edgeList.push({
          source: sortedA,
          target: sortedB,
          type: rel.type,
          label: rel.type === 'custom' ? (rel.customType ?? '') : RELATIONSHIP_TYPE_LABELS[rel.type],
          familyLabelSource: isFlipped ? familyLabelTarget : familyLabelSource,
          familyLabelTarget: isFlipped ? familyLabelSource : familyLabelTarget,
          bidirectional: isBidirectional,
          arrowTarget: isBidirectional ? undefined : rel.targetCharacterId,
        });
      }
    }

    const pairCount = new Map<string, number>();
    for (const e of edgeList) {
      const key = [e.source, e.target].sort().join('-');
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    }
    const pairIndex = new Map<string, number>();
    return edgeList.map((e) => {
      const key = [e.source, e.target].sort().join('-');
      const idx = pairIndex.get(key) ?? 0;
      pairIndex.set(key, idx + 1);
      return { ...e, index: idx, total: pairCount.get(key) ?? 1 };
    });
  }, [characters]);

  // Initialize nodes with positions and pre-run simulation so nodes are stable on first render
  useEffect(() => {
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    const existing = new Map(nodesRef.current.map((n) => [n.id, n]));
    let hasNewNodes = false;

    nodesRef.current = characters.map((c, i) => {
      const ex = existing.get(c.id);
      if (ex) return { ...ex, name: c.name, surname: c.surname, sex: c.sex, imageUrl: c.imageUrl, imageOffsetY: c.imageOffsetY };
      const saved = graphNodePositions[c.id];
      if (saved) {
        return {
          id: c.id, name: c.name, surname: c.surname, sex: c.sex,
          imageUrl: c.imageUrl, imageOffsetY: c.imageOffsetY,
          x: saved.x, y: saved.y, vx: 0, vy: 0,
        };
      }
      hasNewNodes = true;
      const angle = (2 * Math.PI * i) / characters.length;
      const r = Math.min(w, h) * 0.35;
      return {
        id: c.id, name: c.name, surname: c.surname, sex: c.sex,
        imageUrl: c.imageUrl, imageOffsetY: c.imageOffsetY,
        x: w / 2 + r * Math.cos(angle),
        y: h / 2 + r * Math.sin(angle),
        vx: 0, vy: 0,
      };
    });

    // Pre-run force simulation synchronously so nodes are well-positioned on first render
    if (hasNewNodes && nodesRef.current.length > 1) {
      const nodes = nodesRef.current;
      for (let iter = 0; iter < 120; iter++) {
        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const repulsion = 8000 / (dist * dist);
            const fx = (dx / dist) * repulsion;
            const fy = (dy / dist) * repulsion;
            nodes[i].vx -= fx;
            nodes[i].vy -= fy;
            nodes[j].vx += fx;
            nodes[j].vy += fy;
          }
        }
        // Attraction along edges
        for (const edge of edges) {
          const source = nodes.find((n) => n.id === edge.source);
          const target = nodes.find((n) => n.id === edge.target);
          if (!source || !target) continue;
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const attraction = (dist - 160) * 0.005;
          const fx = (dx / Math.max(dist, 1)) * attraction;
          const fy = (dy / Math.max(dist, 1)) * attraction;
          source.vx += fx;
          source.vy += fy;
          target.vx -= fx;
          target.vy -= fy;
        }
        // Centering
        for (const node of nodes) {
          node.vx += (w / 2 - node.x) * 0.001;
          node.vy += (h / 2 - node.y) * 0.001;
          node.vx *= 0.85;
          node.vy *= 0.85;
          node.x += node.vx;
          node.y += node.vy;
        }
      }
      // Zero out velocities so the live simulation starts calm
      for (const node of nodes) {
        node.vx = 0;
        node.vy = 0;
      }
    }

    // Fit to view only if no saved viewport
    const saved = bookId ? loadSavedViewport(bookId) : null;
    if (saved) {
      scaleRef.current = saved.scale;
      panRef.current.x = saved.panX;
      panRef.current.y = saved.panY;
      setScaleDisplay(saved.scale);
      needsFitRef.current = false;
    } else {
      needsFitRef.current = true;
    }
  }, [characters, edges]); // eslint-disable-line react-hooks/exhaustive-deps


  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = nodesRef.current;
    const w = canvas.width;
    const h = canvas.height;
    const scale = scaleRef.current;
    const pan = panRef.current;

    // Clear in screen space
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Apply zoom & pan transform
    ctx.setTransform(scale, 0, 0, scale, pan.x, pan.y);

    // Draw edges
    for (const edge of edges) {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;
      const edgeColor = EDGE_COLORS[edge.type] ?? '#999';

      const offset = getEdgeOffset(edge.index, edge.total);
      const perpX = (-dy / dist) * offset;
      const perpY = (dx / dist) * offset;

      const cpx = (source.x + target.x) / 2 + perpX;
      const cpy = (source.y + target.y) / 2 + perpY;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.quadraticCurveTo(cpx, cpy, target.x, target.y);
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 2 / scale;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Arrow for unidirectional relationships
      if (!edge.bidirectional && dist > 50) {
        // Arrow points toward arrowTarget; if arrowTarget is the normalized source, reverse direction
        const arrowAtSource = edge.arrowTarget === edge.source;
        const tArrow = arrowAtSource ? (NODE_RADIUS + 4) / dist : 1 - (NODE_RADIUS + 4) / dist;
        const arrowX = quadBezier(source.x, cpx, target.x, tArrow);
        const arrowY = quadBezier(source.y, cpy, target.y, tArrow);
        let tangentX = quadBezierTangent(source.x, cpx, target.x, tArrow);
        let tangentY = quadBezierTangent(source.y, cpy, target.y, tArrow);
        if (arrowAtSource) { tangentX = -tangentX; tangentY = -tangentY; }
        const angle = Math.atan2(tangentY, tangentX);
        const arrowLen = 10;
        const arrowAngle = Math.PI / 6;

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLen * Math.cos(angle - arrowAngle),
          arrowY - arrowLen * Math.sin(angle - arrowAngle)
        );
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLen * Math.cos(angle + arrowAngle),
          arrowY - arrowLen * Math.sin(angle + arrowAngle)
        );
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = 2.5 / scale;
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Edge label(s)
      const mx = quadBezier(source.x, cpx, target.x, 0.5);
      const my = quadBezier(source.y, cpy, target.y, 0.5);
      ctx.font = `${10 / scale}px Inter, sans-serif`;
      ctx.textAlign = 'center';

      if (edge.type === 'family' && edge.familyLabelSource && edge.familyLabelTarget) {
        const srcLabelX = quadBezier(source.x, cpx, target.x, 0.25);
        const srcLabelY = quadBezier(source.y, cpy, target.y, 0.25) - 8;
        const tgtLabelX = quadBezier(source.x, cpx, target.x, 0.75);
        const tgtLabelY = quadBezier(source.y, cpy, target.y, 0.75) - 8;

        ctx.fillStyle = edgeColor;
        ctx.fillText(edge.familyLabelSource, srcLabelX, srcLabelY);
        ctx.fillText(edge.familyLabelTarget, tgtLabelX, tgtLabelY);
      } else {
        ctx.fillStyle = edgeColor;
        ctx.fillText(edge.label, mx, my - 6);
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const isHovered = node.id === hoveredNode;
      const r = isHovered ? NODE_RADIUS + 2 : NODE_RADIUS;
      const borderColor = getBorderColor(node.sex);
      const img = node.imageUrl ? imagesRef.current.get(node.id) : undefined;
      const imageReady = img && img.complete && img.naturalWidth > 0;

      // Border ring
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2.5 / scale;
      ctx.stroke();

      // Clip for avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.clip();

      if (imageReady) {
        const imgW = img!.naturalWidth;
        const imgH = img!.naturalHeight;
        const diameter = r * 2;
        const imgAspect = imgW / imgH;
        let drawW: number, drawH: number, drawX: number, drawY: number;
        if (imgAspect > 1) {
          drawH = diameter;
          drawW = diameter * imgAspect;
        } else {
          drawW = diameter;
          drawH = diameter / imgAspect;
        }
        drawW *= 1.4;
        drawH *= 1.4;
        drawX = node.x - drawW / 2;
        drawY = node.y - drawH / 2;
        const oY = node.imageOffsetY ?? 50;
        drawY += (50 - oY) * 0.6 / 100 * drawH;
        ctx.drawImage(img!, drawX, drawY, drawW, drawH);
      } else {
        ctx.fillStyle = NODE_FILL;
        ctx.fillRect(node.x - r, node.y - r, r * 2, r * 2);

        ctx.font = `bold ${isHovered ? 12 : 10}px "Playfair Display", serif`;
        ctx.fillStyle = '#5c4a3a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(getInitials(node.name, node.surname), node.x, node.y);
      }

      ctx.restore();

      // Name label below
      ctx.font = `${9 / scale}px Inter, sans-serif`;
      ctx.fillStyle = '#2d2118';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(node.name, node.x, node.y + r + 4);
    }

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [edges, hoveredNode]);

  // Flag to trigger fitToView on next frame (set by node initialization)
  const needsFitRef = useRef(true);

  // Animation loop (draw only, no live simulation)
  useEffect(() => {
    const loop = () => {
      draw();
      // Fit to view on first frame after nodes are initialized
      if (needsFitRef.current && nodesRef.current.length > 0) {
        fitToView();
        needsFitRef.current = false;
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw, fitToView]);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 600;
      sizeRef.current = { w: rect.width, h: 600 };
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom (mouse wheel + trackpad pinch)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Trackpad pinch sends ctrlKey + small deltaY; mouse wheel sends larger deltaY
      const delta = -e.deltaY * (e.ctrlKey ? 0.01 : 0.002);
      const newScale = scaleRef.current * (1 + delta);
      applyZoom(newScale, mouseX, mouseY);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  const findNodeAt = useCallback((screenX: number, screenY: number) => {
    const world = screenToWorld(screenX, screenY);
    const hitRadius = NODE_RADIUS + 5;
    return nodesRef.current.find((n) => {
      const dx = n.x - world.x;
      const dy = n.y - world.y;
      return dx * dx + dy * dy < hitRadius * hitRadius;
    });
  }, [screenToWorld]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Panning
    if (isPanningRef.current) {
      mouseDraggedRef.current = true;
      panRef.current.x += sx - lastPanPosRef.current.x;
      panRef.current.y += sy - lastPanPosRef.current.y;
      lastPanPosRef.current = { x: sx, y: sy };
      setTooltip(null);
      return;
    }

    // Dragging a node
    if (dragNode) {
      mouseDraggedRef.current = true;
      const world = screenToWorld(sx, sy);
      const node = nodesRef.current.find((n) => n.id === dragNode);
      if (node) {
        node.x = world.x;
        node.y = world.y;
        node.vx = 0;
        node.vy = 0;
      }
      setTooltip(null);
      return;
    }

    const found = findNodeAt(sx, sy);
    setHoveredNode(found?.id ?? null);
    canvas.style.cursor = found ? 'pointer' : 'grab';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const found = findNodeAt(sx, sy);
    if (found) {
      setDragNode(found.id);
      mouseDraggedRef.current = false;
    } else {
      // Start panning
      isPanningRef.current = true;
      lastPanPosRef.current = { x: sx, y: sy };
      mouseDraggedRef.current = false;
      canvas.style.cursor = 'grabbing';
    }
  };

  const handleMouseUp = () => {
    if (dragNode) {
      const positions: Record<string, { x: number; y: number }> = {};
      for (const node of nodesRef.current) {
        positions[node.id] = { x: node.x, y: node.y };
      }
      saveGraphNodePositions(positions);
    }
    if (isPanningRef.current) {
      saveViewport();
    }
    setDragNode(null);
    isPanningRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'grab';
  };

  const buildTooltip = useCallback((found: Node): TooltipData | null => {
    const char = characters.find((c) => c.id === found.id);
    if (!char) return null;
    const rels = char.relationships.map((rel) => ({
      rel,
      target: characters.find((c) => c.id === rel.targetCharacterId),
    }));
    const screen = worldToScreen(found.x, found.y);
    return {
      screenX: screen.x,
      screenY: screen.y,
      character: char,
      relationships: rels,
    };
  }, [characters, worldToScreen]);

  const handleClick = (e: React.MouseEvent) => {
    if (mouseDraggedRef.current) {
      mouseDraggedRef.current = false;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const found = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);

    if (found) {
      setTooltip(buildTooltip(found));
    } else {
      setTooltip(null);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const found = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (found) {
      setTooltip(null);
      navigate(`/characters/${found.id}`);
    }
  };

  // ── Touch events ──
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const touchMovedRef = useRef(false);
  const dragNodeRef = useRef<string | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number; cx: number; cy: number } | null>(null);

  useEffect(() => { dragNodeRef.current = dragNode; }, [dragNode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getTouchDist = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect();

      // Pinch zoom with 2 fingers
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getTouchDist(e.touches[0], e.touches[1]);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        pinchRef.current = { dist, scale: scaleRef.current, cx, cy };
        isPanningRef.current = false;
        dragNodeRef.current && setDragNode(null);
        return;
      }

      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      touchStartRef.current = { x, y, time: Date.now() };
      touchMovedRef.current = false;

      const found = findNodeAt(x, y);
      if (found) {
        e.preventDefault();
        setDragNode(found.id);
      } else {
        // Start panning
        isPanningRef.current = true;
        lastPanPosRef.current = { x, y };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect();

      // Pinch zoom
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dist = getTouchDist(e.touches[0], e.touches[1]);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const newScale = pinchRef.current.scale * (dist / pinchRef.current.dist);
        applyZoom(newScale, cx, cy);
        touchMovedRef.current = true;
        return;
      }

      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      touchMovedRef.current = true;

      // Panning
      if (isPanningRef.current && !dragNodeRef.current) {
        e.preventDefault();
        panRef.current.x += x - lastPanPosRef.current.x;
        panRef.current.y += y - lastPanPosRef.current.y;
        lastPanPosRef.current = { x, y };
        setTooltip(null);
        return;
      }

      // Dragging a node
      if (dragNodeRef.current) {
        e.preventDefault();
        const world = screenToWorld(x, y);
        const node = nodesRef.current.find((n) => n.id === dragNodeRef.current);
        if (node) {
          node.x = world.x;
          node.y = world.y;
          node.vx = 0;
          node.vy = 0;
        }
        setTooltip(null);
      }
    };

    const onTouchEnd = () => {
      pinchRef.current = null;

      if (dragNodeRef.current) {
        const positions: Record<string, { x: number; y: number }> = {};
        for (const node of nodesRef.current) {
          positions[node.id] = { x: node.x, y: node.y };
        }
        saveGraphNodePositions(positions);
        setDragNode(null);
      }

      if (isPanningRef.current || touchMovedRef.current) {
        saveViewport();
      }
      isPanningRef.current = false;

      if (!touchMovedRef.current && touchStartRef.current) {
        const { x, y } = touchStartRef.current;
        const now = Date.now();

        if (now - lastTapRef.current < 300) {
          const found = findNodeAt(x, y);
          if (found) {
            setTooltip(null);
            navigate(`/characters/${found.id}`);
          }
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
          const found = findNodeAt(x, y);
          if (found) {
            setTooltip(buildTooltip(found));
          } else {
            setTooltip(null);
          }
        }
      }

      touchStartRef.current = null;
    };

    const onTouchCancel = () => {
      setDragNode(null);
      isPanningRef.current = false;
      pinchRef.current = null;
      setTooltip(null);
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchCancel);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [characters, navigate, saveGraphNodePositions, applyZoom, findNodeAt, screenToWorld, buildTooltip, saveViewport]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleZoomIn = () => {
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    applyZoom(scaleRef.current * (1 + ZOOM_STEP), w / 2, h / 2);
  };

  const handleZoomOut = () => {
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    applyZoom(scaleRef.current * (1 - ZOOM_STEP), w / 2, h / 2);
  };

  const handleZoomReset = () => {
    fitToView();
  };

  if (characters.length === 0) return null;

  const hasRelationships = characters.some((c) => c.relationships.length > 0);

  if (!hasRelationships) {
    return (
      <div className="card-fantasy p-6 text-center">
        <p className="text-sm text-ink-200 italic">
          Ajoutez des relations entre personnages pour voir le graphe
        </p>
      </div>
    );
  }

  function getRelTooltipLabel(rel: Relationship): string {
    if (rel.type === 'custom') return rel.customType ?? 'Autre';
    if (rel.type === 'family' && rel.familyRoleSource) {
      return `Famille (${FAMILY_ROLE_LABELS[rel.familyRoleSource] ?? rel.familyRoleSource})`;
    }
    return RELATIONSHIP_TYPE_LABELS[rel.type] ?? rel.type;
  }

  return (
    <div className="card-fantasy overflow-hidden" ref={containerRef}>
      <div className="p-4 border-b border-parchment-200">
        <h3 className="font-display font-semibold text-ink-500">Graphe des relations</h3>
        <p className="text-xs text-ink-200 mt-1">Cliquez pour voir les relations. Double-cliquez pour voir la fiche. Glissez le fond pour naviguer.</p>
      </div>
      {/* Legend */}
      <div className="px-4 py-2 flex flex-wrap gap-4 border-b border-parchment-100">
        <div className="flex items-center gap-3 text-[10px] text-ink-300">
          <span className="font-medium text-ink-400">Bordures :</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: SEX_BORDER_COLORS.male, backgroundColor: NODE_FILL }} />
            Homme
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: SEX_BORDER_COLORS.female, backgroundColor: NODE_FILL }} />
            Femme
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: DEFAULT_BORDER_COLOR, backgroundColor: NODE_FILL }} />
            Non precise
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-ink-300">
          <span className="font-medium text-ink-400">Liens :</span>
          {Object.entries(EDGE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
              {RELATIONSHIP_TYPE_LABELS[type]}
            </div>
          ))}
        </div>
      </div>
      <div className="w-full relative">
        {/* Zoom controls */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
          <button
            onClick={handleZoomIn}
            className="p-1.5 bg-white/90 hover:bg-white rounded-lg shadow border border-parchment-200 text-ink-400 hover:text-ink-600 transition-colors"
            title="Zoom +"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 bg-white/90 hover:bg-white rounded-lg shadow border border-parchment-200 text-ink-400 hover:text-ink-600 transition-colors"
            title="Zoom -"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={handleZoomReset}
            className="p-1.5 bg-white/90 hover:bg-white rounded-lg shadow border border-parchment-200 text-ink-400 hover:text-ink-600 transition-colors"
            title="Réinitialiser la vue"
          >
            <Maximize2 size={16} />
          </button>
          <span className="text-[10px] text-ink-300 text-center mt-0.5">{Math.round(scaleDisplay * 100)}%</span>
        </div>

        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="w-full"
          style={{ cursor: 'grab' }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setTooltip(null); }}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        />

        {/* Tooltip overlay */}
        {tooltip && (() => {
          const tooltipWidth = 240;
          const gap = (NODE_RADIUS + 12) * scaleRef.current;
          const canvasH = sizeRef.current.h;
          const estimatedHeight = 40 + Math.max(1, tooltip.relationships.length) * 18;
          const fitsBelow = tooltip.screenY + gap + estimatedHeight < canvasH;
          const left = Math.max(4, Math.min(tooltip.screenX - tooltipWidth / 2, sizeRef.current.w - tooltipWidth - 4));
          const topStyle = fitsBelow
            ? { top: tooltip.screenY + gap }
            : { bottom: canvasH - tooltip.screenY + gap };
          return (
          <div
            className="absolute z-10 bg-white rounded-xl shadow-lg border border-parchment-200 p-3 pointer-events-none"
            style={{
              left,
              ...topStyle,
              width: tooltipWidth,
            }}
          >
            <p className="font-display font-bold text-ink-500 text-sm mb-1">
              {tooltip.character.name} {tooltip.character.surname}
            </p>
            {tooltip.relationships.length === 0 ? (
              <p className="text-xs text-ink-200 italic">Aucune relation</p>
            ) : (
              <ul className="space-y-1">
                {tooltip.relationships.map(({ rel, target }) => (
                  <li key={rel.id} className="text-xs">
                    <span className="font-medium" style={{ color: EDGE_COLORS[rel.type] ?? '#999' }}>
                      {getRelTooltipLabel(rel)}
                    </span>
                    {' → '}
                    <span className="text-ink-400">{target?.name ?? 'Inconnu'}</span>
                    {rel.description && (
                      <p className="text-ink-300 ml-2 mt-0.5">{rel.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          );
        })()}
      </div>
    </div>
  );
}
