import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Plus, Scissors, User, MapPin, BookOpen, X, Unlink, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { EmptyState } from '@/components/shared/EmptyState';
import type { TimelineEvent, EventDuration, DurationUnit } from '@/types';
import { cn, getEventStartDate, computeEventEndDate, formatDuration, getChapterShortLabel } from '@/lib/utils';

type TimelineViewMode = 'character' | 'place';

// ─── Duration Input Component ───

function DurationInput({
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

// ─── Main Timeline Page ───

export function TimelinePage() {
  const timelineEvents = useBookStore((s) => s.timelineEvents) ?? [];
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const { characters, places } = useEncyclopediaStore();

  const addTimelineEvent = useBookStore((s) => s.addTimelineEvent);
  const updateTimelineEvent = useBookStore((s) => s.updateTimelineEvent);
  const deleteTimelineEvent = useBookStore((s) => s.deleteTimelineEvent);
  const insertTimelineEvent = useBookStore((s) => s.insertTimelineEvent);
  const splitTimelineEvent = useBookStore((s) => s.splitTimelineEvent);

  const [viewMode, setViewMode] = useState<TimelineViewMode>('character');
  const [filterCharacterId, setFilterCharacterId] = useState<string | null>(null);
  const [filterPlaceId, setFilterPlaceId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [showNewEventForm, setShowNewEventForm] = useState(false);
  const [splittingEventId, setSplittingEventId] = useState<string | null>(null);
  const [insertingRef, setInsertingRef] = useState<{ refId: string; position: 'before' | 'after' } | null>(null);
  const [tooltip, setTooltip] = useState<{ event: TimelineEvent; x: number; y: number } | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  // ─── Zoom state ───
  const [zoom, setZoom] = useState(1);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z * 1.5, 100)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z / 1.5, 1)), []);
  const handleZoomReset = useCallback(() => setZoom(1), []);

  // Mouse wheel zoom on the timeline area (native listener to allow preventDefault on non-passive)
  useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const scrollLeft = el.scrollLeft;
      const cursorRatio = (scrollLeft + cursorX) / el.scrollWidth;

      const factor = e.deltaY < 0 ? 1.25 : 1 / 1.25;
      setZoom((prev) => {
        const next = Math.min(Math.max(prev * factor, 1), 100);
        requestAnimationFrame(() => {
          const newScrollWidth = el.scrollWidth;
          el.scrollLeft = cursorRatio * newScrollWidth - cursorX;
        });
        return next;
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [timelineEvents.length]); // re-attach when timeline appears/disappears

  // ─── Drag & Resize state ───
  type InteractionType = 'drag' | 'resize-left' | 'resize-right';
  const interactionRef = useRef<{
    type: InteractionType;
    eventId: string;
    startMouseX: number;
    originalStartMs: number;
    originalEndMs: number;
    containerRect: DOMRect;
    timelineMin: number;
    timelineDuration: number;
    stepMs: number; // snap interval based on event's duration unit
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ eventId: string; leftPercent: number; widthPercent: number } | null>(null);
  const didDragRef = useRef(false);

  // Snap a ms value to the nearest step
  const snapMs = (ms: number, step: number) => Math.round(ms / step) * step;

  // Global mouse handlers for drag/resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const info = interactionRef.current;
      if (!info) return;
      e.preventDefault();

      const deltaX = e.clientX - info.startMouseX;
      if (Math.abs(deltaX) > 3) didDragRef.current = true;
      const containerWidth = info.containerRect.width;
      const rawDeltaMs = (deltaX / containerWidth) * info.timelineDuration;
      // Snap delta to step increments
      const deltaMs = snapMs(rawDeltaMs, info.stepMs);

      let newStartMs: number;
      let newEndMs: number;

      if (info.type === 'drag') {
        newStartMs = info.originalStartMs + deltaMs;
        newEndMs = info.originalEndMs + deltaMs;
      } else if (info.type === 'resize-left') {
        newStartMs = Math.min(info.originalStartMs + deltaMs, info.originalEndMs - info.stepMs);
        newEndMs = info.originalEndMs;
      } else {
        newStartMs = info.originalStartMs;
        newEndMs = Math.max(info.originalEndMs + deltaMs, info.originalStartMs + info.stepMs);
      }

      const leftPercent = ((newStartMs - info.timelineMin) / info.timelineDuration) * 100;
      const widthPercent = ((newEndMs - newStartMs) / info.timelineDuration) * 100;
      setDragPreview({ eventId: info.eventId, leftPercent: Math.max(0, leftPercent), widthPercent });
    };

    const handleMouseUp = (e: MouseEvent) => {
      const info = interactionRef.current;
      if (!info) return;
      interactionRef.current = null;

      const deltaX = e.clientX - info.startMouseX;
      if (Math.abs(deltaX) < 2) {
        setDragPreview(null);
        return;
      }

      const containerWidth = info.containerRect.width;
      const rawDeltaMs = (deltaX / containerWidth) * info.timelineDuration;
      const deltaMs = snapMs(rawDeltaMs, info.stepMs);

      let newStartMs: number;
      let newEndMs: number;

      if (info.type === 'drag') {
        newStartMs = info.originalStartMs + deltaMs;
        newEndMs = info.originalEndMs + deltaMs;
      } else if (info.type === 'resize-left') {
        newStartMs = Math.min(info.originalStartMs + deltaMs, info.originalEndMs - info.stepMs);
        newEndMs = info.originalEndMs;
      } else {
        newStartMs = info.originalStartMs;
        newEndMs = Math.max(info.originalEndMs + deltaMs, info.originalStartMs + info.stepMs);
      }

      const evt = (useBookStore.getState().timelineEvents ?? []).find((ev) => ev.id === info.eventId);
      const originalUnit = evt?.duration.unit ?? 'days';
      // Hours-based events always need startTime; others only if they had one
      const needsTime = originalUnit === 'hours' || evt?.startTime !== undefined;

      // Convert new start to date string (local time)
      const newStart = new Date(newStartMs);
      const newStartDate = `${newStart.getFullYear()}-${String(newStart.getMonth() + 1).padStart(2, '0')}-${String(newStart.getDate()).padStart(2, '0')}`;

      // Duration in the original unit
      const durationMs = newEndMs - newStartMs;
      let newDuration: EventDuration;
      if (originalUnit === 'hours') {
        newDuration = { value: Math.max(1, Math.round(durationMs / 3600000)), unit: 'hours' };
      } else if (originalUnit === 'days') {
        newDuration = { value: Math.max(1, Math.round(durationMs / 86400000)), unit: 'days' };
      } else if (originalUnit === 'months') {
        newDuration = { value: Math.max(1, Math.round(durationMs / (30.44 * 86400000))), unit: 'months' };
      } else {
        newDuration = { value: Math.max(1, Math.round(durationMs / (365.25 * 86400000))), unit: 'years' };
      }

      const update: Partial<TimelineEvent> = {
        startDate: newStartDate,
        duration: newDuration,
      };

      if (needsTime) {
        update.startTime = `${String(newStart.getHours()).padStart(2, '0')}:${String(newStart.getMinutes()).padStart(2, '0')}`;
      }

      updateTimelineEvent(info.eventId, update);
      setDragPreview(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateTimelineEvent]);

  // Sort events by date, then by order
  const sortedEvents = useMemo(() =>
    [...timelineEvents].sort((a, b) => {
      const dateA = getEventStartDate(a.startDate, a.startTime).getTime();
      const dateB = getEventStartDate(b.startDate, b.startTime).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.order - b.order;
    }),
    [timelineEvents]
  );

  // Matching event ids (for soft highlight with filters)
  const matchingEventIds = useMemo(() => {
    const hasFilter = (viewMode === 'character' && filterPlaceId) || (viewMode === 'place' && filterCharacterId);
    if (!hasFilter) return null;
    let result = sortedEvents;
    if (viewMode === 'character' && filterPlaceId) {
      result = result.filter((e) => e.placeId === filterPlaceId);
    }
    if (viewMode === 'place' && filterCharacterId) {
      result = result.filter((e) => e.characterIds.includes(filterCharacterId!));
    }
    return new Set(result.map((e) => e.id));
  }, [sortedEvents, filterPlaceId, filterCharacterId, viewMode]);

  // Time range for visualization
  const timeRange = useMemo(() => {
    if (sortedEvents.length === 0) return null;
    const starts = sortedEvents.map((e) => getEventStartDate(e.startDate, e.startTime).getTime());
    const ends = sortedEvents.map((e) => computeEventEndDate(e.startDate, e.startTime, e.duration).getTime());
    const min = Math.min(...starts);
    const max = Math.max(...ends);
    // Add 5% padding on each side
    const padding = Math.max((max - min) * 0.05, 3600000); // min 1h padding
    return { min: min - padding, max: max + padding };
  }, [sortedEvents]);

  const totalDuration = timeRange ? timeRange.max - timeRange.min || 1 : 1;

  const startInteraction = useCallback((
    e: React.MouseEvent,
    type: InteractionType,
    event: TimelineEvent,
    containerEl: HTMLElement | null,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!containerEl || !timeRange) return;
    didDragRef.current = false;

    const startMs = getEventStartDate(event.startDate, event.startTime).getTime();
    const endMs = computeEventEndDate(event.startDate, event.startTime, event.duration).getTime();

    // Compute snap step based on the event's duration unit
    const unitStepMs: Record<string, number> = {
      hours: 3_600_000,
      days: 86_400_000,
      months: 30.44 * 86_400_000,
      years: 365.25 * 86_400_000,
    };
    const stepMs = unitStepMs[event.duration.unit] ?? 86_400_000;

    interactionRef.current = {
      type,
      eventId: event.id,
      startMouseX: e.clientX,
      originalStartMs: startMs,
      originalEndMs: endMs,
      containerRect: containerEl.getBoundingClientRect(),
      timelineMin: timeRange.min,
      timelineDuration: totalDuration,
      stepMs,
    };
  }, [timeRange, totalDuration]);

  // Characters in events
  const timelineCharacters = useMemo(() => {
    const charIds = new Set(sortedEvents.flatMap((e) => e.characterIds));
    return characters.filter((c) => charIds.has(c.id));
  }, [sortedEvents, characters]);

  // Places in events
  const timelinePlaces = useMemo(() => {
    const placeIds = new Set(sortedEvents.map((e) => e.placeId).filter(Boolean) as string[]);
    return places.filter((p) => placeIds.has(p.id));
  }, [sortedEvents, places]);

  // Time axis labels (more labels when zoomed in)
  const timeLabels = useMemo(() => {
    if (!timeRange) return [];
    const labels: { position: number; label: string }[] = [];
    const steps = Math.max(6, Math.round(6 * zoom));
    for (let i = 0; i <= steps; i++) {
      const t = timeRange.min + (totalDuration * i) / steps;
      labels.push({
        position: (i / steps) * 100,
        label: new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
      });
    }
    return labels;
  }, [timeRange, totalDuration, zoom]);

  // Helpers
  const getPosition = useCallback((event: TimelineEvent) => {
    if (!timeRange) return 0;
    const start = getEventStartDate(event.startDate, event.startTime).getTime();
    return ((start - timeRange.min) / totalDuration) * 100;
  }, [timeRange, totalDuration]);

  const getWidth = useCallback((event: TimelineEvent) => {
    if (!timeRange) return 2;
    const start = getEventStartDate(event.startDate, event.startTime).getTime();
    const end = computeEventEndDate(event.startDate, event.startTime, event.duration).getTime();
    return ((end - start) / totalDuration) * 100;
  }, [timeRange, totalDuration]);

  const getEventColor = useCallback((event: TimelineEvent) => {
    // If linked to a chapter, use the chapter's color
    if (event.chapterId) {
      const ch = chapters.find((c) => c.id === event.chapterId);
      if (ch) return ch.color;
    }
    return '#6b705c'; // default olive-gray for unlinked events
  }, [chapters]);

  const handleCreateEvent = () => {
    setShowNewEventForm(true);
  };

  const handleInsertEvent = (refId: string, position: 'before' | 'after') => {
    setInsertingRef({ refId, position });
  };

  // ─── Event block renderer ───
  const renderEventBlock = (event: TimelineEvent, dimmed: boolean = false, containerRef?: React.RefObject<HTMLDivElement | null>) => {
    const isDragging = dragPreview?.eventId === event.id;
    const left = isDragging ? dragPreview.leftPercent : getPosition(event);
    const width = isDragging ? dragPreview.widthPercent : getWidth(event);

    const isHovered = hoveredEventId === event.id && !isDragging;

    return (
      <div
        key={event.id}
        className={cn(
          'absolute top-1 bottom-1 rounded transition-all select-none',
          dimmed && 'opacity-20',
          isDragging ? 'cursor-grabbing z-20 shadow-lg ring-2 ring-white/50' : 'cursor-grab',
        )}
        style={{
          left: `${left}%`,
          width: `${width}%`,
          // minWidth: '28px',
          backgroundColor: getEventColor(event),
        }}
        onClick={() => {
          // Don't open editor if we just finished dragging
          if (didDragRef.current) {
            didDragRef.current = false;
            return;
          }
          setEditingEvent(event);
        }}
        onMouseDown={(e) => {
          // Only start drag on main button, not on action buttons
          if (e.button !== 0) return;
          const target = e.target as HTMLElement;
          if (target.closest('button') || target.closest('[data-resize-handle]')) return;
          startInteraction(e, 'drag', event, containerRef?.current ?? null);
          setTooltip(null);
          setHoveredEventId(null);
        }}
        onMouseEnter={(e) => {
          if (interactionRef.current) return;
          setHoveredEventId(event.id);
          const rect = e.currentTarget.getBoundingClientRect();
          setTooltip({ event, x: rect.left + rect.width / 2, y: rect.top });
        }}
        onMouseLeave={() => {
          if (!interactionRef.current) {
            setHoveredEventId(null);
            setTooltip(null);
          }
        }}
      >
        <span className="text-[11px] text-white px-2.5 truncate block leading-10 font-medium pointer-events-none">
          {event.title}
        </span>
        {/* Scene indicator */}
        {event.sceneId && (
          <div className="absolute top-0.5 right-2.5 w-3.5 h-3.5 rounded-full bg-white/30 flex items-center justify-center pointer-events-none" title="Lié à une scène">
            <BookOpen className="w-2.5 h-2.5 text-white" />
          </div>
        )}
        {/* Action buttons (visible on hover only) — stacked vertically on each side */}
        {isHovered && (
          <>
            {/* Left side: insert above, resize below */}
            <div className="absolute -left-3.5 top-0 bottom-0 flex flex-col items-center justify-center gap-1 z-20">
              <button
                className="w-5 h-5 rounded-full bg-bordeaux-500 text-white flex items-center justify-center
                           hover:bg-bordeaux-600 shadow-sm"
                onClick={(e) => { e.stopPropagation(); handleInsertEvent(event.id, 'before'); }}
                title="Insérer avant"
              >
                <Plus className="w-3 h-3" />
              </button>
              <div
                data-resize-handle
                className="w-5 h-5 rounded-full bg-white/90 shadow flex items-center justify-center
                           cursor-ew-resize hover:bg-white"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  startInteraction(e, 'resize-left', event, containerRef?.current ?? null);
                  setTooltip(null);
                }}
                title="Redimensionner"
              >
                <div className="flex gap-px">
                  <div className="w-[2px] h-2.5 rounded-full bg-ink-300" />
                  <div className="w-[2px] h-2.5 rounded-full bg-ink-300" />
                </div>
              </div>
            </div>

            {/* Right side: insert above, resize below */}
            <div className="absolute -right-3.5 top-0 bottom-0 flex flex-col items-center justify-center gap-1 z-20">
              <button
                className="w-5 h-5 rounded-full bg-bordeaux-500 text-white flex items-center justify-center
                           hover:bg-bordeaux-600 shadow-sm"
                onClick={(e) => { e.stopPropagation(); handleInsertEvent(event.id, 'after'); }}
                title="Insérer après"
              >
                <Plus className="w-3 h-3" />
              </button>
              <div
                data-resize-handle
                className="w-5 h-5 rounded-full bg-white/90 shadow flex items-center justify-center
                           cursor-ew-resize hover:bg-white"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  startInteraction(e, 'resize-right', event, containerRef?.current ?? null);
                  setTooltip(null);
                }}
                title="Redimensionner"
              >
                <div className="flex gap-px">
                  <div className="w-[2px] h-2.5 rounded-full bg-ink-300" />
                  <div className="w-[2px] h-2.5 rounded-full bg-ink-300" />
                </div>
              </div>
            </div>

            {/* Split button (bottom center) */}
            <button
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gold-500 text-white
                         flex items-center justify-center hover:bg-gold-600 z-20 shadow-sm"
              onClick={(e) => { e.stopPropagation(); setSplittingEventId(event.id); }}
              title="Découper"
            >
              <Scissors className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
    );
  };

  // ─── Empty state ───
  if (sortedEvents.length === 0 && !showNewEventForm) {
    return (
      <div className="page-container">
        <h2 className="section-title mb-6">Chronologie</h2>
        <EmptyState
          icon={Clock}
          title="Aucun événement"
          description="Commencez par créer les événements clés de votre histoire. Vous pourrez ensuite les rattacher à des chapitres et scènes."
          action={
            <button onClick={handleCreateEvent} className="btn-primary text-sm mt-2">
              <Plus className="w-4 h-4 mr-1.5" />
              Créer un événement
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title">Chronologie</h2>
        <button onClick={handleCreateEvent} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouvel événement</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* View mode toggle */}
        <div className="flex rounded-lg border border-parchment-300 overflow-hidden text-sm">
          <button
            onClick={() => { setViewMode('character'); setFilterCharacterId(null); }}
            className={cn(
              'px-3 py-1.5 flex items-center gap-1.5 transition-colors',
              viewMode === 'character' ? 'bg-bordeaux-500 text-white' : 'bg-parchment-50 text-ink-300 hover:bg-parchment-100'
            )}
          >
            <User className="w-3.5 h-3.5" /> Par personnage
          </button>
          <button
            onClick={() => { setViewMode('place'); setFilterPlaceId(null); }}
            className={cn(
              'px-3 py-1.5 flex items-center gap-1.5 transition-colors',
              viewMode === 'place' ? 'bg-bordeaux-500 text-white' : 'bg-parchment-50 text-ink-300 hover:bg-parchment-100'
            )}
          >
            <MapPin className="w-3.5 h-3.5" /> Par lieu
          </button>
        </div>

        {/* Cross filter */}
        {viewMode === 'character' && (
          <select
            value={filterPlaceId ?? ''}
            onChange={(e) => setFilterPlaceId(e.target.value || null)}
            className="input-field w-40 text-sm py-1"
          >
            <option value="">Tous les lieux</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {viewMode === 'place' && (
          <select
            value={filterCharacterId ?? ''}
            onChange={(e) => setFilterCharacterId(e.target.value || null)}
            className="input-field w-44 text-sm py-1"
          >
            <option value="">Tous les personnages</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Legend — chapters linked to events */}
      {(() => {
        const linkedChapterIds = new Set(sortedEvents.map((e) => e.chapterId).filter(Boolean) as string[]);
        const linkedChapters = chapters.filter((c) => linkedChapterIds.has(c.id)).sort((a, b) => a.number - b.number);
        if (linkedChapters.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-3 mb-4">
            {linkedChapters.map((ch) => (
              <div key={ch.id} className="flex items-center gap-1.5 text-xs text-ink-300">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: ch.color }} />
                {getChapterShortLabel(ch)}
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-xs text-ink-200">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#6b705c' }} />
              Non rattaché
            </div>
          </div>
        );
      })()}

      {/* Timeline visualization */}
      {sortedEvents.length > 0 && timeRange && (
        <div className="card-fantasy p-6">
          {/* Zoom controls */}
          <div className="flex items-center justify-end gap-1 mb-3">
            <span className="text-xs text-ink-200 mr-2">
              {zoom > 1 ? `×${zoom.toFixed(1)}` : 'Ajusté'}
            </span>
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              className="btn-ghost p-1.5 rounded disabled:opacity-30"
              title="Dézoomer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomReset}
              disabled={zoom === 1}
              className="btn-ghost p-1.5 rounded disabled:opacity-30"
              title="Ajuster à la fenêtre"
            >
              <Maximize className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 100}
              className="btn-ghost p-1.5 rounded disabled:opacity-30"
              title="Zoomer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable timeline area */}
          <div
            ref={timelineScrollRef}
            className="overflow-x-auto"
          >
            <div style={{ minWidth: `${zoom * 100}%` }}>
              {/* Time axis */}
              <div className="relative h-8 mb-2 ml-32">
                {timeLabels.map((tl, i) => (
                  <span
                    key={i}
                    className="absolute text-xs text-ink-200 -translate-x-1/2 whitespace-nowrap"
                    style={{ left: `${tl.position}%` }}
                  >
                    {tl.label}
                  </span>
                ))}
              </div>

              {/* Rows */}
              <div className="space-y-1 pb-4">
                {viewMode === 'character' ? (
                  <>
                    {timelineCharacters.map((char) => {
                      const charEvents = sortedEvents.filter((e) => e.characterIds.includes(char.id));
                      return <TimelineRow key={char.id} label={char.name} events={charEvents} matchingEventIds={matchingEventIds} renderEventBlock={renderEventBlock} />;
                    })}
                    {/* Events without characters */}
                    {(() => {
                      const noCharEvents = sortedEvents.filter((e) => e.characterIds.length === 0);
                      if (noCharEvents.length === 0) return null;
                      return <TimelineRow label="Sans personnage" italic events={noCharEvents} matchingEventIds={matchingEventIds} renderEventBlock={renderEventBlock} />;
                    })()}
                  </>
                ) : (
                  <>
                    {timelinePlaces.map((place) => {
                      const placeEvents = sortedEvents.filter((e) => e.placeId === place.id);
                      return <TimelineRow key={place.id} label={place.name} events={placeEvents} matchingEventIds={matchingEventIds} renderEventBlock={renderEventBlock} />;
                    })}
                    {/* Events without place */}
                    {(() => {
                      const noPlaceEvents = sortedEvents.filter((e) => !e.placeId);
                      if (noPlaceEvents.length === 0) return null;
                      return <TimelineRow label="Sans lieu" italic events={noPlaceEvents} matchingEventIds={matchingEventIds} renderEventBlock={renderEventBlock} />;
                    })()}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Hint */}
          {zoom === 1 && sortedEvents.length > 1 && (
            <p className="text-xs text-ink-200 mt-3 text-center">
              Ctrl + molette pour zoomer · Scroll horizontal pour naviguer
            </p>
          )}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && createPortal(
        <TimelineTooltip event={tooltip.event} x={tooltip.x} y={tooltip.y} />,
        document.body
      )}

      {/* New Event Form Dialog */}
      {showNewEventForm && (
        <NewEventDialog
          onClose={() => setShowNewEventForm(false)}
          onCreate={(data) => {
            const id = addTimelineEvent(data);
            setShowNewEventForm(false);
            // Open editor for the new event
            const newEvent = (useBookStore.getState().timelineEvents ?? []).find((e) => e.id === id);
            if (newEvent) setEditingEvent(newEvent);
          }}
        />
      )}

      {/* Event Editor Dialog */}
      {editingEvent && (
        <EventEditorDialog
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}

      {/* Split Dialog */}
      {splittingEventId && (
        <SplitDialog
          eventId={splittingEventId}
          onClose={() => setSplittingEventId(null)}
        />
      )}

      {/* Insert Event Dialog */}
      {insertingRef && (
        <InsertEventDialog
          refId={insertingRef.refId}
          position={insertingRef.position}
          onClose={() => setInsertingRef(null)}
        />
      )}
    </div>
  );
}

// ─── Timeline Row (with container ref for drag/resize) ───

function TimelineRow({
  label,
  italic,
  events,
  matchingEventIds,
  renderEventBlock,
}: {
  label: string;
  italic?: boolean;
  events: TimelineEvent[];
  matchingEventIds: Set<string> | null;
  renderEventBlock: (event: TimelineEvent, dimmed: boolean, containerRef?: React.RefObject<HTMLDivElement | null>) => React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex items-center gap-3">
      <div className="w-28 flex-shrink-0 text-right">
        <span className={cn('text-sm truncate block', italic ? 'italic text-ink-200' : 'font-medium text-ink-400')}>
          {label}
        </span>
      </div>
      <div ref={containerRef} className="flex-1 relative h-12 bg-parchment-100 rounded">
        {events.map((e) =>
          renderEventBlock(e, matchingEventIds !== null && !matchingEventIds.has(e.id), containerRef)
        )}
      </div>
    </div>
  );
}

// ─── Tooltip ───

function TimelineTooltip({ event, x, y }: { event: TimelineEvent; x: number; y: number }) {
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const { characters, places } = useEncyclopediaStore();

  const eventChars = event.characterIds.map((cid) => characters.find((c) => c.id === cid)).filter(Boolean);
  const place = event.placeId ? places.find((p) => p.id === event.placeId) : null;
  const linkedScene = event.sceneId ? scenes.find((s) => s.id === event.sceneId) : null;
  const chapter = event.chapterId ? chapters.find((c) => c.id === event.chapterId) : null;

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${Math.max(8, Math.min(x, window.innerWidth - 328))}px`,
    top: `${y - 8}px`,
    transform: 'translateY(-100%)',
    zIndex: 9999,
    minWidth: '200px',
    maxWidth: '320px',
    pointerEvents: 'none',
  };

  return (
    <div style={tooltipStyle} className="bg-ink-500 text-white text-xs rounded-lg p-2.5 shadow-lg">
      <div className="font-medium">{event.title}</div>
      {event.description && (
        <div className="text-white/80 mt-1 text-[11px] leading-relaxed border-t border-white/20 pt-1">
          {event.description.length > 200 ? event.description.slice(0, 200) + '…' : event.description}
        </div>
      )}
      <div className="text-white/70 mt-1">
        {new Date(event.startDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        {event.startTime && ` à ${event.startTime}`}
        {' · '}
        {formatDuration(event.duration)}
      </div>
      {eventChars.length > 0 && (
        <div className="text-white/70 flex items-center gap-1 mt-1">
          <User className="w-3 h-3 shrink-0" />{eventChars.map((c) => c!.name).join(', ')}
        </div>
      )}
      {place && (
        <div className="text-white/70 flex items-center gap-1 mt-0.5">
          <MapPin className="w-3 h-3 shrink-0" />{place.name}
        </div>
      )}
      {chapter && (
        <div className="text-gold-300 flex items-center gap-1 mt-1 border-t border-white/20 pt-1">
          <BookOpen className="w-3 h-3 shrink-0" />
          {getChapterShortLabel(chapter)}
          {linkedScene && <span> — {linkedScene.title || 'Sans titre'}</span>}
        </div>
      )}
      {!event.chapterId && (
        <div className="text-white/50 flex items-center gap-1 mt-1 border-t border-white/20 pt-1">
          <Unlink className="w-3 h-3 shrink-0" /> Non rattaché au manuscrit
        </div>
      )}
    </div>
  );
}

// ─── New Event Dialog ───

function NewEventDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: { title: string; startDate: string; startTime?: string; duration: EventDuration; description?: string; characterIds?: string[]; placeId?: string }) => void;
}) {
  const { characters, places } = useEncyclopediaStore();
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [includeTime, setIncludeTime] = useState(false);
  const [startTime, setStartTime] = useState('00:00');
  const [duration, setDuration] = useState<EventDuration>({ value: 1, unit: 'days' });
  const [description, setDescription] = useState('');
  const [characterIds, setCharacterIds] = useState<string[]>([]);
  const [placeId, setPlaceId] = useState<string>('');

  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const toggleCharacter = (id: string) => {
    setCharacterIds((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const isDirty = useCallback(() => {
    return !!(title || description || characterIds.length > 0 || placeId || includeTime ||
      duration.value !== 1 || duration.unit !== 'days');
  }, [title, description, characterIds, placeId, includeTime, duration]);

  const handleClose = () => {
    if (isDirty()) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      startDate,
      startTime: includeTime ? startTime : undefined,
      duration,
      description: description.trim() || undefined,
      characterIds: characterIds.length > 0 ? characterIds : undefined,
      placeId: placeId || undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
          <h3 className="font-display text-lg font-bold text-ink-500">Nouvel événement</h3>
          <button onClick={handleClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 pb-2 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="label-field">Titre *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field text-sm"
                placeholder="Ex: Arrivée à la capitale"
                autoFocus
              />
            </div>

            <div>
              <label className="label-field">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="textarea-field text-sm"
                rows={2}
                placeholder="Description optionnelle..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Date de début *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="label-field flex items-center gap-2">
                  Heure
                  <input
                    type="checkbox"
                    checked={includeTime}
                    onChange={(e) => setIncludeTime(e.target.checked)}
                    className="rounded border-parchment-300"
                  />
                </label>
                {includeTime ? (
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="input-field text-sm"
                  />
                ) : (
                  <div className="input-field text-sm text-ink-200 bg-parchment-100 cursor-not-allowed">—</div>
                )}
              </div>
            </div>

            <div>
              <label className="label-field">Durée *</label>
              <DurationInput value={duration} onChange={setDuration} />
            </div>

            {/* Characters */}
            {characters.length > 0 && (
              <div>
                <label className="label-field">Personnages</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {characters.map((c) => {
                    const selected = characterIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCharacter(c.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                          selected
                            ? 'bg-bordeaux-500 text-white border-bordeaux-500'
                            : 'bg-parchment-100 text-ink-300 border-parchment-300 hover:border-bordeaux-300 hover:text-ink-400'
                        )}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Place */}
            {places.length > 0 && (
              <div>
                <label className="label-field">Lieu</label>
                <select
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">Aucun lieu</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 p-6 pt-4 border-t border-parchment-200 flex-shrink-0">
            <button type="button" onClick={handleClose} className="btn-secondary text-sm">Annuler</button>
            <button type="submit" className="btn-primary text-sm" disabled={!title.trim()}>
              Créer
            </button>
          </div>
        </form>
      </div>

      {showUnsavedConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUnsavedConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-display text-lg font-bold text-ink-500 mb-2">Modifications non enregistrées</h3>
            <p className="text-sm text-ink-300 mb-6">Vous avez des modifications non enregistrées. Que souhaitez-vous faire ?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowUnsavedConfirm(false)} className="btn-secondary text-sm">Annuler</button>
              <button onClick={() => { setShowUnsavedConfirm(false); onClose(); }} className="px-4 py-2 rounded-lg text-sm font-medium border border-ink-200 text-ink-400 hover:bg-parchment-100 transition-colors">Quitter</button>
              <button onClick={() => { setShowUnsavedConfirm(false); handleSave(); }} className="btn-primary text-sm" disabled={!title.trim()}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Event Editor Dialog ───

function EventEditorDialog({ event, onClose }: { event: TimelineEvent; onClose: () => void }) {
  const { characters, places } = useEncyclopediaStore();
  const chapters = useBookStore((s) => s.chapters);
  const scenes = useBookStore((s) => s.scenes);
  const updateTimelineEvent = useBookStore((s) => s.updateTimelineEvent);
  const deleteTimelineEvent = useBookStore((s) => s.deleteTimelineEvent);
  const unlinkEventFromScene = useBookStore((s) => s.unlinkEventFromScene);
  const linkEventToScene = useBookStore((s) => s.linkEventToScene);
  const convertEventToChapter = useBookStore((s) => s.convertEventToChapter);
  const createSceneForEvent = useBookStore((s) => s.createSceneForEvent);

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? '');
  const [startDate, setStartDate] = useState(event.startDate);
  const [includeTime, setIncludeTime] = useState(!!event.startTime);
  const [startTime, setStartTime] = useState(event.startTime ?? '00:00');
  const [duration, setDuration] = useState<EventDuration>(event.duration);
  const [characterIds, setCharacterIds] = useState(event.characterIds);
  const [placeId, setPlaceId] = useState(event.placeId ?? '');
  const [selectedChapterId, setSelectedChapterId] = useState(event.chapterId ?? '');
  const [selectedSceneId, setSelectedSceneId] = useState(event.sceneId ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const normalChapters = chapters
    .filter((c) => (c.type ?? 'chapter') === 'chapter')
    .sort((a, b) => a.number - b.number);

  // Scenes available for linking (from selected chapter)
  const availableScenes = selectedChapterId
    ? scenes.filter((s) => s.chapterId === selectedChapterId)
    : [];

  const linkedScene = event.sceneId ? scenes.find((s) => s.id === event.sceneId) : null;
  const linkedChapter = event.chapterId ? chapters.find((c) => c.id === event.chapterId) : null;

  const isDirty = useCallback(() => {
    return (
      title !== event.title ||
      description !== (event.description ?? '') ||
      startDate !== event.startDate ||
      includeTime !== !!event.startTime ||
      startTime !== (event.startTime ?? '00:00') ||
      JSON.stringify(duration) !== JSON.stringify(event.duration) ||
      JSON.stringify(characterIds) !== JSON.stringify(event.characterIds) ||
      placeId !== (event.placeId ?? '') ||
      selectedChapterId !== (event.chapterId ?? '') ||
      selectedSceneId !== (event.sceneId ?? '')
    );
  }, [title, description, startDate, includeTime, startTime, duration, characterIds, placeId, selectedChapterId, selectedSceneId, event]);

  const handleClose = () => {
    if (isDirty()) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    updateTimelineEvent(event.id, {
      title: title.trim() || event.title,
      description: description.trim() || undefined,
      startDate,
      startTime: includeTime ? startTime : undefined,
      duration,
      characterIds,
      placeId: placeId || undefined,
      chapterId: selectedChapterId || undefined,
      sceneId: (selectedChapterId && selectedSceneId) ? selectedSceneId : undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    deleteTimelineEvent(event.id);
    onClose();
  };

  const handleCreateChapter = () => {
    const chapterId = convertEventToChapter(event.id);
    if (chapterId) setSelectedChapterId(chapterId);
  };

  const handleCreateScene = () => {
    if (!selectedChapterId) return;
    const sceneId = createSceneForEvent(event.id, selectedChapterId);
    if (sceneId) setSelectedSceneId(sceneId);
  };

  const handleChapterChange = (newChapterId: string) => {
    setSelectedChapterId(newChapterId);
    if (newChapterId !== selectedChapterId) {
      setSelectedSceneId('');
    }
  };

  const toggleCharacter = (id: string) => {
    setCharacterIds((ids) => ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
          <h3 className="font-display text-lg font-bold text-ink-500">Modifier l'événement</h3>
          <button onClick={handleClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Title */}
          <div>
            <label className="label-field">Titre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="label-field">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="textarea-field text-sm"
              rows={2}
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Date de début</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="label-field flex items-center gap-2">
                Heure
                <input
                  type="checkbox"
                  checked={includeTime}
                  onChange={(e) => setIncludeTime(e.target.checked)}
                  className="rounded border-parchment-300"
                />
              </label>
              {includeTime ? (
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input-field text-sm"
                />
              ) : (
                <div className="input-field text-sm text-ink-200 bg-parchment-100 cursor-not-allowed">—</div>
              )}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="label-field">Durée</label>
            <DurationInput value={duration} onChange={setDuration} />
          </div>

          {/* Characters */}
          <div>
            <label className="label-field">Personnages</label>
            {characters.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {characters.map((c) => {
                  const selected = characterIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCharacter(c.id)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                        selected
                          ? 'bg-bordeaux-500 text-white border-bordeaux-500'
                          : 'bg-parchment-100 text-ink-300 border-parchment-300 hover:border-bordeaux-300 hover:text-ink-400'
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-ink-200 italic">Aucun personnage créé</p>
            )}
          </div>

          {/* Place */}
          <div>
            <label className="label-field">Lieu</label>
            <select
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">Aucun</option>
              {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Manuscript link: Chapter + Scene */}
          <div className="border-t border-parchment-200 pt-4">
            <label className="label-field flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Rattachement au manuscrit
            </label>

            <div className="space-y-3">
              {/* Chapter select */}
              <div>
                <label className="text-xs text-ink-300 mb-1 block">Chapitre</label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedChapterId}
                    onChange={(e) => handleChapterChange(e.target.value)}
                    className="input-field text-sm flex-1"
                  >
                    <option value="">Aucun chapitre</option>
                    {normalChapters.map((c) => (
                      <option key={c.id} value={c.id}>{getChapterShortLabel(c)}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleCreateChapter}
                    className="btn-secondary text-xs flex items-center gap-1 whitespace-nowrap"
                    title="Créer un nouveau chapitre"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Chapitre
                  </button>
                </div>
              </div>

              {/* Scene select (only if chapter selected) */}
              {selectedChapterId && (
                <div>
                  <label className="text-xs text-ink-300 mb-1 block">Scène (optionnel)</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedSceneId}
                      onChange={(e) => setSelectedSceneId(e.target.value)}
                      className="input-field text-sm flex-1"
                    >
                      <option value="">Aucune scène</option>
                      {availableScenes.map((s) => (
                        <option key={s.id} value={s.id}>{s.title || 'Sans titre'}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleCreateScene}
                      className="btn-secondary text-xs flex items-center gap-1 whitespace-nowrap"
                      title="Créer une nouvelle scène dans ce chapitre"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Scène
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 pt-4 border-t border-parchment-200 flex-shrink-0">
          <div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-bordeaux-500">Supprimer ?</span>
                <button onClick={handleDelete} className="text-sm text-bordeaux-600 font-medium hover:underline">Oui</button>
                <button onClick={() => setConfirmDelete(false)} className="text-sm text-ink-300 hover:underline">Non</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-bordeaux-400 hover:text-bordeaux-600 transition-colors"
              >
                Supprimer
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleClose} className="btn-secondary text-sm">Annuler</button>
            <button onClick={handleSave} className="btn-primary text-sm">Enregistrer</button>
          </div>
        </div>
      </div>

      {showUnsavedConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUnsavedConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="font-display text-lg font-bold text-ink-500 mb-2">Modifications non enregistrées</h3>
            <p className="text-sm text-ink-300 mb-6">Vous avez des modifications non enregistrées. Que souhaitez-vous faire ?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowUnsavedConfirm(false)} className="btn-secondary text-sm">Annuler</button>
              <button onClick={() => { setShowUnsavedConfirm(false); onClose(); }} className="px-4 py-2 rounded-lg text-sm font-medium border border-ink-200 text-ink-400 hover:bg-parchment-100 transition-colors">Quitter</button>
              <button onClick={() => { setShowUnsavedConfirm(false); handleSave(); }} className="btn-primary text-sm">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Insert Event Dialog ───

function InsertEventDialog({
  refId,
  position,
  onClose,
}: {
  refId: string;
  position: 'before' | 'after';
  onClose: () => void;
}) {
  const { characters, places } = useEncyclopediaStore();
  const insertTimelineEvent = useBookStore((s) => s.insertTimelineEvent);
  const refEvent = (useBookStore((s) => s.timelineEvents) ?? []).find((e) => e.id === refId);

  const [title, setTitle] = useState(refEvent?.title ?? 'Nouvel événement');
  const [description, setDescription] = useState(refEvent?.description ?? '');
  const [duration, setDuration] = useState<EventDuration>({ value: 1, unit: refEvent?.duration.unit ?? 'days' });
  const [characterIds, setCharacterIds] = useState(refEvent?.characterIds ?? []);
  const [placeId, setPlaceId] = useState(refEvent?.placeId ?? '');

  if (!refEvent) { onClose(); return null; }

  const toggleCharacter = (id: string) => {
    setCharacterIds((ids) => ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]);
  };

  const handleCreate = () => {
    insertTimelineEvent(refId, position, {
      title: title.trim() || 'Nouvel événement',
      description: description.trim() || undefined,
      duration,
      characterIds,
      placeId: placeId || undefined,
      chapterId: refEvent.chapterId, // copied, no scene
    });
    onClose();
  };

  const label = position === 'before' ? 'avant' : 'après';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-parchment-50 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-ink-500">
            Insérer {label} « {refEvent.title} »
          </h3>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label-field">Titre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="label-field">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="textarea-field text-sm"
              rows={2}
            />
          </div>

          <div>
            <label className="label-field">Durée</label>
            <DurationInput value={duration} onChange={setDuration} />
            <p className="text-xs text-ink-200 mt-1">
              {position === 'after'
                ? `Cet événement commencera juste après « ${refEvent.title} ».`
                : `Cet événement se terminera juste avant « ${refEvent.title} ».`
              }
            </p>
          </div>

          {/* Characters */}
          {characters.length > 0 && (
            <div>
              <label className="label-field">Personnages</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {characters.map((c) => {
                  const selected = characterIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCharacter(c.id)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                        selected
                          ? 'bg-bordeaux-500 text-white border-bordeaux-500'
                          : 'bg-parchment-100 text-ink-300 border-parchment-300 hover:border-bordeaux-300 hover:text-ink-400'
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Place */}
          {places.length > 0 && (
            <div>
              <label className="label-field">Lieu</label>
              <select
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
                className="input-field text-sm"
              >
                <option value="">Aucun</option>
                {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Chapter info (read-only) */}
          {refEvent.chapterId && (() => {
            const chapters = useBookStore.getState().chapters;
            const ch = chapters.find((c) => c.id === refEvent.chapterId);
            return ch ? (
              <div className="text-xs text-ink-200 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Chapitre : <span className="font-medium" style={{ color: ch.color }}>{getChapterShortLabel(ch)}</span>
              </div>
            ) : null;
          })()}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
            <button onClick={handleCreate} className="btn-primary text-sm">
              <Plus className="w-4 h-4 mr-1" />
              Insérer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Split Dialog ───

function SplitDialog({ eventId, onClose }: { eventId: string; onClose: () => void }) {
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
