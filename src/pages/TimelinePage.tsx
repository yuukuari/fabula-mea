import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Plus, Scissors, User, MapPin, BookOpen, X, Unlink, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import { EmptyState } from '@/components/shared/EmptyState';
import type { TimelineEvent, EventDuration, DurationUnit } from '@/types';
import { cn, getEventStartDate, computeEventEndDate, formatDuration, getChapterShortLabel } from '@/lib/utils';
import { TimelineRow } from '@/components/timeline/TimelineRow';
import { TimelineTooltip } from '@/components/timeline/TimelineTooltip';
import { NewEventDialog } from '@/components/timeline/NewEventDialog';
import { EventEditorDialog } from '@/components/timeline/EventEditorDialog';
import { InsertEventDialog } from '@/components/timeline/InsertEventDialog';
import { SplitDialog } from '@/components/timeline/SplitDialog';

type TimelineViewMode = 'character' | 'place';

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
      const newStartDate = `${String(newStart.getFullYear()).padStart(4, '0')}-${String(newStart.getMonth() + 1).padStart(2, '0')}-${String(newStart.getDate()).padStart(2, '0')}`;

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
            <button onClick={handleCreateEvent} className="btn-primary text-sm mt-2 inline-flex items-center whitespace-nowrap">
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
            addTimelineEvent(data);
            setShowNewEventForm(false);
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
