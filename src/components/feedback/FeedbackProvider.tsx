"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "kleinlogic.feedback.v1";

export type MotionPreference = "system" | "full" | "reduced";

export type FeedbackPreferences = {
  sound: boolean;
  haptics: boolean;
  motion: MotionPreference;
};

export type FeedbackApi = {
  preferences: FeedbackPreferences;
  setPreference: <Key extends keyof FeedbackPreferences>(
    key: Key,
    value: FeedbackPreferences[Key],
  ) => void;
  select: () => void;
  success: () => void;
  failure: () => void;
  warning: () => void;
  qualify: () => void;
  eliminate: () => void;
  countdown: (value?: number) => void;
  roundChange: () => void;
};

const DEFAULT_PREFERENCES: FeedbackPreferences = {
  sound: true,
  haptics: true,
  motion: "system",
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

function isMotionPreference(value: unknown): value is MotionPreference {
  return value === "system" || value === "full" || value === "reduced";
}

export function parseFeedbackPreferences(value: unknown): FeedbackPreferences {
  if (!value || typeof value !== "object") {
    return DEFAULT_PREFERENCES;
  }

  const candidate = value as Partial<FeedbackPreferences>;
  return {
    sound: typeof candidate.sound === "boolean" ? candidate.sound : true,
    haptics: typeof candidate.haptics === "boolean" ? candidate.haptics : true,
    motion: isMotionPreference(candidate.motion) ? candidate.motion : "system",
  };
}

function readStoredPreferences(): FeedbackPreferences {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? parseFeedbackPreferences(JSON.parse(stored)) : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function writeStoredPreferences(preferences: FeedbackPreferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable in private browsing or embedded contexts.
  }
}

function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    // Haptics are optional and must never interrupt gameplay.
  }
}

type Tone = "select" | "success" | "failure" | "warning" | "qualify" | "eliminate" | "countdown" | "round";

const TONES: Record<Tone, { frequency: number; duration: number; gain: number; pattern: number | number[] }> = {
  select: { frequency: 520, duration: 0.045, gain: 0.018, pattern: 8 },
  success: { frequency: 720, duration: 0.12, gain: 0.035, pattern: [10, 20, 16] },
  failure: { frequency: 170, duration: 0.13, gain: 0.03, pattern: [18, 20, 18] },
  warning: { frequency: 300, duration: 0.08, gain: 0.025, pattern: 16 },
  qualify: { frequency: 840, duration: 0.16, gain: 0.04, pattern: [12, 24, 24] },
  eliminate: { frequency: 130, duration: 0.16, gain: 0.03, pattern: [24, 24, 24] },
  countdown: { frequency: 440, duration: 0.055, gain: 0.02, pattern: 8 },
  round: { frequency: 620, duration: 0.09, gain: 0.025, pattern: 10 },
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<FeedbackPreferences>(DEFAULT_PREFERENCES);
  const audioContext = useRef<AudioContext | null>(null);
  const lastCue = useRef(new Map<Tone, number>());

  useEffect(() => {
    // Local preferences are an external browser store; hydrate them after the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferences(readStoredPreferences());
  }, []);

  const setPreference = useCallback(
    <Key extends keyof FeedbackPreferences>(key: Key, value: FeedbackPreferences[Key]) => {
      setPreferences((current) => {
        const next = { ...current, [key]: value };
        writeStoredPreferences(next);
        return next;
      });
    },
    [],
  );

  const playTone = useCallback((tone: Tone) => {
    if (!preferences.sound || typeof window === "undefined") {
      return;
    }

    const now = performance.now();
    const previous = lastCue.current.get(tone) ?? 0;
    if (now - previous < 45) {
      return;
    }
    lastCue.current.set(tone, now);

    try {
      const Context =
        window.AudioContext ??
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;
      if (!Context) {
        return;
      }
      const context = audioContext.current ?? new Context();
      audioContext.current = context;
      if (context.state === "suspended") {
        void context.resume().catch(() => undefined);
      }
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const spec = TONES[tone];
      const start = context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(spec.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(spec.gain, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + spec.duration + 0.01);
    } catch {
      // Audio is an enhancement; blocked or unavailable audio is a no-op.
    }
  }, [preferences.sound]);

  const emit = useCallback((tone: Tone) => {
    playTone(tone);
    if (preferences.haptics) {
      vibrate(TONES[tone].pattern);
    }
  }, [playTone, preferences.haptics]);

  const api = useMemo<FeedbackApi>(() => ({
    preferences,
    setPreference,
    select: () => emit("select"),
    success: () => emit("success"),
    failure: () => emit("failure"),
    warning: () => emit("warning"),
    qualify: () => emit("qualify"),
    eliminate: () => emit("eliminate"),
    countdown: () => emit("countdown"),
    roundChange: () => emit("round"),
  }), [emit, preferences, setPreference]);

  return (
    <FeedbackContext.Provider value={api}>
      <div className="contents" data-logic-motion={preferences.motion}>{children}</div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within FeedbackProvider");
  }
  return context;
}

export function FeedbackPreferences() {
  const { preferences, setPreference } = useFeedback();

  return (
    <details className="relative hidden sm:block">
      <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-sm px-2 font-mono text-[0.625rem] font-bold uppercase tracking-[0.16em] text-text-muted outline-none hover:text-text-primary">
        Feedback
      </summary>
      <fieldset className="absolute right-0 top-12 z-30 w-56 rounded-[var(--radius-panel)] border border-border-default bg-surface-panel p-4 shadow-panel">
        <legend className="sr-only">Feedback preferences</legend>
        <label className="flex items-center justify-between gap-3 py-2 text-sm text-text-secondary">
          Sound
          <input type="checkbox" checked={preferences.sound} onChange={(event) => setPreference("sound", event.target.checked)} className="h-4 w-4 accent-logic-primary" />
        </label>
        <label className="flex items-center justify-between gap-3 py-2 text-sm text-text-secondary">
          Haptics
          <input type="checkbox" checked={preferences.haptics} onChange={(event) => setPreference("haptics", event.target.checked)} className="h-4 w-4 accent-logic-primary" />
        </label>
        <label className="flex items-center justify-between gap-3 py-2 text-sm text-text-secondary">
          Motion
          <select value={preferences.motion} onChange={(event) => setPreference("motion", event.target.value as MotionPreference)} className="logic-input min-h-9 w-auto px-2 text-xs">
            <option value="system">System</option>
            <option value="full">Full</option>
            <option value="reduced">Reduced</option>
          </select>
        </label>
      </fieldset>
    </details>
  );
}
