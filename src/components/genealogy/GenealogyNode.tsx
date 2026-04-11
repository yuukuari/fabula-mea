import { useState } from 'react';
import { User, Pencil } from 'lucide-react';
import type { Character, CharacterSex } from '@/types';
import type { GenealogyBadges } from '@/lib/genealogy-layout';
import { NODE_SIZE } from '@/lib/genealogy-layout';

interface GenealogyNodeProps {
  character: Character;
  x: number;
  y: number;
  isCenter: boolean;
  badges?: GenealogyBadges;
  dimmed?: boolean;
  onClick: (characterId: string) => void;
  onEdit?: (characterId: string) => void;
  onHoverStart?: (characterId: string) => void;
  onHoverEnd?: () => void;
}

function getBorderColor(sex?: CharacterSex): string {
  if (sex === 'male') return '#3b82f6';
  if (sex === 'female') return '#ec4899';
  return '#9ca3af';
}

/** Build a short date label like "1850" or "1837 - 1876" */
function getDateLabel(character: Character): string | null {
  const birthYear = character.birthDate?.year;
  const deathYear = character.deathDate?.year;
  if (birthYear == null && deathYear == null) return null;
  if (birthYear != null && deathYear != null) return `${birthYear} - ${deathYear}`;
  if (birthYear != null) return `${birthYear}`;
  return `† ${deathYear}`;
}

const R = NODE_SIZE / 2;
const BADGE_SIZE = 18;
const BADGE_FONT = 10;

export function GenealogyNode({
  character, x, y, isCenter, badges, dimmed,
  onClick, onEdit, onHoverStart, onHoverEnd,
}: GenealogyNodeProps) {
  const [hovered, setHovered] = useState(false);
  const borderColor = getBorderColor(character.sex);
  const borderWidth = isCenter ? 3.5 : 2;
  const name = character.surname
    ? `${character.name} ${character.surname}`
    : character.name;
  const initials = (character.name?.[0] ?? '') + (character.surname?.[0] ?? '');
  const dateLabel = getDateLabel(character);

  const handlePointerEnter = () => {
    setHovered(true);
    onHoverStart?.(character.id);
  };
  const handlePointerLeave = () => {
    setHovered(false);
    onHoverEnd?.();
  };

  return (
    <g
      className="cursor-pointer"
      style={{
        opacity: dimmed ? 0.2 : 1,
        transition: 'opacity 0.2s ease',
      }}
      onClick={(e) => { e.stopPropagation(); onClick(character.id); }}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {/* Gold glow for center character */}
      {isCenter && (
        <circle cx={x} cy={y} r={R + 4} fill="none" stroke="#c4a35a" strokeWidth={2} opacity={0.5} />
      )}

      {/* Avatar circle */}
      <clipPath id={`avatar-clip-${character.id}`}>
        <circle cx={x} cy={y} r={R - borderWidth} />
      </clipPath>

      {/* Background */}
      <circle cx={x} cy={y} r={R - borderWidth} fill="#e8e0d4" />

      {/* Avatar image */}
      {character.imageUrl ? (
        <image
          href={character.imageUrl}
          x={x - R + borderWidth}
          y={y - R + borderWidth}
          width={(R - borderWidth) * 2}
          height={(R - borderWidth) * 2}
          clipPath={`url(#avatar-clip-${character.id})`}
          preserveAspectRatio="xMidYMid slice"
          style={{ transform: `translateY(${((50 - (character.imageOffsetY ?? 50)) * 0.6 * (R - borderWidth) * 2) / 100}px)` }}
        />
      ) : (
        <foreignObject
          x={x - R + borderWidth}
          y={y - R + borderWidth}
          width={(R - borderWidth) * 2}
          height={(R - borderWidth) * 2}
        >
          <div className="w-full h-full flex items-center justify-center">
            {initials ? (
              <span className="text-ink-300 font-serif text-sm font-medium select-none">{initials}</span>
            ) : (
              <User className="w-5 h-5 text-ink-200" />
            )}
          </div>
        </foreignObject>
      )}

      {/* Border ring */}
      <circle
        cx={x} cy={y} r={R - borderWidth / 2}
        fill="none"
        stroke={borderColor}
        strokeWidth={borderWidth}
      />

      {/* Edit icon on hover (any node) */}
      {hovered && onEdit && (
        <g
          className="cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onEdit(character.id); }}
        >
          <circle cx={x + R - 2} cy={y - R + 2} r={10} fill="#c4a35a" stroke="white" strokeWidth={1.5} />
          <foreignObject x={x + R - 2 - 6} y={y - R + 2 - 6} width={12} height={12}>
            <div className="w-full h-full flex items-center justify-center">
              <Pencil className="w-[10px] h-[10px] text-white" />
            </div>
          </foreignObject>
        </g>
      )}

      {/* Name label */}
      <text
        x={x}
        y={y + R + 14}
        textAnchor="middle"
        className="fill-ink-500 text-[11px] font-serif"
        style={{ pointerEvents: 'none' }}
      >
        {name.length > 14 ? name.slice(0, 13) + '…' : name}
      </text>

      {/* Date label (birth - death) */}
      {dateLabel && (
        <text
          x={x}
          y={y + R + 26}
          textAnchor="middle"
          className="fill-ink-300 text-[9px]"
          style={{ pointerEvents: 'none', fontFamily: 'sans-serif' }}
        >
          {dateLabel.length > 20 ? dateLabel.slice(0, 19) + '…' : dateLabel}
        </text>
      )}

      {/* Badges */}
      {badges?.hiddenParents ? (
        <Badge x={x} y={y - R - BADGE_SIZE / 2 - 2} count={badges.hiddenParents} />
      ) : null}
      {badges?.hiddenSpouses ? (
        <Badge x={x + R + BADGE_SIZE / 2 + 2} y={y} count={badges.hiddenSpouses} />
      ) : null}
      {badges?.hiddenChildren ? (
        <Badge x={x} y={y + R + BADGE_SIZE / 2 + (dateLabel ? 32 : 22)} count={badges.hiddenChildren} />
      ) : null}
    </g>
  );
}

function Badge({ x, y, count }: { x: number; y: number; count: number }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      <circle cx={x} cy={y} r={BADGE_SIZE / 2} fill="#78716c" opacity={0.8} />
      <text
        x={x}
        y={y + BADGE_FONT / 3}
        textAnchor="middle"
        className="fill-white"
        style={{ fontSize: BADGE_FONT, fontFamily: 'sans-serif' }}
      >
        +{count}
      </text>
    </g>
  );
}
