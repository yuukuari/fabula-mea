import { X } from 'lucide-react';

interface TagBadgeProps {
  name: string;
  color: string;
  onRemove?: () => void;
}

export function TagBadge({ name, color, onRemove }: TagBadgeProps) {
  return (
    <span
      className="badge gap-1"
      style={{ backgroundColor: color + '20', color }}
    >
      {name}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
