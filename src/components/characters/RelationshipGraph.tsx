import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookStore } from '@/store/useBookStore';
import { RELATIONSHIP_TYPE_LABELS } from '@/lib/utils';

interface Node {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

interface Edge {
  source: string;
  target: string;
  type: string;
  label: string;
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

export function RelationshipGraph() {
  const navigate = useNavigate();
  const characters = useBookStore((s) => s.characters);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const sizeRef = useRef({ w: 800, h: 500 });

  const edges = useMemo<Edge[]>(() => {
    const edgeList: Edge[] = [];
    const seen = new Set<string>();
    for (const char of characters) {
      for (const rel of char.relationships) {
        const key = [char.id, rel.targetCharacterId].sort().join('-');
        if (!seen.has(key)) {
          seen.add(key);
          edgeList.push({
            source: char.id,
            target: rel.targetCharacterId,
            type: rel.type,
            label: rel.type === 'custom' ? (rel.customType ?? '') : RELATIONSHIP_TYPE_LABELS[rel.type],
          });
        }
      }
    }
    return edgeList;
  }, [characters]);

  // Initialize nodes with positions
  useEffect(() => {
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    const existing = new Map(nodesRef.current.map((n) => [n.id, n]));

    nodesRef.current = characters.map((c, i) => {
      const ex = existing.get(c.id);
      if (ex) return { ...ex, name: c.name };
      const angle = (2 * Math.PI * i) / characters.length;
      const r = Math.min(w, h) * 0.3;
      return {
        id: c.id,
        name: c.name,
        x: w / 2 + r * Math.cos(angle),
        y: h / 2 + r * Math.sin(angle),
        vx: 0,
        vy: 0,
        color: `hsl(${(i * 360) / characters.length}, 50%, 45%)`,
      };
    });
  }, [characters]);

  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;

    // Simple force simulation
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

    // Edge attraction
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

    // Center gravity
    for (const node of nodes) {
      node.vx += (w / 2 - node.x) * 0.001;
      node.vy += (h / 2 - node.y) * 0.001;
    }

    // Apply velocity with damping
    for (const node of nodes) {
      if (node.id === dragNode) continue;
      node.vx *= 0.85;
      node.vy *= 0.85;
      node.x += node.vx;
      node.y += node.vy;
      node.x = Math.max(30, Math.min(w - 30, node.x));
      node.y = Math.max(30, Math.min(h - 30, node.y));
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

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = EDGE_COLORS[edge.type] ?? '#999';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Edge label
      const mx = (source.x + target.x) / 2;
      const my = (source.y + target.y) / 2;
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = EDGE_COLORS[edge.type] ?? '#666';
      ctx.textAlign = 'center';
      ctx.fillText(edge.label, mx, my - 5);
    }

    // Draw nodes
    for (const node of nodes) {
      const isHovered = node.id === hoveredNode;
      const r = isHovered ? 24 : 20;

      // Shadow
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fill();

      // Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isHovered ? '#8b2252' : '#faf6f0';
      ctx.fill();
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Initial
      ctx.font = `bold ${isHovered ? 14 : 12}px "Playfair Display", serif`;
      ctx.fillStyle = isHovered ? '#fff' : '#2d2118';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.name.charAt(0).toUpperCase(), node.x, node.y);

      // Name label
      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = '#2d2118';
      ctx.textBaseline = 'top';
      ctx.fillText(node.name, node.x, node.y + r + 4);
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
      return dx * dx + dy * dy < 625; // 25^2
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

  const handleDoubleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const found = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (found) navigate(`/characters/${found.id}`);
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

  return (
    <div className="card-fantasy overflow-hidden">
      <div className="p-4 border-b border-parchment-200">
        <h3 className="font-display font-semibold text-ink-500">Graphe des relations</h3>
        <p className="text-xs text-ink-200 mt-1">Double-cliquez sur un personnage pour voir sa fiche. Glissez pour deplacer.</p>
      </div>
      {/* Legend */}
      <div className="px-4 py-2 flex flex-wrap gap-3 border-b border-parchment-100">
        {Object.entries(EDGE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1 text-[10px] text-ink-300">
            <div className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
            {RELATIONSHIP_TYPE_LABELS[type]}
          </div>
        ))}
      </div>
      <div className="w-full">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="w-full"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        />
      </div>
    </div>
  );
}
