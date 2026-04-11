import type { GenealogyCoupleEdge, GenealogyParentChildEdge, GenealogyNodeLayout } from '@/lib/genealogy-layout';
import { NODE_SIZE } from '@/lib/genealogy-layout';

interface GenealogyEdgesProps {
  coupleEdges: GenealogyCoupleEdge[];
  parentChildEdges: GenealogyParentChildEdge[];
  nodeMap: Map<string, GenealogyNodeLayout>;
  /** When set, edges NOT connecting highlighted nodes are dimmed */
  dimmedIds?: Set<string> | null;
}

const R = NODE_SIZE / 2;

export function GenealogyEdges({ coupleEdges, parentChildEdges, nodeMap, dimmedIds }: GenealogyEdgesProps) {
  return (
    <g>
      {/* Couple edges (horizontal lines between spouses) */}
      {coupleEdges.map((edge, i) => {
        const n1 = nodeMap.get(edge.char1Id);
        const n2 = nodeMap.get(edge.char2Id);
        if (!n1 || !n2) return null;

        const x1 = Math.min(n1.x, n2.x) + R;
        const x2 = Math.max(n1.x, n2.x) - R;
        const y = n1.y;

        const isDimmed = dimmedIds != null && (!dimmedIds.has(edge.char1Id) || !dimmedIds.has(edge.char2Id));

        return (
          <line
            key={`couple-${i}`}
            x1={x1} y1={y} x2={x2} y2={y}
            stroke={edge.current ? '#c4a35a' : '#9ca3af'}
            strokeWidth={edge.current ? 2 : 1.5}
            strokeDasharray={edge.current ? undefined : '6 4'}
            style={{
              opacity: isDimmed ? 0.15 : 1,
              transition: 'opacity 0.2s ease',
            }}
          />
        );
      })}

      {/* Parent-child edges (vertical + horizontal connector lines) */}
      {parentChildEdges.map((edge, i) => {
        const parentNode = nodeMap.get(edge.parentId);
        const childNode = nodeMap.get(edge.childId);
        if (!parentNode || !childNode) return null;

        // If there's a second parent (spouse), draw from midpoint
        const secondParentNode = edge.secondParentId ? nodeMap.get(edge.secondParentId) : null;
        const topX = secondParentNode
          ? (parentNode.x + secondParentNode.x) / 2
          : parentNode.x;
        const topY = parentNode.y + R;
        const midY = (parentNode.y + childNode.y) / 2;
        const bottomY = childNode.y - R;
        const bottomX = childNode.x;

        // Dim if neither parent nor child is in the highlighted set
        const edgeCharIds = [edge.parentId, edge.childId];
        if (edge.secondParentId) edgeCharIds.push(edge.secondParentId);
        const isDimmed = dimmedIds != null && !edgeCharIds.some((id) => dimmedIds.has(id));

        return (
          <path
            key={`pc-${i}`}
            d={`M ${topX} ${topY} L ${topX} ${midY} L ${bottomX} ${midY} L ${bottomX} ${bottomY}`}
            fill="none"
            stroke="#a8a29e"
            strokeWidth={1.5}
            style={{
              opacity: isDimmed ? 0.15 : 1,
              transition: 'opacity 0.2s ease',
            }}
          />
        );
      })}
    </g>
  );
}
