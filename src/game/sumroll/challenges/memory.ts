import {
  createChallengeRandom,
  getDifficulty,
  randomDie,
  shuffle,
} from "../difficulty";
import type {
  ChallengeValidation,
  DieValue,
  GenerateChallengeOptions,
  MemoryChallenge,
} from "../types";
import { sumDice } from "./match";

const OPTION_COUNT = 4;

function createOptions(
  target: number,
  diceCount: number,
  random: () => number,
): number[] {
  const minimum = diceCount;
  const maximum = diceCount * 6;
  const options = new Set<number>([target]);
  const offsets = shuffle([-3, -2, -1, 1, 2, 3, -4, 4], random);

  for (const offset of offsets) {
    const candidate = target + offset;

    if (candidate >= minimum && candidate <= maximum) {
      options.add(candidate);
    }

    if (options.size === OPTION_COUNT) {
      break;
    }
  }

  for (let candidate = minimum; options.size < OPTION_COUNT; candidate += 1) {
    if (candidate <= maximum) {
      options.add(candidate);
    }
  }

  return shuffle([...options], random);
}

export function generateMemoryChallenge({
  round,
  runSeed,
}: GenerateChallengeOptions): MemoryChallenge {
  const difficulty = getDifficulty(round);
  const random = createChallengeRandom("memory", round, runSeed);
  const dice: DieValue[] = Array.from(
    { length: difficulty.memoryDiceCount },
    () => randomDie(random),
  );
  const target = sumDice(dice);

  return {
    id: `memory-${runSeed}-${round}`,
    type: "memory",
    round,
    target,
    seconds: Math.ceil(difficulty.memoryResponseMs / 1_000),
    dice,
    options: createOptions(target, dice.length, random),
    readyDurationMs: difficulty.memoryReadyMs,
    exposureDurationMs: difficulty.memoryExposureMs,
    hiddenDurationMs: difficulty.memoryHiddenMs,
    responseDurationMs: difficulty.memoryResponseMs,
  };
}

export function evaluateMemoryAnswer(
  challenge: MemoryChallenge,
  total: number,
): ChallengeValidation {
  const isOfferedAnswer = challenge.options.includes(total);
  const correct = isOfferedAnswer && total === challenge.target;

  return {
    correct,
    total,
    target: challenge.target,
    selectedCount: 1,
    requiredCount: null,
    sumCorrect: correct,
    countCorrect: true,
    bonusPoints: 0,
    reason: !isOfferedAnswer
      ? "invalid-answer"
      : correct
        ? "correct"
        : "wrong-total",
  };
}
