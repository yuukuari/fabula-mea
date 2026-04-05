import { useState, useRef, useEffect } from 'react';
import { Scissors, X } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import type { EventDuration, DurationUnit } from '@/types';
import { getEventStartDate, computeEventEndDate, formatDuration } from '@/lib/utils';

interface SplitDialogProps {
  eventId: string;
  onClose: () => void;
}

export function SplitDialog({ eventId, onClose }: SplitDialogProps) {
  const splitTimelineEvent = useBookStore((s) => s.splitTimelineEvent);
  const event = (useBookStore((s) => s.timelineEvents) ?? []).find((e) => e.id === eventId);

  if (!event) { onClose(); return null; }

  const originalStartMs = getEventStartDate(event.startDate, event.startTime).getTime();
  const originalEndMs = computeEventEndDate(event.startDate, event.startTime, event.duration).getTime();
  const totalMs = originalEndMs - originalStartMs;

  // Default to the event's own duration unit
  const defaultUnit: DurationUnit = event.duration.unit;

  // Number of discrete steps for a given unit
  const getStepsForUnit = (u: DurationUnit) => {
    if (u === 'hours') return Math.max(2, Math.round(totalMs / 3600000));
    if (u === 'days') return Math.max(2, Math.round(totalMs / 86400000));
    if (u === 'months') return Math.max(2, Math.round(totalMs / (30.44 * 86400000)));
    return Math.max(2, Math.round(totalMs / (365.25 * 86400000)));
  };

  const [parts, setParts] = useState(2);
  const [unit, setUnit] = useState<DurationUnit>(defaultUnit);
  // Split points as percentages (0-100), snapped to step grid
  const [splitPoints, setSplitPoints] = useState<number[]>(() => {
    const s = 100 / getStepsForUnit(defaultUnit);
    return [Math.round(50 / s) * s];
  });
  const barRef = useRef<HTMLDivElement>(null);
  const draggingIdx = useRef<number | null>(null);

  const totalSteps = getStepsForUnit(unit);
  const maxParts = Math.min(10, totalSteps); // can't have more parts than units
  const stepPct = 100 / totalSteps;

  // Snap a percentage to the nearest step boundary
  const snapToStep = (pct: number) => Math.round(pct / stepPct) * stepPct;

  // Generate evenly distributed split points for N parts
  const buildSplitPoints = (n: number, snap: (pct: number) => number) => {
    const points: number[] = [];
    for (let i = 1; i < n; i++) {
      points.push(snap((i / n) * 100));
    }
    return points;
  };

  // Reset split points when parts count changes
  const handlePartsChange = (newParts: number) => {
    const clamped = Math.max(2, Math.min(maxParts, newParts));
    setParts(clamped);
    setSplitPoints(buildSplitPoints(clamped, snapToStep));
  };

  // Re-snap split points when unit changes (may reduce max parts)
  const handleUnitChange = (newUnit: DurationUnit) => {
    setUnit(newUnit);
    const newTotalSteps = getStepsForUnit(newUnit);
    const newMax = Math.min(10, newTotalSteps);
    const newStepPct = 100 / newTotalSteps;
    const snap = (pct: number) => Math.round(pct / newStepPct) * newStepPct;
    const newParts = Math.min(parts, newMax);
    setParts(newParts);
    setSplitPoints(buildSplitPoints(newParts, snap));
  };

  // Compute segment durations from split points
  const sortedPoints = [...splitPoints].sort((a, b) => a - b);
  const boundaries = [0, ...sortedPoints, 100];
  const segments = boundaries.slice(0, -1).map((start, i) => {
    const end = boundaries[i + 1];
    const dMs = ((end - start) / 100) * totalMs;
    let value: number;
    if (unit === 'hours') value = Math.max(1, Math.round(dMs / 3600000));
    else if (unit === 'days') value = Math.max(1, Math.round(dMs / 86400000));
    else if (unit === 'months') value = Math.max(1, Math.round(dMs / (30.44 * 86400000)));
    else value = Math.max(1, Math.round(dMs / (365.25 * 86400000)));
    return { start, end, duration: { value, unit } as EventDuration };
  });

  // Drag handlers for split point dividers (snapped to steps)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingIdx.current === null || !barRef.current) return;
      e.preventDefault();
      const rect = barRef.current.getBoundingClientRect();
      let pct = ((e.clientX - rect.left) / rect.width) * 100;

      // Snap to step
      pct = snapToStep(pct);

      // Enforce ordering: must stay between neighbors (min 1 step apart)
      const idx = draggingIdx.current;
      const sorted = [...splitPoints];
      const minPct = idx > 0 ? sorted[idx - 1] + stepPct : stepPct;
      const maxPct = idx < sorted.length - 1 ? sorted[idx + 1] - stepPct : 100 - stepPct;
      pct = Math.max(minPct, Math.min(maxPct, pct));

      const newPoints = [...splitPoints];
      newPoints[idx] = pct;
      setSplitPoints(newPoints);
    };

    const handleMouseUp = () => {
      draggingIdx.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [splitPoints, stepPct]);

  const handleSplit = () => {
    splitTimelineEvent(eventId, splitPoints, unit);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-md mx-4 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display text-base font-bold text-ink-500">Découper l'événement</h4>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-sm text-ink-300 mb-4">
          « {event.title} » — {formatDuration(event.duration)}
        </p>

        {/* Parts count + unit selector */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={2}
              max={maxParts}
              value={parts}
              onChange={(e) => handlePartsChange(parseInt(e.target.value) || 2)}
              className="input-field w-16 text-sm text-center"
            />
            <span className="text-sm text-ink-300">parties</span>
          </div>
          <span className="text-ink-200">·</span>
          <select
            value={unit}
            onChange={(e) => handleUnitChange(e.target.value as DurationUnit)}
            className="input-field w-28 text-sm py-1.5"
          >
            <option value="hours">heure(s)</option>
            {totalMs >= 86400000 && <option value="days">jour(s)</option>}
            {totalMs >= 30.44 * 86400000 && <option value="months">mois</option>}
            {totalMs >= 365.25 * 86400000 && <option value="years">année(s)</option>}
          </select>
        </div>

        {/* Visual slider bar */}
        <div className="mb-2">
          <div ref={barRef} className="relative h-10 rounded-lg overflow-hidden select-none" style={{ background: '#e8e0d4' }}>
            {/* Colored segments */}
            {segments.map((seg, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 flex items-center justify-center"
                style={{
                  left: `${seg.start}%`,
                  width: `${seg.end - seg.start}%`,
                  backgroundColor: i % 2 === 0 ? '#6b705c' : '#7d8069',
                }}
              >
                <span className="text-white text-xs font-medium truncate px-1">
                  {formatDuration(seg.duration)}
                </span>
              </div>
            ))}

            {/* Draggable dividers */}
            {splitPoints.map((pct, idx) => (
              <div
                key={idx}
                className="absolute top-0 bottom-0 w-4 -ml-2 cursor-ew-resize z-10 flex items-center justify-center group/divider"
                style={{ left: `${pct}%` }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  draggingIdx.current = idx;
                }}
              >
                <div className="w-1 h-full bg-white shadow-md group-hover/divider:w-1.5 transition-all" />
              </div>
            ))}
          </div>
        </div>

        {/* Segment details */}
        <div className="flex gap-1 mb-4">
          {segments.map((seg, i) => (
            <div
              key={i}
              className="text-center text-[10px] text-ink-300"
              style={{ width: `${seg.end - seg.start}%` }}
            >
              <div className="w-1.5 h-1.5 rounded-full mx-auto mb-0.5 bg-ink-200" />
              {formatDuration(seg.duration)}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
          <button onClick={handleSplit} className="btn-primary text-sm">
            <Scissors className="w-4 h-4 mr-1" />
            Découper
          </button>
        </div>
      </div>
    </div>
  );
}
