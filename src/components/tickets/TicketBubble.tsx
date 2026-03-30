import { useState } from 'react';
import { MessageSquarePlus, Plus, List, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface TicketBubbleProps {
  onCreateTicket: () => void;
}

export function TicketBubble({ onCreateTicket }: TicketBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-6 left-[17.5rem] z-40 hidden md:flex flex-col items-start gap-2">
      {/* Expanded menu */}
      {expanded && (
        <div className="bg-white rounded-lg shadow-lg border border-parchment-300 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 mb-1">
          <button
            onClick={() => {
              onCreateTicket();
              setExpanded(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-ink-400 hover:bg-parchment-100 transition-colors"
          >
            <Plus className="w-4 h-4 text-bordeaux-500" />
            <span>Nouveau ticket</span>
          </button>
          <div className="border-t border-parchment-200" />
          <button
            onClick={() => {
              navigate('/tickets');
              setExpanded(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-ink-400 hover:bg-parchment-100 transition-colors"
          >
            <List className="w-4 h-4 text-blue-500" />
            <span>Voir les tickets</span>
          </button>
        </div>
      )}

      {/* Bubble button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200',
          expanded
            ? 'bg-ink-400 text-white hover:bg-ink-500'
            : 'bg-bordeaux-500 text-white hover:bg-bordeaux-600 hover:scale-105'
        )}
        title="Tickets & retours"
      >
        {expanded ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageSquarePlus className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
