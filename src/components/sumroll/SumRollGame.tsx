"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  evaluateBuildSelection,
  evaluateMatchAnswer,
  generateChallenge,
  type BuildChallenge,
  type DieValue,
  type MatchChallenge,
  type PlayableChallengeType,
  type SumRollChallenge,
} from "@/game/sumroll/engine";

const MAX_LIVES = 3;
const TOTAL_ROUNDS = 10;
const BASE_SCORE = 200;
const BUILD_BONUS = 50;
const SPEED_BONUS = 100;

const DIE_SYMBOLS: Record<DieValue, string> = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
};

const INITIAL_CHALLENGE = generateChallenge("match", {
  round: 1,
  runSeed: 1,
});

type Feedback = {
  tone: "success" | "danger" | "warning";
  text: string;
} | null;

const MODE_COPY: Record<
  PlayableChallengeType,
  { level: string; name: string; description: string }
> = {
  match: {
    level: "Level 1",
    name: "Match",
    description: "Choose the complete dice set that equals the target.",
  },
  build: {
    level: "Level 2",
    name: "Build",
    description: "Select individual dice to create the target sum.",
  },
};

export default function SumRollGame() {
  const [mode, setMode] = useState<PlayableChallengeType>("match");
  const [runSeed, setRunSeed] = useState(1);
  const [roundNumber, setRoundNumber] = useState(1);
  const [challenge, setChallenge] =
    useState<SumRollChallenge>(INITIAL_CHALLENGE);
  const [lives, setLives] = useState(MAX_LIVES);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(
    INITIAL_CHALLENGE.seconds,
  );
  const [locked, setLocked] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [selectedDice, setSelectedDice] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const transitionTimer = useRef<number | null>(null);

  const advanceRound = useCallback(() => {
    setRoundNumber((currentRound) => {
      if (currentRound >= TOTAL_ROUNDS) {
        setCompleted(true);
        return currentRound;
      }

      const nextRound = currentRound + 1;
      const nextChallenge = generateChallenge(mode, {
        round: nextRound,
        runSeed,
      });

      setChallenge(nextChallenge);
      setTimeRemaining(nextChallenge.seconds);
      setSelectedSet(null);
      setSelectedDice([]);
      setFeedback(null);
      setLocked(false);
      return nextRound;
    });
  }, [mode, runSeed]);

  const scheduleAdvance = useCallback(
    (delay: number) => {
      if (transitionTimer.current !== null) {
        window.clearTimeout(transitionTimer.current);
      }

      transitionTimer.current = window.setTimeout(advanceRound, delay);
    },
    [advanceRound],
  );

  const loseLife = useCallback(
    (message: string) => {
      setLocked(true);
      setCombo(0);
      const nextLives = lives - 1;

      setLives(Math.max(0, nextLives));

      if (nextLives <= 0) {
        setGameOver(true);
        setFeedback({
          tone: "danger",
          text: `${message} No lives remaining.`,
        });
      } else {
        setFeedback({ tone: "warning", text: `${message} One life lost.` });
        scheduleAdvance(1_050);
      }
    },
    [lives, scheduleAdvance],
  );

  useEffect(() => {
    if (locked || gameOver || completed) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (timeRemaining <= 1) {
        setTimeRemaining(0);
        loseLife("Too slow.");
        return;
      }

      setTimeRemaining((current) => current - 1);
    }, 1_000);

    return () => window.clearTimeout(timer);
  }, [completed, gameOver, locked, loseLife, timeRemaining]);

  useEffect(() => {
    return () => {
      if (transitionTimer.current !== null) {
        window.clearTimeout(transitionTimer.current);
      }
    };
  }, []);

  function completeCorrectAnswer(extraPoints = 0) {
    const nextCombo = combo + 1;
    const fastThreshold = Math.ceil(challenge.seconds * 0.7);
    const earned =
      BASE_SCORE +
      extraPoints +
      (timeRemaining >= fastThreshold ? SPEED_BONUS : 0);

    setLocked(true);
    setCombo(nextCombo);
    setBestCombo((current) => Math.max(current, nextCombo));
    setScore((current) => current + earned);
    setFeedback({
      tone: "success",
      text:
        timeRemaining >= fastThreshold
          ? `Lightning answer! +${earned}`
          : `Correct! +${earned}`,
    });
    scheduleAdvance(850);
  }

  function handleMatchAnswer(setId: string) {
    if (locked || gameOver || completed || challenge.type !== "match") {
      return;
    }

    setSelectedSet(setId);
    const result = evaluateMatchAnswer(challenge, setId);

    if (!result.correct) {
      loseLife(`${result.total} misses the target.`);
      return;
    }

    completeCorrectAnswer();
  }

  function handleBuildDie(dieId: string) {
    if (locked || gameOver || completed || challenge.type !== "build") {
      return;
    }

    setSelectedDice((current) =>
      current.includes(dieId)
        ? current.filter((id) => id !== dieId)
        : [...current, dieId],
    );
  }

  function handleBuildSubmit() {
    if (
      locked ||
      gameOver ||
      completed ||
      challenge.type !== "build" ||
      selectedDice.length === 0
    ) {
      return;
    }

    const result = evaluateBuildSelection(challenge, selectedDice);

    if (!result.correct) {
      const direction = result.total < result.target ? "below" : "above";
      loseLife(`${result.total} is ${direction} the target.`);
      return;
    }

    completeCorrectAnswer(BUILD_BONUS);
  }

  function resetRun(nextMode: PlayableChallengeType, nextSeed: number) {
    if (transitionTimer.current !== null) {
      window.clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }

    const nextChallenge = generateChallenge(nextMode, {
      round: 1,
      runSeed: nextSeed,
    });

    setMode(nextMode);
    setRunSeed(nextSeed);
    setRoundNumber(1);
    setChallenge(nextChallenge);
    setLives(MAX_LIVES);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setTimeRemaining(nextChallenge.seconds);
    setLocked(false);
    setGameOver(false);
    setCompleted(false);
    setSelectedSet(null);
    setSelectedDice([]);
    setFeedback(null);
  }

  function switchMode(nextMode: PlayableChallengeType) {
    if (nextMode !== mode) {
      resetRun(nextMode, runSeed + 1);
    }
  }

  function restartGame() {
    resetRun(mode, runSeed + 1);
  }

  const timerPercent = (timeRemaining / challenge.seconds) * 100;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-2">
        {(Object.keys(MODE_COPY) as PlayableChallengeType[]).map(
          (challengeType) => {
            const copy = MODE_COPY[challengeType];
            const active = mode === challengeType;

            return (
              <button
                key={challengeType}
                type="button"
                onClick={() => switchMode(challengeType)}
                aria-pressed={active}
                className={[
                  "rounded-xl px-3 py-3 text-left transition sm:px-4",
                  active
                    ? "bg-violet-400 text-black"
                    : "text-neutral-400 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                <span className="block text-[9px] font-black uppercase tracking-[0.2em] opacity-70">
                  {copy.level}
                </span>
                <span className="mt-1 block font-black">{copy.name}</span>
              </button>
            );
          },
        )}
      </div>

      <p className="mb-5 text-center text-sm text-neutral-500">
        {MODE_COPY[mode].description}
      </p>

      <div className="mb-5 rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20 sm:p-5">
        <div className="grid grid-cols-3 gap-3">
          <HudStat label="Lives">
            <div className="mt-2 flex gap-1 text-base sm:text-lg">
              {Array.from({ length: MAX_LIVES }).map((_, index) => (
                <span
                  key={index}
                  className={index < lives ? "" : "grayscale opacity-20"}
                  aria-label={index < lives ? "Life remaining" : "Life lost"}
                >
                  ♥
                </span>
              ))}
            </div>
          </HudStat>

          <HudStat label="Round" centered>
            <p className="mt-1 text-xl font-black">
              {roundNumber}
              <span className="text-neutral-600">/{TOTAL_ROUNDS}</span>
            </p>
          </HudStat>

          <HudStat label="Score" rightAligned>
            <p className="mt-1 text-xl font-black text-amber-300">
              {score.toLocaleString()}
            </p>
          </HudStat>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="font-black uppercase tracking-[0.18em] text-neutral-500">
            Time
          </span>
          <span
            className={[
              "font-black tabular-nums",
              timeRemaining <= 3 ? "text-red-400" : "text-white",
            ].join(" ")}
          >
            {timeRemaining}s
          </span>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
          <div
            className={[
              "h-full rounded-full transition-[width] duration-1000 ease-linear",
              timeRemaining <= 3 ? "bg-red-500" : "bg-violet-400",
            ].join(" ")}
            style={{ width: `${timerPercent}%` }}
          />
        </div>
      </div>

      {!gameOver && !completed && (
        <>
          <ChallengeHeader
            challenge={challenge}
            combo={combo}
            selectedDice={selectedDice}
          />

          {challenge.type === "match" ? (
            <MatchBoard
              challenge={challenge}
              locked={locked}
              selectedSet={selectedSet}
              onAnswer={handleMatchAnswer}
            />
          ) : (
            <BuildBoard
              challenge={challenge}
              locked={locked}
              selectedDice={selectedDice}
              onToggle={handleBuildDie}
              onSubmit={handleBuildSubmit}
            />
          )}

          {feedback && <FeedbackCard feedback={feedback} />}

          <div className="mt-5 flex items-center justify-between gap-4 text-xs text-neutral-500">
            <span>Fast answer bonus: +{SPEED_BONUS}</span>
            <span>Best combo: {bestCombo}</span>
          </div>
        </>
      )}

      {gameOver && (
        <ResultCard
          eyebrow={`${MODE_COPY[mode].name} run ended`}
          title="Out of lives"
          description="Pressure won this round. Reset, refocus, and go again."
          accent="red"
          score={score}
          combo={bestCombo}
          round={roundNumber}
          buttonLabel="Try Again"
          onRestart={restartGame}
        />
      )}

      {completed && (
        <ResultCard
          eyebrow={`${MODE_COPY[mode].name} · 10 rounds survived`}
          title="SumRoll complete!"
          description="Fast eyes, clean arithmetic, strong finish."
          accent="emerald"
          score={score}
          combo={bestCombo}
          round={TOTAL_ROUNDS}
          buttonLabel="Play Again"
          onRestart={restartGame}
        />
      )}
    </div>
  );
}

