import { User, MapPin, BookOpen, Unlink } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { useEncyclopediaStore } from '@/store/useEncyclopediaStore';
import type { TimelineEvent } from '@/types';
import { formatDuration, getChapterShortLabel } from '@/lib/utils';

interface TimelineTooltipProps {
  event: TimelineEvent;
  x: number;
  y: number;
}

export function TimelineTooltip({ event, x, y }: TimelineTooltipProps) {
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
          {event.description.length > 200 ? event.description.slice(0, 200) + '\u2026' : event.description}
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
