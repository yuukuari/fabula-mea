import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Coffee, Timer, ChevronDown, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';

type TimerMode = 'work' | 'break';

const WORK_MINUTES = 25;
const BREAK_MINUTES = 5;
const STORAGE_KEY = 'fabula-mea-pomodoro';

interface PomodoroState {
  mode: TimerMode;
  sessionsCompleted: number;
  isRunning: boolean;
  /** When running: timestamp (ms) when the timer should reach 0 */
  endsAt: number | null;
  /** When paused: seconds remaining */
  secondsLeft: number;
}

function loadState(): PomodoroState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state: PomodoroState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function initState(): { mode: TimerMode; secondsLeft: number; isRunning: boolean; sessionsCompleted: number } {
  const saved = loadState();
  if (!saved) return { mode: 'work', secondsLeft: WORK_MINUTES * 60, isRunning: false, sessionsCompleted: 0 };

  if (saved.isRunning && saved.endsAt) {
    const remaining = Math.round((saved.endsAt - Date.now()) / 1000);
    if (remaining > 0) {
      return { mode: saved.mode, secondsLeft: remaining, isRunning: true, sessionsCompleted: saved.sessionsCompleted };
    }
    // Timer expired while page was closed — advance to next mode
    const nextMode: TimerMode = saved.mode === 'work' ? 'break' : 'work';
    const sessions = saved.mode === 'work' ? saved.sessionsCompleted + 1 : saved.sessionsCompleted;
    return { mode: nextMode, secondsLeft: nextMode === 'work' ? WORK_MINUTES * 60 : BREAK_MINUTES * 60, isRunning: false, sessionsCompleted: sessions };
  }

  return { mode: saved.mode, secondsLeft: saved.secondsLeft, isRunning: false, sessionsCompleted: saved.sessionsCompleted };
}

/** Play a short synthesized alarm. Work end = bright triple chime, break end = gentle double tone. */
function playAlarm(type: 'work' | 'break') {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (type === 'work') {
      // Triple chime — bright, celebratory
      [0, 0.2, 0.4].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = [660, 880, 1100][i];
        g.gain.setValueAtTime(0.3, ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
        osc.connect(g).connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.4);
      });
    } else {
      // Double soft tone — gentle nudge to resume work
      [0, 0.25].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = [440, 523][i];
        g.gain.setValueAtTime(0.25, ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.5);
        osc.connect(g).connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.5);
      });
    }

    // Clean up context after sounds finish
    setTimeout(() => ctx.close(), 2000);
  } catch { /* Audio not available */ }
}

export function FloatingPomodoro() {
  const initial = useRef(initState()).current;
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<TimerMode>(initial.mode);
  const [secondsLeft, setSecondsLeft] = useState(initial.secondsLeft);
  const [isRunning, setIsRunning] = useState(initial.isRunning);
  const [sessionsCompleted, setSessionsCompleted] = useState(initial.sessionsCompleted);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist state on every change
  useEffect(() => {
    const state: PomodoroState = {
      mode,
      sessionsCompleted,
      isRunning,
      endsAt: isRunning ? Date.now() + secondsLeft * 1000 : null,
      secondsLeft,
    };
    saveState(state);
  }, [mode, sessionsCompleted, isRunning, secondsLeft]);

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
              playAlarm('work');
              switchMode('break');
            } else {
              playAlarm('break');
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
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
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
                  'flex-1 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1',
                  mode === 'work' ? 'bg-bordeaux-500 text-white' : 'text-ink-300 hover:text-ink-500'
                )}
              >
                <PenLine className="w-3 h-3" /> Travail
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
          isRunning && mode === 'work'
            ? 'bg-bordeaux-500 text-white border-bordeaux-500'
            : isRunning && mode === 'break'
              ? 'bg-green-600 text-white border-green-600'
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
