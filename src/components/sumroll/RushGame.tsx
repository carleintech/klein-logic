"use client";

import { useEffect, useRef, useState } from "react";

import {
  canSelectExactDie,
  validateChallenge,
  type ChallengeAnswer,
  type DieValue,
} from "@/game/sumroll/engine";
import {
  createRushSession,
  getRushComboMultiplier,
  getRushResults,
  RUSH_SKIP_PENALTY_MS,
  RUSH_WRONG_PENALTY_MS,
  skipRushChallenge,
  submitRushAnswer,
  tickRushSession,
  type RushSession,
  type RushChallenge,
} from "@/game/sumroll/modes/rush";

const DIE_SYMBOLS: Record<DieValue, string> = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
};

type RushFeedback = {
  tone: "success" | "danger" | "warning";
  text: string;
} | null;

export default function RushGame() {
  const [nextSeed, setNextSeed] = useState(1);
  const [session, setSession] = useState<RushSession | null>(null);
  const [selectedDice, setSelectedDice] = useState<string[]>([]);
  const [deselections, setDeselections] = useState(0);
  const [feedback, setFeedback] = useState<RushFeedback>(null);
  const lastTickAt = useRef(0);
  const challengeStartedAt = useRef(0);
  const isRushPlaying = session?.status === "playing";

  useEffect(() => {
    if (!isRushPlaying) {
      return;
    }

    lastTickAt.current = performance.now();

    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastTickAt.current;
      lastTickAt.current = now;
      setSession((current) =>
        current ? tickRushSession(current, elapsed) : current,
      );
    }, 100);

    return () => window.clearInterval(timer);
  }, [isRushPlaying]);

  function startRush() {
    const nextSession = createRushSession(nextSeed);

    setNextSeed((current) => current + 1);
    setSession(nextSession);
    setSelectedDice([]);
    setDeselections(0);
    setFeedback(null);
    challengeStartedAt.current = performance.now();
  }

  function submitAnswer(answer: ChallengeAnswer) {
    if (!session || session.status !== "playing") {
      return;
    }

    const responseMs = performance.now() - challengeStartedAt.current;
    const resolution = submitRushAnswer(session, answer, responseMs);

    setSession(resolution.session);
    setSelectedDice([]);
    setDeselections(0);
    challengeStartedAt.current = performance.now();

    if (resolution.validation.correct) {
      setFeedback({
        tone: "success",
        text: `+${resolution.points} · ×${resolution.multiplier} combo score`,
      });
    } else {
      setFeedback({
        tone: "danger",
        text: `Wrong answer · −${resolution.penaltyMs / 1_000}s`,
      });
    }
  }

  function toggleDie(dieId: string) {
    if (!session || session.status !== "playing") {
      return;
    }

    const challenge = session.challenge;

    if (challenge.type === "match") {
      return;
    }

    if (selectedDice.includes(dieId)) {
      setSelectedDice((current) => current.filter((id) => id !== dieId));

      if (challenge.type === "exact") {
        setDeselections((current) => current + 1);
      }

      return;
    }

    if (
      challenge.type === "exact" &&
      !canSelectExactDie(challenge, selectedDice, dieId)
    ) {
      return;
    }

    setSelectedDice((current) => [...current, dieId]);
  }

  function lockSelection() {
    if (!session || session.challenge.type === "match" || selectedDice.length === 0) {
      return;
    }

    submitAnswer(
      session.challenge.type === "build"
        ? { type: "build", selectedIds: selectedDice }
        : { type: "exact", selectedIds: selectedDice, deselections },
    );
  }

  function skipChallenge() {
    if (!session || session.status !== "playing") {
      return;
    }

    setSession(skipRushChallenge(session));
    setSelectedDice([]);
    setDeselections(0);
    setFeedback({
      tone: "warning",
      text: `Skipped · −${RUSH_SKIP_PENALTY_MS / 1_000}s`,
    });
    challengeStartedAt.current = performance.now();
  }

  if (!session) {
    return <RushIntro onStart={startRush} />;
  }

  if (session.status === "complete") {
    return <RushResults session={session} onRestart={startRush} />;
  }

  const multiplier = getRushComboMultiplier(session.combo);
  const timeSeconds = (session.remainingMs / 1_000).toFixed(1);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-5 overflow-hidden rounded-3xl border border-orange-400/20 bg-orange-400/[0.045] shadow-2xl shadow-orange-950/20">
        <div className="grid grid-cols-3 gap-3 p-4 sm:p-5">
          <RushStat label="Time" value={timeSeconds} accent />
          <RushStat label="Score" value={session.score.toLocaleString()} />
          <RushStat label="Solved" value={session.solved.toString()} />
        </div>
        <div className="h-2 bg-neutral-900">
          <div
            className="h-full bg-orange-400 transition-[width] duration-100 ease-linear"
            style={{ width: `${(session.remainingMs / 60_000) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
            Streak
          </p>
          <p className="mt-1 font-black text-orange-300">
            COMBO ×{session.combo}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
            Multiplier
          </p>
          <p className="mt-1 text-xl font-black text-white">×{multiplier}</p>
        </div>
      </div>

      {feedback && <RushFeedbackCard feedback={feedback} />}

      <RushChallengeBoard
        challenge={session.challenge}
        selectedDice={selectedDice}
        deselections={deselections}
        onMatchAnswer={(setId) => submitAnswer({ type: "match", setId })}
        onToggleDie={toggleDie}
        onLock={lockSelection}
      />

      <button
        type="button"
        onClick={skipChallenge}
        className="mt-4 w-full rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-neutral-400 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
      >
        Skip · −{RUSH_SKIP_PENALTY_MS / 1_000}s
      </button>
    </div>
  );
}

function RushIntro({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-orange-400/20 bg-gradient-to-b from-orange-400/10 to-white/[0.025]">
      <div className="p-7 text-center sm:p-9">
        <div className="text-5xl">⚡</div>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.3em] text-orange-300">
          SumRoll Rush
        </p>
        <h2 className="mt-3 text-4xl font-black tracking-tight">
          Sixty seconds. No lives.
        </h2>
        <p className="mx-auto mt-4 max-w-lg leading-7 text-neutral-400">
          Solve an escalating mix of Match, Build, and Exact challenges. Protect
          your combo, because every mistake costs time.
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
          <Rule label="Correct" value="+200" />
          <Rule label="Fast solve" value="+100" />
          <Rule label="Wrong" value={`−${RUSH_WRONG_PENALTY_MS / 1_000}s`} />
          <Rule label="Skip" value={`−${RUSH_SKIP_PENALTY_MS / 1_000}s`} />
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-7 w-full rounded-xl bg-orange-400 px-5 py-4 font-black text-black transition hover:bg-orange-300"
        >
          Start 60-second Rush
        </button>
      </div>
    </div>
  );
}

function RushChallengeBoard({
  challenge,
  selectedDice,
  deselections,
  onMatchAnswer,
  onToggleDie,
  onLock,
}: {
  challenge: RushChallenge;
  selectedDice: string[];
  deselections: number;
  onMatchAnswer: (setId: string) => void;
  onToggleDie: (dieId: string) => void;
  onLock: () => void;
}) {
  const selectionResult =
    challenge.type === "match"
      ? null
      : validateChallenge(
          challenge,
          challenge.type === "build"
            ? { type: "build", selectedIds: selectedDice }
            : { type: "exact", selectedIds: selectedDice, deselections },
        );

  return (
    <div>
      <div className="mb-6 text-center">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-300">
          {challenge.type}
        </p>
        <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
          Target
        </p>
        <div className="mt-1 text-7xl font-black tracking-[-0.06em] text-white sm:text-8xl">
          {challenge.target}
        </div>
        {challenge.type === "exact" && (
          <p className="mt-2 text-sm text-neutral-400">
            Use exactly {challenge.exactCount} dice
          </p>
        )}

        {selectionResult && (
          <div className="mt-4 flex justify-center gap-2 text-sm">
            <MetricPill label="Sum" value={selectionResult.total.toString()} />
            {challenge.type === "exact" && (
              <MetricPill
                label="Dice"
                value={`${selectionResult.selectedCount}/${challenge.exactCount}`}
              />
            )}
          </div>
        )}
      </div>

      {challenge.type === "match" ? (
        <div className="grid grid-cols-2 gap-3">
          {challenge.sets.map((set, index) => (
            <button
              key={set.id}
              type="button"
              onClick={() => onMatchAnswer(set.id)}
              aria-label={`Set ${String.fromCharCode(65 + index)}: ${set.values.join(", ")}`}
              className="min-h-32 rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:-translate-y-0.5 hover:border-orange-400/50 hover:bg-white/[0.06] sm:min-h-40"
            >
              <span className="mb-3 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                Set {String.fromCharCode(65 + index)}
              </span>
              <span className="flex flex-wrap justify-center gap-1 sm:gap-2">
                {set.values.map((value, dieIndex) => (
                  <Die key={`${set.id}-${dieIndex}`} value={value} />
                ))}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {challenge.dice.map((die) => {
              const selected = selectedDice.includes(die.id);
              const unavailable =
                challenge.type === "exact" &&
                !selected &&
                !canSelectExactDie(challenge, selectedDice, die.id);

              return (
                <button
                  key={die.id}
                  type="button"
                  disabled={unavailable}
                  aria-pressed={selected}
                  aria-label={`Die ${die.value}`}
                  onClick={() => onToggleDie(die.id)}
                  className={[
                    "flex aspect-square items-center justify-center rounded-2xl border transition",
                    selected
                      ? "-translate-y-1 border-orange-300 bg-orange-400/20 ring-2 ring-orange-400/30"
                      : unavailable
                        ? "cursor-not-allowed border-white/5 bg-white/[0.02] opacity-25"
                        : "border-white/10 bg-white/[0.035] hover:border-orange-400/50 hover:bg-white/[0.06]",
                  ].join(" ")}
                >
                  <Die value={die.value} large />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={selectedDice.length === 0}
            onClick={onLock}
            className="mt-4 w-full rounded-xl bg-orange-400 px-5 py-3 font-black text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Lock answer
          </button>
        </div>
      )}
    </div>
  );
}

function RushResults({
  session,
  onRestart,
}: {
  session: RushSession;
  onRestart: () => void;
}) {
  const results = getRushResults(session);

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-orange-400/20 bg-orange-950/20">
      <div className="p-7 text-center sm:p-9">
        <div className="text-5xl">🏁</div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.3em] text-orange-300">
          Rush complete
        </p>
        <p className="mt-4 text-6xl font-black tracking-tight text-white">
          {results.score.toLocaleString()}
        </p>
        <p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
          Final score
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ResultStat label="Solved" value={results.solved.toString()} />
          <ResultStat label="Accuracy" value={`${results.accuracyPercent}%`} />
          <ResultStat label="Best combo" value={`×${results.bestCombo}`} />
          <ResultStat
            label="Avg response"
            value={formatResponseTime(results.averageResponseMs)}
          />
          <ResultStat
            label="Fastest"
            value={formatResponseTime(results.fastestResponseMs)}
          />
          <ResultStat label="Skipped" value={results.skipped.toString()} />
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="mt-7 w-full rounded-xl bg-orange-400 px-5 py-4 font-black text-black transition hover:bg-orange-300"
        >
          Play Rush Again
        </button>
      </div>
    </div>
  );
}

function formatResponseTime(value: number | null): string {
  return value === null ? "—" : `${(value / 1_000).toFixed(2)}s`;
}

function RushFeedbackCard({ feedback }: { feedback: NonNullable<RushFeedback> }) {
  const style =
    feedback.tone === "success"
      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-200"
      : feedback.tone === "danger"
        ? "border-red-500/30 bg-red-950/40 text-red-200"
        : "border-amber-500/30 bg-amber-950/40 text-amber-200";

  return (
    <div className={`mb-5 rounded-xl border p-3 text-center text-sm font-black ${style}`}>
      {feedback.text}
    </div>
  );
}

function RushStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-black tabular-nums ${accent ? "text-orange-300" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/20 p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="mt-1 font-black text-white">{value}</p>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
      <span className="text-neutral-500">{label} </span>
      <strong>{value}</strong>
    </span>
  );
}

function Die({ value, large = false }: { value: DieValue; large?: boolean }) {
  return (
    <span
      className={large ? "text-6xl leading-none" : "text-4xl leading-none sm:text-5xl"}
      aria-hidden="true"
    >
      {DIE_SYMBOLS[value]}
    </span>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/20 px-3 py-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}
