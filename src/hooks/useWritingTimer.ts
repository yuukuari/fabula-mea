import { useState, useEffect, useRef, useCallback } from 'react';
import type { WritingTimerMode } from '@/types';

const STORAGE_KEY = 'fabula-mea-writing-timer';
const OLD_STORAGE_KEY = 'fabula-mea-pomodoro';

const POMODORO_WORK = 25 * 60;
const POMODORO_BREAK = 5 * 60;

export const TIMED_PRESETS = [
  { label: '15 min', seconds: 15 * 60 },
  { label: '30 min', seconds: 30 * 60 },
  { label: '45 min', seconds: 45 * 60 },
  { label: '1h', seconds: 60 * 60 },
  { label: '1h30', seconds: 90 * 60 },
  { label: '2h', seconds: 120 * 60 },
];

// ─── Persisted state ───

interface TimerState {
  timerMode: WritingTimerMode;
  // Free mode (count up)
  freeElapsed: number; // seconds accumulated
  // Timed mode (countdown)
  timedDuration: number; // chosen total duration in seconds
  timedSecondsLeft: number;
  // Pomodoro
  pomodoroPhase: 'work' | 'break';
  pomodoroSecondsLeft: number;
  pomodoroSessions: number;
  // Common
  isRunning: boolean;
  endsAt: number | null; // timestamp when countdown reaches 0 (timed/pomodoro)
  startedAt: number | null; // timestamp when current run segment started (free mode)
  // Writing time tracking
  accumulatedWritingSeconds: number;
  accumulatedDate: string; // YYYY-MM-DD — resets on date change
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function defaultState(): TimerState {
  return {
    timerMode: 'free',
    freeElapsed: 0,
    timedDuration: 30 * 60,
    timedSecondsLeft: 30 * 60,
    pomodoroPhase: 'work',
    pomodoroSecondsLeft: POMODORO_WORK,
    pomodoroSessions: 0,
    isRunning: false,
    endsAt: null,
    startedAt: null,
    accumulatedWritingSeconds: 0,
    accumulatedDate: todayStr(),
  };
}

function loadState(): TimerState {
  // Migrate from old pomodoro format
  try {
    const old = localStorage.getItem(OLD_STORAGE_KEY);
    if (old) {
      const parsed = JSON.parse(old);
      localStorage.removeItem(OLD_STORAGE_KEY);
      const migrated: TimerState = {
        ...defaultState(),
        timerMode: 'pomodoro',
        pomodoroPhase: parsed.mode === 'break' ? 'break' : 'work',
        pomodoroSecondsLeft: parsed.secondsLeft ?? POMODORO_WORK,
        pomodoroSessions: parsed.sessionsCompleted ?? 0,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch { /* ignore */ }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const saved: TimerState = JSON.parse(raw);

    // Reset accumulated if date changed
    if (saved.accumulatedDate !== todayStr()) {
      saved.accumulatedWritingSeconds = 0;
      saved.accumulatedDate = todayStr();
    }

    // Recover running state
    if (saved.isRunning) {
      if (saved.timerMode === 'free' && saved.startedAt) {
        // Add elapsed since startedAt
        const extraSeconds = Math.round((Date.now() - saved.startedAt) / 1000);
        saved.freeElapsed += extraSeconds;
        saved.accumulatedWritingSeconds += extraSeconds;
        saved.startedAt = Date.now();
      } else if (saved.endsAt) {
        const remaining = Math.round((saved.endsAt - Date.now()) / 1000);
        if (remaining > 0) {
          if (saved.timerMode === 'timed') saved.timedSecondsLeft = remaining;
          else saved.pomodoroSecondsLeft = remaining;
        } else {
          // Timer expired while away
          const overSeconds = Math.round((Date.now() - saved.endsAt) / 1000);
          if (saved.timerMode === 'timed') {
            // Add the full duration as writing time
            saved.accumulatedWritingSeconds += saved.timedSecondsLeft;
            saved.timedSecondsLeft = 0;
            saved.isRunning = false;
            saved.endsAt = null;
          } else {
            // Pomodoro: advance phase
            if (saved.pomodoroPhase === 'work') {
              saved.accumulatedWritingSeconds += saved.pomodoroSecondsLeft;
              saved.pomodoroSessions += 1;
              saved.pomodoroPhase = 'break';
              saved.pomodoroSecondsLeft = POMODORO_BREAK;
            } else {
              saved.pomodoroPhase = 'work';
              saved.pomodoroSecondsLeft = POMODORO_WORK;
            }
            saved.isRunning = false;
            saved.endsAt = null;
          }
        }
      }
    }

    return saved;
  } catch {
    return defaultState();
  }
}

function saveState(state: TimerState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── Alarm ───

export function playAlarm(type: 'work' | 'break' | 'timed') {
  try {
    const ctx = new AudioContext();
    if (type === 'timed' || type === 'work') {
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
    setTimeout(() => ctx.close(), 2000);
  } catch { /* Audio not available */ }
}

// ─── Hook ───

export interface WritingTimerAPI {
  timerMode: WritingTimerMode;
  setTimerMode: (mode: WritingTimerMode) => void;
  isRunning: boolean;
  // Display
  displaySeconds: number; // seconds to show (up for free, down for timed/pomodoro)
  displayLabel: string; // formatted MM:SS or HH:MM:SS
  progress: number; // 0-1 (only meaningful for countdown modes)
  pomodoroPhase: 'work' | 'break';
  pomodoroSessions: number;
  timedDuration: number;
  setTimedDuration: (seconds: number) => void;
  setPomodoroPhase: (phase: 'work' | 'break') => void;
  // Controls
  start: () => void;
  pause: () => void;
  stop: () => void; // stops and resets current mode
  // Time tracking
  writingMinutesToday: number;
}

export function useWritingTimer(onRecordMinutes?: (minutes: number) => void): WritingTimerAPI {
  const initial = useRef(loadState()).current;
  const [timerMode, setTimerModeRaw] = useState<WritingTimerMode>(initial.timerMode);
  const [isRunning, setIsRunning] = useState(initial.isRunning);

  // Free
  const [freeElapsed, setFreeElapsed] = useState(initial.freeElapsed);
  // Timed
  const [timedDuration, setTimedDuration] = useState(initial.timedDuration);
  const [timedSecondsLeft, setTimedSecondsLeft] = useState(initial.timedSecondsLeft);
  // Pomodoro
  const [pomodoroPhase, setPomodoroPhase] = useState<'work' | 'break'>(initial.pomodoroPhase);
  const [pomodoroSecondsLeft, setPomodoroSecondsLeft] = useState(initial.pomodoroSecondsLeft);
  const [pomodoroSessions, setPomodoroSessions] = useState(initial.pomodoroSessions);
  // Writing time
  const [accWritingSeconds, setAccWritingSeconds] = useState(initial.accumulatedWritingSeconds);
  const accDateRef = useRef(initial.accumulatedDate);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRecordedRef = useRef(Math.floor(initial.accumulatedWritingSeconds / 60));

  // Persist
  useEffect(() => {
    const state: TimerState = {
      timerMode,
      freeElapsed,
      timedDuration,
      timedSecondsLeft,
      pomodoroPhase,
      pomodoroSecondsLeft,
      pomodoroSessions,
      isRunning,
      endsAt: isRunning && timerMode !== 'free'
        ? Date.now() + (timerMode === 'timed' ? timedSecondsLeft : pomodoroSecondsLeft) * 1000
        : null,
      startedAt: isRunning && timerMode === 'free' ? Date.now() - freeElapsed * 1000 : null,
      accumulatedWritingSeconds: accWritingSeconds,
      accumulatedDate: accDateRef.current,
    };
    saveState(state);
  }, [timerMode, freeElapsed, timedDuration, timedSecondsLeft, pomodoroPhase, pomodoroSecondsLeft, pomodoroSessions, isRunning, accWritingSeconds]);

  // Record to store every minute change
  useEffect(() => {
    const currentMinutes = Math.floor(accWritingSeconds / 60);
    if (currentMinutes !== lastRecordedRef.current && onRecordMinutes) {
      lastRecordedRef.current = currentMinutes;
      onRecordMinutes(currentMinutes);
    }
  }, [accWritingSeconds, onRecordMinutes]);

  // Use a ref for accWritingSeconds to avoid recreating checkDateRollover every second
  const accWritingSecondsRef = useRef(accWritingSeconds);
  accWritingSecondsRef.current = accWritingSeconds;

  // Check date rollover
  const checkDateRollover = useCallback(() => {
    const today = todayStr();
    if (accDateRef.current !== today) {
      // Flush old day then reset
      if (onRecordMinutes) {
        onRecordMinutes(Math.floor(accWritingSecondsRef.current / 60));
      }
      accDateRef.current = today;
      setAccWritingSeconds(0);
      lastRecordedRef.current = 0;
    }
  }, [onRecordMinutes]);

  // Use a ref for pomodoroPhase to avoid stale closure issues in the interval
  const pomodoroPhaseRef = useRef(pomodoroPhase);
  pomodoroPhaseRef.current = pomodoroPhase;

  // Tick logic
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      checkDateRollover();

      if (timerMode === 'free') {
        setFreeElapsed((prev) => prev + 1);
        setAccWritingSeconds((prev) => prev + 1);
      } else if (timerMode === 'timed') {
        setTimedSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setAccWritingSeconds((a) => a + 1);
            playAlarm('timed');
            return 0;
          }
          setAccWritingSeconds((a) => a + 1);
          return prev - 1;
        });
      } else {
        // Pomodoro — read phase from ref to avoid stale closures
        setPomodoroSecondsLeft((prev) => {
          if (prev <= 1) {
            const phase = pomodoroPhaseRef.current;
            if (phase === 'work') {
              setPomodoroSessions((s) => s + 1);
              setAccWritingSeconds((a) => a + 1);
              playAlarm('work');
              // Transition to break — schedule via setTimeout to avoid
              // calling setPomodoroSecondsLeft inside its own setter
              setTimeout(() => {
                setPomodoroPhase('break');
                setPomodoroSecondsLeft(POMODORO_BREAK);
                setIsRunning(false);
              }, 0);
            } else {
              playAlarm('break');
              setTimeout(() => {
                setPomodoroPhase('work');
                setPomodoroSecondsLeft(POMODORO_WORK);
                setIsRunning(false);
              }, 0);
            }
            return 0;
          }
          // Only count work phase as writing time
          if (pomodoroPhaseRef.current === 'work') {
            setAccWritingSeconds((a) => a + 1);
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, timerMode, checkDateRollover]);

  // Display values
  const displaySeconds = timerMode === 'free'
    ? freeElapsed
    : timerMode === 'timed'
      ? timedSecondsLeft
      : pomodoroSecondsLeft;

  const progress = timerMode === 'free'
    ? 0
    : timerMode === 'timed'
      ? 1 - timedSecondsLeft / timedDuration
      : pomodoroPhase === 'work'
        ? 1 - pomodoroSecondsLeft / POMODORO_WORK
        : 1 - pomodoroSecondsLeft / POMODORO_BREAK;

  const formatTime = (secs: number): string => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const setTimerMode = useCallback((mode: WritingTimerMode) => {
    if (isRunning) return; // Can't change mode while running
    setTimerModeRaw(mode);
    // Reset current mode's timer
    if (mode === 'free') setFreeElapsed(0);
    if (mode === 'timed') setTimedSecondsLeft(timedDuration);
    if (mode === 'pomodoro') {
      setPomodoroPhase('work');
      setPomodoroSecondsLeft(POMODORO_WORK);
    }
  }, [isRunning, timedDuration]);

  const start = useCallback(() => {
    checkDateRollover();
    setIsRunning(true);
  }, [checkDateRollover]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    // Flush to store
    if (onRecordMinutes) {
      onRecordMinutes(Math.floor(accWritingSeconds / 60));
    }
    // Reset current mode
    if (timerMode === 'free') setFreeElapsed(0);
    if (timerMode === 'timed') setTimedSecondsLeft(timedDuration);
    if (timerMode === 'pomodoro') {
      setPomodoroPhase('work');
      setPomodoroSecondsLeft(POMODORO_WORK);
      setPomodoroSessions(0);
    }
  }, [timerMode, timedDuration, accWritingSeconds, onRecordMinutes]);

  const setTimedDurationCb = useCallback((seconds: number) => {
    if (isRunning) return;
    setTimedDuration(seconds);
    setTimedSecondsLeft(seconds);
  }, [isRunning]);

  const setPomodoroPhaseManual = useCallback((phase: 'work' | 'break') => {
    if (isRunning) return; // Can't switch phase while running
    setPomodoroPhase(phase);
    setPomodoroSecondsLeft(phase === 'work' ? POMODORO_WORK : POMODORO_BREAK);
  }, [isRunning]);

  return {
    timerMode,
    setTimerMode,
    isRunning,
    displaySeconds,
    displayLabel: formatTime(displaySeconds),
    progress,
    pomodoroPhase,
    pomodoroSessions,
    timedDuration,
    setTimedDuration: setTimedDurationCb,
    setPomodoroPhase: setPomodoroPhaseManual,
    start,
    pause,
    stop,
    writingMinutesToday: Math.floor(accWritingSeconds / 60),
  };
}
