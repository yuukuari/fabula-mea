import { useRef } from 'react';
import type { TimelineEvent } from '@/types';
import { cn } from '@/lib/utils';

interface TimelineRowProps {
  label: string;
  italic?: boolean;
  events: TimelineEvent[];
  matchingEventIds: Set<string> | null;
  renderEventBlock: (event: TimelineEvent, dimmed: boolean, containerRef?: React.RefObject<HTMLDivElement | null>) => React.ReactNode;
}

export function TimelineRow({ label, italic, events, matchingEventIds, renderEventBlock }: TimelineRowProps) {
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
