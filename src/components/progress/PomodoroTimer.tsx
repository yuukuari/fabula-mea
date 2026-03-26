import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Coffee, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

type TimerMode = 'work' | 'break';

const WORK_MINUTES = 25;
const BREAK_MINUTES = 5;

export function PomodoroTimer() {
  const [mode, setMode] = useState<TimerMode>('work');
  const [secondsLeft, setSecondsLeft] = useState(WORK_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = mode === 'work' ? WORK_MINUTES * 60 : BREAK_MINUTES * 60;
  const progress = 1 - secondsLeft / totalSeconds;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

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
              // Play a subtle notification
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

  // SVG circle progress
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="card-fantasy p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold text-ink-500 flex items-center gap-2">
          <Timer className="w-5 h-5 text-bordeaux-500" />
          Pomodoro
        </h3>
        <span className="text-xs text-ink-200">{sessionsCompleted} session{sessionsCompleted !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex flex-col items-center">
        {/* Mode toggle */}
        <div className="flex gap-1 mb-4 bg-parchment-100 rounded-lg p-1">
          <button
            onClick={() => switchMode('work')}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              mode === 'work' ? 'bg-bordeaux-500 text-white' : 'text-ink-300 hover:text-ink-500'
            )}
          >
            Travail
          </button>
          <button
            onClick={() => switchMode('break')}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              mode === 'break' ? 'bg-green-600 text-white' : 'text-ink-300 hover:text-ink-500'
            )}
          >
            <Coffee className="w-4 h-4 inline mr-1" />
            Pause
          </button>
        </div>

        {/* Timer circle */}
        <div className="relative w-36 h-36 mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60" cy="60" r={radius}
              fill="none"
              stroke="#f5ede1"
              strokeWidth="8"
            />
            <circle
              cx="60" cy="60" r={radius}
              fill="none"
              stroke={mode === 'work' ? '#8b2252' : '#16a34a'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-mono font-bold text-ink-500">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
              mode === 'work'
                ? 'bg-bordeaux-500 hover:bg-bordeaux-600 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            )}
          >
            {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button
            onClick={reset}
            className="w-12 h-12 rounded-full bg-parchment-200 hover:bg-parchment-300 flex items-center justify-center transition-colors text-ink-400"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
