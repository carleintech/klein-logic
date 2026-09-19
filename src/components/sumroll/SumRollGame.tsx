"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  generateRound,
  type DiceSet,
  type DieValue,
  type SumRollRound,
} from "@/game/sumroll/engine";

const MAX_LIVES = 3;
const TOTAL_ROUNDS = 10;
const ROUND_SECONDS = 10;
const BASE_SCORE = 200;
const SPEED_BONUS = 100;

const DIE_SYMBOLS: Record<DieValue, string> = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
};

type Feedback = {
  tone: "success" | "danger" | "warning";
  text: string;
} | null;

export default function SumRollGame() {
  const [runSeed, setRunSeed] = useState(1);
  const [roundNumber, setRoundNumber] = useState(1);
  const [round, setRound] = useState<SumRollRound>(() => generateRound(1, 1));
  const [lives, setLives] = useState(MAX_LIVES);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(ROUND_SECONDS);
  const [locked, setLocked] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const transitionTimer = useRef<number | null>(null);

  const advanceRound = useCallback(() => {
    setRoundNumber((currentRound) => {
      if (currentRound >= TOTAL_ROUNDS) {
        setCompleted(true);
        return currentRound;
      }

      const nextRound = currentRound + 1;
      setRound(generateRound(nextRound, runSeed));
      setTimeRemaining(ROUND_SECONDS);
      setSelectedSet(null);
      setFeedback(null);
      setLocked(false);
      return nextRound;
    });
  }, [runSeed]);

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

  function handleAnswer(diceSet: DiceSet) {
    if (locked || gameOver || completed) {
      return;
    }

    setLocked(true);
    setSelectedSet(diceSet.id);

    if (diceSet.id !== round.correctSetId) {
      loseLife("That set misses the target.");
      return;
    }

    const nextCombo = combo + 1;
    const earned = BASE_SCORE + (timeRemaining >= 7 ? SPEED_BONUS : 0);

    setCombo(nextCombo);
    setBestCombo((current) => Math.max(current, nextCombo));
    setScore((current) => current + earned);
    setFeedback({
      tone: "success",
      text:
        timeRemaining >= 7
          ? `Lightning answer! +${earned}`
          : `Correct! +${earned}`,
    });
    scheduleAdvance(850);
  }

  function restartGame() {
    if (transitionTimer.current !== null) {
      window.clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }

    const nextRunSeed = runSeed + 1;

    setRunSeed(nextRunSeed);
    setRoundNumber(1);
    setRound(generateRound(1, nextRunSeed));
    setLives(MAX_LIVES);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setTimeRemaining(ROUND_SECONDS);
    setLocked(false);
    setGameOver(false);
    setCompleted(false);
    setSelectedSet(null);
    setFeedback(null);
  }

  const timerPercent = (timeRemaining / ROUND_SECONDS) * 100;

  return (
    <div className="mx-auto w-full max-w-2xl">
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
          <div className="mb-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-violet-300">
              Hit the target
            </p>
            <div className="mt-2 text-7xl font-black tracking-[-0.06em] text-white sm:text-8xl">
              {round.target}
            </div>
            <p className="mt-3 text-sm text-neutral-400">
              Which dice set adds up to this number?
            </p>

            {combo >= 2 && (
              <div className="mt-4 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-sm font-black text-orange-300">
                COMBO ×{combo}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {round.sets.map((diceSet, index) => {
              const selected = selectedSet === diceSet.id;
              const correct = diceSet.id === round.correctSetId;
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
                  onClick={() => handleAnswer(diceSet)}
                  aria-label={`Set ${String.fromCharCode(65 + index)}: ${diceSet.values.join(", ")}`}
                  className={`min-h-36 rounded-3xl border p-4 transition sm:min-h-44 sm:p-5 ${stateStyle}`}
                >
                  <p className="mb-4 text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">
                    Set {String.fromCharCode(65 + index)}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
                    {diceSet.values.map((value, dieIndex) => (
                      <span
                        key={`${diceSet.id}-${dieIndex}`}
                        className="text-4xl leading-none text-white sm:text-5xl"
                        aria-hidden="true"
                      >
                        {DIE_SYMBOLS[value]}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {feedback && <FeedbackCard feedback={feedback} />}

          <div className="mt-5 flex items-center justify-between gap-4 text-xs text-neutral-500">
            <span>Fast answer bonus: +{SPEED_BONUS}</span>
            <span>Best combo: {bestCombo}</span>
          </div>
        </>
      )}

      {gameOver && (
        <ResultCard
          eyebrow="Run ended"
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
          eyebrow="10 rounds survived"
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
    <div role="status" className={`mt-5 rounded-2xl border p-4 text-center font-bold ${style}`}>
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
        <p className={`mt-4 text-xs font-black uppercase tracking-[0.25em] ${styles.eyebrow}`}>
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
