"use client";

import { useEffect, useRef, useState } from "react";

import type {
  PublicArenaChallenge,
  PublicExactArenaChallenge,
  PublicMemoryArenaChallenge,
} from "@/arena/challenges/types";
import type { TournamentState } from "@/arena/types";
import type { ChallengeAnswer, DieValue } from "@/game/sumroll/types";

const DIE_SYMBOLS: Record<DieValue, string> = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
};

type MemoryPhase = "ready" | "memorize" | "hidden" | "answer";

export type ArenaPublicSubmission = {
  answer: ChallengeAnswer | null;
  responseMs: number | null;
};

export function ArenaHumanChallenge({
  challenge,
  roundLabel,
  responseWindowMs,
  onSubmit,
}: {
  challenge: PublicArenaChallenge;
  roundLabel: string;
  responseWindowMs: number;
  onSubmit: (submission: ArenaPublicSubmission) => void;
}) {
  const [selectedDice, setSelectedDice] = useState<string[]>([]);
  const [deselections, setDeselections] = useState(0);
  const [memoryPhase, setMemoryPhase] = useState<MemoryPhase>("ready");
  const [timeRemainingMs, setTimeRemainingMs] = useState(responseWindowMs);
  const startedAt = useRef<number | null>(null);
  const submitted = useRef(false);
  const timeoutTimer = useRef<number | null>(null);
  const clockTimer = useRef<number | null>(null);

  function finish(submission: ArenaPublicSubmission) {
    if (submitted.current) {
      return;
    }

    submitted.current = true;

    if (timeoutTimer.current !== null) {
      window.clearTimeout(timeoutTimer.current);
    }

    if (clockTimer.current !== null) {
      window.clearInterval(clockTimer.current);
    }

    onSubmit(submission);
  }

  function makeActionable() {
    const start = performance.now();
    startedAt.current = start;
    timeoutTimer.current = window.setTimeout(
      () => finish({ answer: null, responseMs: null }),
      responseWindowMs,
    );
    clockTimer.current = window.setInterval(() => {
      const remaining = Math.max(
        0,
        responseWindowMs - (performance.now() - start),
      );
      setTimeRemainingMs(remaining);
    }, 50);
  }

  useEffect(() => {
    if (challenge.type === "memory") {
      return;
    }

    makeActionable();

    return () => {
      if (timeoutTimer.current !== null) {
        window.clearTimeout(timeoutTimer.current);
      }
      if (clockTimer.current !== null) {
        window.clearInterval(clockTimer.current);
      }
    };
  // The component is keyed by challenge id, so this effect intentionally runs once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (challenge.type !== "memory") {
      return;
    }

    const memorizeTimer = window.setTimeout(
      () => setMemoryPhase("memorize"),
      challenge.readyDurationMs,
    );
    const hiddenTimer = window.setTimeout(
      () => setMemoryPhase("hidden"),
      challenge.readyDurationMs + challenge.exposureDurationMs,
    );
    const answerTimer = window.setTimeout(() => {
      setMemoryPhase("answer");
      makeActionable();
    }, challenge.readyDurationMs + challenge.exposureDurationMs + challenge.hiddenDurationMs);

    return () => {
      window.clearTimeout(memorizeTimer);
      window.clearTimeout(hiddenTimer);
      window.clearTimeout(answerTimer);
      if (timeoutTimer.current !== null) {
        window.clearTimeout(timeoutTimer.current);
      }
      if (clockTimer.current !== null) {
        window.clearInterval(clockTimer.current);
      }
    };
  // The component is keyed by challenge id, so this effect intentionally runs once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeChallenge = challenge;

  function handleAnswer(
    answer: ChallengeAnswer,
    respondedAt: number,
  ) {
    if (startedAt.current === null) {
      return;
    }

    finish({
      answer,
      responseMs: Math.max(0, Math.round(respondedAt - startedAt.current)),
    });
  }

  function toggleDie(dieId: string) {
    if (
      activeChallenge.type !== "build" &&
      activeChallenge.type !== "exact"
    ) {
      return;
    }

    if (selectedDice.includes(dieId)) {
      setSelectedDice((current) => current.filter((id) => id !== dieId));
      if (activeChallenge.type === "exact") {
        setDeselections((current) => current + 1);
      }
      return;
    }

    if (
      activeChallenge.type === "exact" &&
      !canSelectPublicExactDie(activeChallenge, selectedDice, dieId)
    ) {
      return;
    }

    setSelectedDice((current) => [...current, dieId]);
  }

  const timerLabel =
    activeChallenge.type === "memory" && memoryPhase !== "answer"
      ? "WATCH"
      : `${(timeRemainingMs / 1_000).toFixed(1)}s`;

  return (
    <section className="mx-auto w-full max-w-4xl border border-white/10 bg-[#080d13]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 font-mono text-[10px] uppercase tracking-[0.2em]">
        <span className="text-cyan-300">{roundLabel} · You are playing</span>
        <span className={timeRemainingMs <= 1_000 ? "text-red-300" : "text-white"}>
          {timerLabel}
        </span>
      </div>

      <div className="p-5 sm:p-8">
        <div className="mb-7 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-300">
            SumRoll · {challenge.type}
          </p>
          {challenge.type !== "memory" && (
            <>
              <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                Target
              </p>
              <p className="mt-1 text-7xl font-black text-white">{challenge.target}</p>
            </>
          )}
          {challenge.type === "exact" && (
            <p className="mt-3 text-sm text-neutral-400">
              Use exactly {challenge.exactCount} dice
            </p>
          )}
        </div>

        {challenge.type === "match" && (
          <div className="grid grid-cols-2 gap-3">
            {challenge.sets.map((set, index) => (
              <button
                key={set.id}
                type="button"
                onClick={() =>
                  handleAnswer(
                    { type: "match", setId: set.id },
                    performance.now(),
                  )
                }
                className="min-h-32 border border-white/10 bg-white/[0.035] p-4 transition hover:border-cyan-300/60 hover:bg-cyan-300/[0.06]"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  Set {String.fromCharCode(65 + index)}
                </span>
                <span className="mt-4 flex flex-wrap justify-center gap-2">
                  {set.values.map((value, dieIndex) => (
                    <Die key={`${set.id}-${dieIndex}`} value={value} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        )}

        {(challenge.type === "build" || challenge.type === "exact") && (
          <div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {challenge.dice.map((die) => {
                const selected = selectedDice.includes(die.id);
                const unavailable =
                  challenge.type === "exact" &&
                  !selected &&
                  !canSelectPublicExactDie(challenge, selectedDice, die.id);

                return (
                  <button
                    key={die.id}
                    type="button"
                    disabled={unavailable}
                    aria-pressed={selected}
                    onClick={() => toggleDie(die.id)}
                    className={`aspect-square border text-6xl transition ${
                      selected
                        ? "border-cyan-300 bg-cyan-300/15"
                        : unavailable
                          ? "border-white/5 opacity-20"
                          : "border-white/10 bg-white/[0.035] hover:border-cyan-300/50"
                    }`}
                  >
                    {DIE_SYMBOLS[die.value]}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={selectedDice.length === 0}
              onClick={() =>
                handleAnswer(
                  challenge.type === "build"
                    ? { type: "build", selectedIds: selectedDice }
                    : {
                        type: "exact",
                        selectedIds: selectedDice,
                        deselections,
                      },
                  performance.now(),
                )
              }
              className="mt-4 w-full bg-cyan-300 px-5 py-4 font-mono text-xs font-black uppercase tracking-[0.2em] text-black disabled:opacity-30"
            >
              Lock Answer
            </button>
          </div>
        )}

        {challenge.type === "memory" && (
          <MemoryArenaChallenge
            challenge={challenge}
            phase={memoryPhase}
            onAnswer={(total) =>
              handleAnswer({ type: "memory", total }, performance.now())
            }
          />
        )}
      </div>
    </section>
  );
}

export function ArenaHumanRoundResults({
  tournament,
  onContinue,
  onWatch,
  onTryAgain,
}: {
  tournament: TournamentState;
  onContinue: () => void;
  onWatch: () => void;
  onTryAgain: () => void;
}) {
  const human = tournament.players.find(
    (player) => player.participantType === "human",
  );
  const result = tournament.roundHistory.at(-1);
  const ranking = result?.rankings.find(
    (response) => response.playerId === human?.id,
  );

  if (!human || !result || !ranking) {
    return null;
  }

  const survived = human.status === "active";
  const cutoff = result.rankings[result.advancingPlayers - 1];

  return (
    <section className="mx-auto w-full max-w-3xl border border-white/10 bg-[#080d13] p-6 text-center sm:p-9">
      <p className={`font-mono text-xs font-black uppercase tracking-[0.3em] ${survived ? "text-emerald-300" : "text-red-300"}`}>
        {survived ? "✓ You survived" : "Eliminated"}
      </p>
      <h2 className="mt-3 text-4xl font-black text-white">
        {survived ? `${result.advancingPlayers} players remain` : `Round ${result.roundNumber}`}
      </h2>

      <div className="mt-7 grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
        <PlayerMetric label="Answer" value={ranking.correct ? "Correct" : ranking.responseMs === null ? "Timeout" : "Wrong"} />
        <PlayerMetric label="Your time" value={formatResponseTime(ranking.responseMs)} />
        <PlayerMetric label="Round rank" value={`#${ranking.rank} / ${result.startingPlayers}`} />
        <PlayerMetric
          label={survived ? "Next round" : "Final placement"}
          value={survived ? result.advancingPlayers.toString() : `#${human.finalPlacement ?? ranking.rank}`}
        />
      </div>

      {!survived && (
        <p className="mt-5 font-mono text-xs text-neutral-500">
          Cutoff response: {formatResponseTime(cutoff?.responseMs ?? null)}
          {cutoff?.correct ? " · correct" : " · incorrect"}
        </p>
      )}

      {survived ? (
        <button
          type="button"
          onClick={onContinue}
          className="mt-7 w-full bg-cyan-300 px-6 py-4 font-mono text-xs font-black uppercase tracking-[0.2em] text-black"
        >
          {result.advancingPlayers === 1 ? "Reveal Champion" : "Continue"}
        </button>
      ) : (
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onWatch}
            className="border border-cyan-300 bg-cyan-300 px-5 py-4 font-mono text-xs font-black uppercase tracking-[0.16em] text-black"
          >
            Watch Tournament
          </button>
          <button
            type="button"
            onClick={onTryAgain}
            className="border border-white/20 px-5 py-4 font-mono text-xs font-black uppercase tracking-[0.16em] text-white"
          >
            Try Again
          </button>
        </div>
      )}
    </section>
  );
}

function MemoryArenaChallenge({
  challenge,
  phase,
  onAnswer,
}: {
  challenge: PublicMemoryArenaChallenge;
  phase: MemoryPhase;
  onAnswer: (total: number) => void;
}) {
  return (
    <div className="text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-300">
        {phase === "ready"
          ? "Get ready"
          : phase === "memorize"
            ? "Memorize"
            : phase === "hidden"
              ? "Hold it"
              : "What was the total?"}
      </p>
      <div className="my-8 flex min-h-24 flex-wrap items-center justify-center gap-3">
        {phase === "memorize"
          ? challenge.dice.map((value, index) => (
              <Die key={`${challenge.id}-${index}`} value={value} large />
            ))
          : phase === "answer"
            ? <span className="text-7xl font-black text-white">?</span>
            : challenge.dice.map((_, index) => (
                <span
                  key={`${challenge.id}-hidden-${index}`}
                  className="h-20 w-20 border border-white/5 bg-white/[0.025]"
                />
              ))}
      </div>
      {phase === "answer" && (
        <div className="grid grid-cols-2 gap-3">
          {challenge.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onAnswer(option)}
              className="border border-white/10 bg-white/[0.035] px-5 py-5 text-2xl font-black text-white transition hover:border-cyan-300/60"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function canSelectPublicExactDie(
  challenge: PublicExactArenaChallenge,
  selectedIds: string[],
  dieId: string,
): boolean {
  if (selectedIds.includes(dieId)) {
    return true;
  }

  if (selectedIds.length >= challenge.exactCount) {
    return false;
  }

  const die = challenge.dice.find((candidate) => candidate.id === dieId);

  if (!die) {
    return false;
  }

  const selectedIdSet = new Set(selectedIds);
  const currentTotal = challenge.dice.reduce(
    (sum, candidate) =>
      sum + (selectedIdSet.has(candidate.id) ? candidate.value : 0),
    0,
  );

  return currentTotal + die.value <= challenge.target;
}

function Die({ value, large = false }: { value: DieValue; large?: boolean }) {
  return (
    <span className={large ? "text-7xl leading-none" : "text-5xl leading-none"}>
      {DIE_SYMBOLS[value]}
    </span>
  );
}

function PlayerMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0a1017] px-3 py-5">
      <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-neutral-500">
        {label}
      </p>
      <p className="mt-2 font-mono text-lg font-black text-white">{value}</p>
    </div>
  );
}

function formatResponseTime(responseMs: number | null): string {
  return responseMs === null ? "—" : `${(responseMs / 1_000).toFixed(2)}s`;
}