function ChallengeHeader({
  challenge,
  combo,
  selectedDice,
}: {
  challenge: SumRollChallenge;
  combo: number;
  selectedDice: string[];
}) {
  const buildTotal =
    challenge.type === "build"
      ? evaluateBuildSelection(challenge, selectedDice).total
      : null;

  return (
    <div className="mb-6 text-center">
      <p className="text-xs font-black uppercase tracking-[0.32em] text-violet-300">
        {challenge.type === "match" ? "Hit the target" : "Build the target"}
      </p>
      <div className="mt-2 text-7xl font-black tracking-[-0.06em] text-white sm:text-8xl">
        {challenge.target}
      </div>
      <p className="mt-3 text-sm text-neutral-400">
        {challenge.type === "match"
          ? "Which dice set adds up to this number?"
          : "Select any combination of dice, then lock your answer."}
      </p>

      {buildTotal !== null && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
          <span className="text-neutral-500">Your sum</span>
          <strong
            className={
              buildTotal === challenge.target
                ? "text-emerald-300"
                : "text-white"
            }
          >
            {buildTotal}
          </strong>
        </div>
      )}

      {combo >= 2 && (
        <div className="mt-4 ml-2 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-sm font-black text-orange-300">
          COMBO ×{combo}
        </div>
      )}
    </div>
  );
}

