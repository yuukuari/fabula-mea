import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, Square, Coffee, Clock, ChevronDown, PenLine, ExternalLink } from 'lucide-react';
import { cn, formatWritingTime } from '@/lib/utils';
import { useWritingTimer, TIMED_PRESETS } from '@/hooks/useWritingTimer';
import { useBookStore } from '@/store/useBookStore';
import type { WritingTimerMode } from '@/types';

const MODE_LABELS: Record<WritingTimerMode, { label: string; icon: typeof Clock }> = {
  free: { label: 'Session libre', icon: Clock },
  timed: { label: 'Minuteur', icon: Clock },
  pomodoro: { label: 'Pomodoro', icon: Clock },
};

export function FloatingWritingTimer() {
  const recordWritingMinutes = useBookStore((s) => s.recordWritingMinutes);
  const onRecord = useCallback((minutes: number) => {
    recordWritingMinutes(minutes);
  }, [recordWritingMinutes]);

  const timer = useWritingTimer(onRecord);
  const [expanded, setExpanded] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  const hasPiPSupport = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  // Close PiP when component unmounts
  useEffect(() => {
    return () => { pipWindow?.close(); };
  }, [pipWindow]);

  const openPiP = useCallback(async () => {
    if (!hasPiPSupport) return;
    try {
      const docPiP = (window as Window & { documentPictureInPicture?: { requestWindow: (opts: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
      if (!docPiP) return;
      const pip = await docPiP.requestWindow({
        width: 320,
        height: 180,
      });
      // Copy stylesheets
      [...document.styleSheets].forEach((sheet) => {
        try {
          const style = pip.document.createElement('style');
          style.textContent = [...sheet.cssRules].map((r) => r.cssText).join('\n');
          pip.document.head.appendChild(style);
        } catch { /* cross-origin, skip */ }
      });
      pip.document.body.className = 'bg-parchment-50';
      const container = pip.document.createElement('div');
      container.id = 'pip-root';
      pip.document.body.appendChild(container);
      setPipWindow(pip);
      setExpanded(false);
      pip.addEventListener('pagehide', () => setPipWindow(null));
    } catch { /* user cancelled or not supported */ }
  }, [hasPiPSupport]);

  const accentColor = timer.isRunning
    ? (timer.timerMode === 'pomodoro' && timer.pomodoroPhase === 'break' ? 'green' : 'bordeaux')
    : 'neutral';

  const ModeIcon = MODE_LABELS[timer.timerMode].icon;

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        {/* Expanded panel */}
        {expanded && (
          <div className="bg-parchment-50 rounded-2xl shadow-xl border border-parchment-200 w-80 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-parchment-200">
              <span className="font-display font-semibold text-sm text-ink-500 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-bordeaux-500" />
                Temps d'écriture
              </span>
              <div className="flex items-center gap-1">
                {hasPiPSupport && (
                  <button
                    onClick={openPiP}
                    className="p-1 rounded-lg hover:bg-parchment-200 text-ink-300"
                    title="Ouvrir en fenêtre flottante"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setExpanded(false)} className="p-1 rounded-lg hover:bg-parchment-200 text-ink-300">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            <TimerPanel timer={timer} />
          </div>
        )}

        {/* Floating pill button — icon only, time on hover */}
        <button
          onClick={() => { if (pipWindow) { pipWindow.focus(); } else setExpanded((v) => !v); }}
          aria-label={`Timer d'écriture${timer.isRunning ? ` — ${timer.displayLabel}` : ''}`}
          className={cn(
            'group flex items-center gap-0 rounded-full shadow-lg transition-all border',
            'hover:shadow-xl active:scale-95 overflow-hidden',
            accentColor === 'bordeaux'
              ? 'bg-bordeaux-500 text-white border-bordeaux-500'
              : accentColor === 'green'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-parchment-50 text-ink-500 border-parchment-300'
          )}
        >
          <div className="flex items-center justify-center w-10 h-10 shrink-0">
            <ModeIcon className="w-4 h-4" />
          </div>
          {/* Time label — slides in on hover only */}
          <div className="overflow-hidden transition-all duration-300 ease-in-out max-w-0 group-hover:max-w-32 opacity-0 group-hover:opacity-100">
            <span className="font-mono text-sm font-semibold whitespace-nowrap pr-3">
              {timer.displayLabel}
            </span>
          </div>
        </button>
      </div>

      {/* PiP portal */}
      {pipWindow && pipWindow.document.getElementById('pip-root') && createPortal(
        <PiPContent timer={timer} onClose={() => pipWindow.close()} />,
        pipWindow.document.getElementById('pip-root')!
      )}
    </>
  );
}

// ─── Timer Panel (shared between expanded & PiP) ───

function TimerPanel({ timer }: { timer: ReturnType<typeof useWritingTimer> }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - timer.progress);
  const accentHex = timer.timerMode === 'pomodoro' && timer.pomodoroPhase === 'break'
    ? '#16a34a'
    : '#8b2252';

  return (
    <div className="p-4 flex flex-col items-center">
      {/* Mode tabs */}
      <div className="flex gap-0.5 mb-4 bg-parchment-100 rounded-lg p-0.5 w-full">
        {(['free', 'timed', 'pomodoro'] as WritingTimerMode[]).map((m) => {
          const { label, icon: Icon } = MODE_LABELS[m];
          return (
            <button
              key={m}
              onClick={() => timer.setTimerMode(m)}
              disabled={timer.isRunning}
              className={cn(
                'flex-1 py-1.5 rounded-md text-[11px] font-medium transition-colors flex items-center justify-center gap-1',
                timer.timerMode === m
                  ? 'bg-bordeaux-500 text-white shadow-sm'
                  : 'text-ink-300 hover:text-ink-500',
                timer.isRunning && timer.timerMode !== m && 'opacity-40 cursor-not-allowed'
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Timed duration picker */}
      {timer.timerMode === 'timed' && !timer.isRunning && timer.displaySeconds === timer.timedDuration && (
        <div className="flex flex-wrap gap-1.5 mb-4 justify-center">
          {TIMED_PRESETS.map((p) => (
            <button
              key={p.seconds}
              onClick={() => timer.setTimedDuration(p.seconds)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                timer.timedDuration === p.seconds
                  ? 'bg-bordeaux-100 text-bordeaux-600'
                  : 'bg-parchment-100 text-ink-300 hover:text-ink-500'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Pomodoro phase */}
      {timer.timerMode === 'pomodoro' && (
        <div className="flex items-center gap-2 mb-3 text-xs">
          <button
            onClick={() => timer.setPomodoroPhase('work')}
            disabled={timer.isRunning}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full font-medium transition-colors',
              timer.pomodoroPhase === 'work' ? 'bg-bordeaux-100 text-bordeaux-600' : 'bg-parchment-100 text-ink-300',
              !timer.isRunning && timer.pomodoroPhase !== 'work' && 'hover:bg-parchment-200 cursor-pointer',
              timer.isRunning && 'cursor-default'
            )}
          >
            <PenLine className="w-3 h-3" /> Travail
          </button>
          <button
            onClick={() => timer.setPomodoroPhase('break')}
            disabled={timer.isRunning}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full font-medium transition-colors',
              timer.pomodoroPhase === 'break' ? 'bg-green-100 text-green-700' : 'bg-parchment-100 text-ink-300',
              !timer.isRunning && timer.pomodoroPhase !== 'break' && 'hover:bg-parchment-200 cursor-pointer',
              timer.isRunning && 'cursor-default'
            )}
          >
            <Coffee className="w-3 h-3" /> Pause
          </button>
          {timer.pomodoroSessions > 0 && (
            <span className="text-ink-200 ml-auto">{timer.pomodoroSessions} session{timer.pomodoroSessions > 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {/* Timer circle */}
      {timer.timerMode !== 'free' ? (
        <div className="relative w-28 h-28 mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="#f5ede1" strokeWidth="8" />
            <circle
              cx="60" cy="60" r={radius}
              fill="none"
              stroke={accentHex}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-mono font-bold text-ink-500">{timer.displayLabel}</span>
          </div>
        </div>
      ) : (
        <div className="mb-4 py-5">
          <span className="text-3xl font-mono font-bold text-ink-500">{timer.displayLabel}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 mb-4">
        {timer.isRunning ? (
          <button
            onClick={timer.pause}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-colors text-white"
            style={{ backgroundColor: accentHex }}
          >
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={timer.start}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-colors text-white"
            style={{ backgroundColor: accentHex }}
          >
            <Play className="w-4 h-4 ml-0.5" />
          </button>
        )}
        <button
          onClick={timer.stop}
          className="w-11 h-11 rounded-full bg-parchment-200 hover:bg-parchment-300 flex items-center justify-center transition-colors text-ink-400"
          title="Arrêter et réinitialiser"
        >
          <Square className="w-4 h-4" />
        </button>
      </div>

      {/* Today's writing time */}
      <div className="w-full pt-3 border-t border-parchment-200 text-center">
        <p className="text-xs text-ink-200">Temps d'écriture aujourd'hui</p>
        <p className="text-sm font-semibold text-ink-500 mt-0.5">
          {formatWritingTime(timer.writingMinutesToday)}
        </p>
      </div>
    </div>
  );
}

// ─── PiP Content (minimal) ───

function PiPContent({ timer, onClose }: { timer: ReturnType<typeof useWritingTimer>; onClose: () => void }) {
  const accentHex = timer.timerMode === 'pomodoro' && timer.pomodoroPhase === 'break'
    ? '#16a34a'
    : '#8b2252';

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-parchment-50 p-4 gap-3">
      {/* Mode label */}
      <div className="flex items-center gap-1.5 text-xs text-ink-300">
        {timer.timerMode === 'pomodoro' && (
          <span className={cn(
            'px-2 py-0.5 rounded-full font-medium',
            timer.pomodoroPhase === 'work' ? 'bg-bordeaux-100 text-bordeaux-600' : 'bg-green-100 text-green-700'
          )}>
            {timer.pomodoroPhase === 'work' ? 'Travail' : 'Pause'}
          </span>
        )}
        <span>{MODE_LABELS[timer.timerMode].label}</span>
      </div>

      {/* Time */}
      <span className="text-4xl font-mono font-bold text-ink-500">{timer.displayLabel}</span>

      {/* Controls */}
      <div className="flex gap-3">
        {timer.isRunning ? (
          <button
            onClick={timer.pause}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: accentHex }}
          >
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={timer.start}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: accentHex }}
          >
            <Play className="w-4 h-4 ml-0.5" />
          </button>
        )}
        <button
          onClick={timer.stop}
          className="w-10 h-10 rounded-full bg-parchment-200 hover:bg-parchment-300 flex items-center justify-center text-ink-400"
        >
          <Square className="w-4 h-4" />
        </button>
      </div>

      {/* Today */}
      <p className="text-xs text-ink-200 mt-1">
        Aujourd'hui : <span className="font-medium text-ink-400">{formatWritingTime(timer.writingMinutesToday)}</span>
      </p>
    </div>
  );
}
