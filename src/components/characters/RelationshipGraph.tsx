import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookStore } from '@/store/useBookStore';
import { RELATIONSHIP_TYPE_LABELS, FAMILY_ROLE_LABELS } from '@/lib/utils';
import type { Character, CharacterSex, Relationship } from '@/types';

interface Node {
  id: string;
  name: string;
  surname?: string;
  sex?: CharacterSex;
  imageUrl?: string;
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
  familyLabelSource?: string; // label near source node for family
  familyLabelTarget?: string; // label near target node for family
  bidirectional: boolean;
  index: number;   // index among edges between same pair
  total: number;    // total edges between same pair
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
const NODE_FILL = '#e8e0d4'; // parchment-ish gray fill for all nodes
const NODE_RADIUS = 22;

function getBorderColor(sex?: CharacterSex): string {
  if (sex) return SEX_BORDER_COLORS[sex] ?? DEFAULT_BORDER_COLOR;
  return DEFAULT_BORDER_COLOR;
}

function getInitials(name: string, surname?: string): string {
  const first = name.charAt(0).toUpperCase();
  if (surname) return first + surname.charAt(0).toUpperCase();
  return first;
}

// Compute a perpendicular offset for multi-edges between same pair
function getEdgeOffset(index: number, total: number): number {
  if (total <= 1) return 0;
  const spread = 16; // pixels between parallel edges
  return (index - (total - 1) / 2) * spread;
}

// Tooltip data
interface TooltipData {
  x: number;
  y: number;
  character: Character;
  relationships: { rel: Relationship; target: Character | undefined }[];
}

export function RelationshipGraph() {
  const navigate = useNavigate();
  const characters = useBookStore((s) => s.characters);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const sizeRef = useRef({ w: 800, h: 500 });

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

  // Build edges: detect bidirectional relationships, compute multi-edge indices
  const edges = useMemo<Edge[]>(() => {
    const edgeList: { source: string; target: string; type: string; label: string; familyLabelSource?: string; familyLabelTarget?: string; bidirectional: boolean }[] = [];
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
        const dedupeKey = [char.id, rel.targetCharacterId].sort().join('-') + '|' + rel.type;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const isBidirectional = relMap.has(`${char.id}|${rel.targetCharacterId}|${rel.type}`) && relMap.has(reverseKey);

        let familyLabelSource: string | undefined;
        let familyLabelTarget: string | undefined;
        if (rel.type === 'family') {
          familyLabelSource = rel.familyRoleSource ? (FAMILY_ROLE_LABELS[rel.familyRoleSource] ?? rel.familyRoleSource) : undefined;
          familyLabelTarget = rel.familyRoleTarget ? (FAMILY_ROLE_LABELS[rel.familyRoleTarget] ?? rel.familyRoleTarget) : undefined;
        }

        edgeList.push({
          source: char.id,
          target: rel.targetCharacterId,
          type: rel.type,
          label: rel.type === 'custom' ? (rel.customType ?? '') : RELATIONSHIP_TYPE_LABELS[rel.type],
          familyLabelSource,
          familyLabelTarget,
          bidirectional: isBidirectional,
        });
      }
    }

    // Count edges per pair and assign indices
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

  // Initialize nodes with positions
  useEffect(() => {
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    const existing = new Map(nodesRef.current.map((n) => [n.id, n]));

    nodesRef.current = characters.map((c, i) => {
      const ex = existing.get(c.id);
      if (ex) return { ...ex, name: c.name, surname: c.surname, sex: c.sex, imageUrl: c.imageUrl };
      const angle = (2 * Math.PI * i) / characters.length;
      const r = Math.min(w, h) * 0.3;
      return {
        id: c.id,
        name: c.name,
        surname: c.surname,
        sex: c.sex,
        imageUrl: c.imageUrl,
        x: w / 2 + r * Math.cos(angle),
        y: h / 2 + r * Math.sin(angle),
        vx: 0,
        vy: 0,
      };
    });
  }, [characters]);

  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;

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

    for (const edge of edges) {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const attraction = (dist - 150) * 0.005;
      const fx = (dx / Math.max(dist, 1)) * attraction;
      const fy = (dy / Math.max(dist, 1)) * attraction;
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    for (const node of nodes) {
      node.vx += (w / 2 - node.x) * 0.001;
      node.vy += (h / 2 - node.y) * 0.001;
    }

    for (const node of nodes) {
      if (node.id === dragNode) continue;
      node.vx *= 0.85;
      node.vy *= 0.85;
      node.x += node.vx;
      node.y += node.vy;
      node.x = Math.max(40, Math.min(w - 40, node.x));
      node.y = Math.max(40, Math.min(h - 40, node.y));
    }
  }, [edges, dragNode]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = nodesRef.current;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

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

      // Perpendicular offset for multi-edges
      const offset = getEdgeOffset(edge.index, edge.total);
      const perpX = (-dy / dist) * offset;
      const perpY = (dx / dist) * offset;

      const sx = source.x + perpX;
      const sy = source.y + perpY;
      const tx = target.x + perpX;
      const ty = target.y + perpY;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Arrow for unidirectional relationships
      if (!edge.bidirectional && dist > 50) {
        const ratio = (dist - NODE_RADIUS - 4) / dist;
        const arrowX = sx + (tx - sx) * ratio;
        const arrowY = sy + (ty - sy) * ratio;
        const angle = Math.atan2(ty - sy, tx - sx);
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
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Edge label(s)
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';

      if (edge.type === 'family' && edge.familyLabelSource && edge.familyLabelTarget) {
        // Show role labels near each node
        const labelOffsetRatio = 0.25;
        const srcLabelX = sx + (tx - sx) * labelOffsetRatio;
        const srcLabelY = sy + (ty - sy) * labelOffsetRatio - 8;
        const tgtLabelX = sx + (tx - sx) * (1 - labelOffsetRatio);
        const tgtLabelY = sy + (ty - sy) * (1 - labelOffsetRatio) - 8;

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
      const r = isHovered ? NODE_RADIUS + 3 : NODE_RADIUS;
      const borderColor = getBorderColor(node.sex);
      const img = node.imageUrl ? imagesRef.current.get(node.id) : undefined;
      const imageReady = img && img.complete && img.naturalWidth > 0;

      // Border ring
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 2.5, 0, 2 * Math.PI);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Clip for avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.clip();

      if (imageReady) {
        // Draw avatar image
        ctx.drawImage(img!, node.x - r, node.y - r, r * 2, r * 2);
      } else {
        // Gray fill with initials
        ctx.fillStyle = NODE_FILL;
        ctx.fillRect(node.x - r, node.y - r, r * 2, r * 2);

        ctx.font = `bold ${isHovered ? 14 : 12}px "Playfair Display", serif`;
        ctx.fillStyle = '#5c4a3a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(getInitials(node.name, node.surname), node.x, node.y);
      }

      ctx.restore();

      // Name label below
      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = '#2d2118';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(node.name, node.x, node.y + r + 6);
    }
  }, [edges, hoveredNode]);

  // Animation loop
  useEffect(() => {
    const loop = () => {
      simulate();
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [simulate, draw]);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 500;
      sizeRef.current = { w: rect.width, h: 500 };
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const findNodeAt = (x: number, y: number) => {
    return nodesRef.current.find((n) => {
      const dx = n.x - x;
      const dy = n.y - y;
      return dx * dx + dy * dy < (NODE_RADIUS + 5) * (NODE_RADIUS + 5);
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragNode) {
      const node = nodesRef.current.find((n) => n.id === dragNode);
      if (node) {
        node.x = x;
        node.y = y;
        node.vx = 0;
        node.vy = 0;
      }
      setTooltip(null);
      return;
    }

    const found = findNodeAt(x, y);
    setHoveredNode(found?.id ?? null);
    canvas.style.cursor = found ? 'pointer' : 'default';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const found = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (found) setDragNode(found.id);
  };

  const handleMouseUp = () => {
    setDragNode(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const found = findNodeAt(x, y);

    if (found) {
      const char = characters.find((c) => c.id === found.id);
      if (char) {
        const rels = char.relationships.map((rel) => ({
          rel,
          target: characters.find((c) => c.id === rel.targetCharacterId),
        }));
        // Position tooltip relative to container
        const containerRect = containerRef.current?.getBoundingClientRect();
        const tooltipX = e.clientX - (containerRect?.left ?? 0);
        const tooltipY = e.clientY - (containerRect?.top ?? 0);
        setTooltip({ x: tooltipX, y: tooltipY, character: char, relationships: rels });
      }
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
        <p className="text-xs text-ink-200 mt-1">Cliquez pour voir les relations. Double-cliquez pour voir la fiche. Glissez pour deplacer.</p>
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
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="w-full"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setTooltip(null); }}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        />

        {/* Tooltip overlay */}
        {tooltip && (
          <div
            className="absolute z-10 bg-white rounded-xl shadow-lg border border-parchment-200 p-3 max-w-xs pointer-events-none"
            style={{
              left: Math.min(tooltip.x + 10, (sizeRef.current.w - 260)),
              top: Math.min(tooltip.y + 10, 400),
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
        )}
      </div>
    </div>
  );
}