function MatchBoard({
  challenge,
  locked,
  selectedSet,
  onAnswer,
}: {
  challenge: MatchChallenge;
  locked: boolean;
  selectedSet: string | null;
  onAnswer: (setId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {challenge.sets.map((diceSet, index) => {
        const selected = selectedSet === diceSet.id;
        const correct = diceSet.id === challenge.correctSetId;
        let stateStyle =
          "border-white/10 bg-white/[0.035] hover:-translate-y-0.5 hover:border-violet-400/50 hover:bg-white/[0.06]";

        if (locked && correct) {
          stateStyle = "border-emerald-400 bg-emerald-950/50";
        } else if (locked && selected) {
          stateStyle = "border-red-500 bg-red-950/50";
        }

        return (
          <button
            type="button"
            key={diceSet.id}
            disabled={locked}
            onClick={() => onAnswer(diceSet.id)}
            aria-label={`Set ${String.fromCharCode(65 + index)}: ${diceSet.values.join(", ")}`}
            className={`min-h-36 rounded-3xl border p-4 transition sm:min-h-44 sm:p-5 ${stateStyle}`}
          >
            <p className="mb-4 text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">
              Set {String.fromCharCode(65 + index)}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
              {diceSet.values.map((value, dieIndex) => (
                <Die key={`${diceSet.id}-${dieIndex}`} value={value} />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function BuildBoard({
  challenge,
  locked,
  selectedDice,
  onToggle,
  onSubmit,
}: {
  challenge: BuildChallenge;
  locked: boolean;
  selectedDice: string[];
  onToggle: (dieId: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {challenge.dice.map((die) => {
          const selected = selectedDice.includes(die.id);

          return (
            <button
              key={die.id}
              type="button"
              disabled={locked}
              aria-pressed={selected}
              aria-label={`Die ${die.value}`}
              onClick={() => onToggle(die.id)}
              className={[
                "flex aspect-square items-center justify-center rounded-2xl border transition",
                selected
                  ? "-translate-y-1 border-violet-300 bg-violet-400/20 shadow-lg shadow-violet-950/40 ring-2 ring-violet-400/30"
                  : "border-white/10 bg-white/[0.035] hover:-translate-y-0.5 hover:border-violet-400/50 hover:bg-white/[0.06]",
              ].join(" ")}
            >
              <Die value={die.value} large />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={locked || selectedDice.length === 0}
        onClick={onSubmit}
        className="mt-4 w-full rounded-xl bg-violet-400 px-5 py-3 font-black text-black transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-30"
      >
        Lock answer
      </button>
    </div>
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

function HudStat({
  label,
  centered = false,
  rightAligned = false,
  children,
}: {
  label: string;
  centered?: boolean;
  rightAligned?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={centered ? "text-center" : rightAligned ? "text-right" : ""}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </p>
      {children}
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback: NonNullable<Feedback> }) {
  const style =
    feedback.tone === "success"
      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-200"
      : feedback.tone === "danger"
        ? "border-red-500/30 bg-red-950/40 text-red-200"
        : "border-amber-500/30 bg-amber-950/40 text-amber-200";

  return (
    <div
      role="status"
      className={`mt-5 rounded-2xl border p-4 text-center font-bold ${style}`}
    >
      {feedback.text}
    </div>
  );
}

function ResultCard({
  eyebrow,
  title,
  description,
  accent,
  score,
  combo,
  round,
  buttonLabel,
  onRestart,
}: {
  eyebrow: string;
  title: string;
  description: string;
  accent: "red" | "emerald";
  score: number;
  combo: number;
  round: number;
  buttonLabel: string;
  onRestart: () => void;
}) {
  const styles =
    accent === "emerald"
      ? {
          shell: "border-emerald-500/30 bg-emerald-950/30",
          eyebrow: "text-emerald-400",
          button: "bg-emerald-400 text-black hover:bg-emerald-300",
          icon: "🏆",
        }
      : {
          shell: "border-red-500/30 bg-red-950/30",
          eyebrow: "text-red-400",
          button: "bg-red-500 text-white hover:bg-red-400",
          icon: "💥",
        };

  return (
    <div className={`overflow-hidden rounded-3xl border ${styles.shell}`}>
      <div className="p-7 text-center">
        <div className="text-5xl">{styles.icon}</div>
        <p
          className={`mt-4 text-xs font-black uppercase tracking-[0.25em] ${styles.eyebrow}`}
        >
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-black text-white">{title}</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-neutral-400">
          {description}
        </p>

        <div className="mt-7 grid grid-cols-3 gap-3">
          <ResultStat label="Score" value={score.toLocaleString()} />
          <ResultStat label="Round" value={`${round}/${TOTAL_ROUNDS}`} />
          <ResultStat label="Best combo" value={`×${combo}`} />
        </div>

        <button
          type="button"
          onClick={onRestart}
          className={`mt-6 w-full rounded-xl px-5 py-3 font-black transition ${styles.button}`}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/20 px-2 py-4">
      <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500 sm:text-[10px]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-white sm:text-xl">{value}</p>
    </div>
  );
}
