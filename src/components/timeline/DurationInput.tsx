import type { EventDuration, DurationUnit } from '@/types';
import { cn } from '@/lib/utils';

export function DurationInput({
  value,
  onChange,
  compact = false,
}: {
  value: EventDuration;
  onChange: (d: EventDuration) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2', compact && 'gap-1')}>
      <input
        type="number"
        min={1}
        value={value.value}
        onChange={(e) => onChange({ ...value, value: Math.max(1, parseInt(e.target.value) || 1) })}
        className={cn('input-field w-20 text-sm', compact && 'w-16 text-xs py-1')}
      />
      <select
        value={value.unit}
        onChange={(e) => onChange({ ...value, unit: e.target.value as DurationUnit })}
        className={cn('input-field w-28 text-sm', compact && 'w-24 text-xs py-1')}
      >
        <option value="hours">heure(s)</option>
        <option value="days">jour(s)</option>
        <option value="months">mois</option>
        <option value="years">année(s)</option>
      </select>
    </div>
  );
}
