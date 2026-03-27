import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Coffee, Timer, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type TimerMode = 'work' | 'break';

const WORK_MINUTES = 25;
const BREAK_MINUTES = 5;

export function FloatingPomodoro() {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<TimerMode>('work');
  const [secondsLeft, setSecondsLeft] = useState(WORK_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = mode === 'work' ? WORK_MINUTES * 60 : BREAK_MINUTES * 60;
  const progress = 1 - secondsLeft / totalSeconds;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeLabel = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const reset = useCallback(() => {
    setIsRunning(false);
    setSecondsLeft(mode === 'work' ? WORK_MINUTES * 60 : BREAK_MINUTES * 60);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [mode]);

  const switchMode = useCallback((newMode: TimerMode) => {
    setMode(newMode);
    setIsRunning(false);
    setSecondsLeft(newMode === 'work' ? WORK_MINUTES * 60 : BREAK_MINUTES * 60);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            if (mode === 'work') {
              setSessionsCompleted((s) => s + 1);
              try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczGiZwr+LYpFUbDSBes9/ep2AgEiRdq9XUmEwWBhJGkcvHklAhDQ0/h8S+hT0PAwE0b7u3eDgOBwIqa7OxcC0HBAA=').play(); } catch {}
              switchMode('break');
            } else {
              switchMode('work');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, mode, switchMode]);

  const accentColor = mode === 'work' ? '#8b2252' : '#16a34a';

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      {/* Expanded panel */}
      {expanded && (
        <div className="bg-parchment-50 rounded-2xl shadow-xl border border-parchment-200 w-64 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-parchment-200">
            <span className="font-display font-semibold text-sm text-ink-500 flex items-center gap-1.5">
              <Timer className="w-4 h-4 text-bordeaux-500" />
              Pomodoro
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-ink-200">{sessionsCompleted} session{sessionsCompleted !== 1 ? 's' : ''}</span>
              <button onClick={() => setExpanded(false)} className="p-1 rounded-lg hover:bg-parchment-200 text-ink-300 ml-1">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 flex flex-col items-center">
            {/* Mode toggle */}
            <div className="flex gap-1 mb-4 bg-parchment-100 rounded-lg p-1 w-full">
              <button
                onClick={() => switchMode('work')}
                className={cn(
                  'flex-1 py-1.5 rounded-md text-xs font-medium transition-colors',
                  mode === 'work' ? 'bg-bordeaux-500 text-white' : 'text-ink-300 hover:text-ink-500'
                )}
              >
                Travail
              </button>
              <button
                onClick={() => switchMode('break')}
                className={cn(
                  'flex-1 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1',
                  mode === 'break' ? 'bg-green-600 text-white' : 'text-ink-300 hover:text-ink-500'
                )}
              >
                <Coffee className="w-3 h-3" /> Pause
              </button>
            </div>

            {/* Timer circle */}
            <div className="relative w-32 h-32 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={radius} fill="none" stroke="#f5ede1" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r={radius}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-mono font-bold text-ink-500">{timeLabel}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className="w-11 h-11 rounded-full flex items-center justify-center transition-colors text-white"
                style={{ backgroundColor: accentColor }}
              >
                {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <button
                onClick={reset}
                className="w-11 h-11 rounded-full bg-parchment-200 hover:bg-parchment-300 flex items-center justify-center transition-colors text-ink-400"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating pill button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all',
          'border border-parchment-300 hover:shadow-xl active:scale-95',
          isRunning
            ? 'bg-bordeaux-500 text-white border-bordeaux-500'
            : 'bg-parchment-50 text-ink-500'
        )}
      >
        <Timer className="w-4 h-4 flex-shrink-0" />
        <span className="font-mono text-sm font-semibold">{timeLabel}</span>
        {isRunning && (
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        )}
      </button>
    </div>
  );
}
