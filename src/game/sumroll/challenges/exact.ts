import {
  createChallengeRandom,
  getDifficulty,
  randomDie,
  shuffle,
} from "../difficulty";
import type {
  ChallengeValidation,
  ExactChallenge,
  GenerateChallengeOptions,
  SelectableDie,
} from "../types";

const CLEAN_SOLVE_BONUS = 100;

export function generateExactChallenge({
  round,
  runSeed,
}: GenerateChallengeOptions): ExactChallenge {
  const difficulty = getDifficulty(round);
  const random = createChallengeRandom("exact", round, runSeed);
  const dice: SelectableDie[] = Array.from(
    { length: difficulty.exactDiceCount },
    (_, index) => ({
      id: `die-${index}`,
      value: randomDie(random),
    }),
  );
  const solutionDice = shuffle(dice, random).slice(
    0,
    difficulty.exactRequiredCount,
  );
  const target = solutionDice.reduce((total, die) => total + die.value, 0);

  return {
    id: `exact-${runSeed}-${round}`,
    type: "exact",
    round,
    target,
    seconds: difficulty.seconds,
    dice: shuffle(dice, random),
    exactCount: difficulty.exactRequiredCount,
    solutionIds: solutionDice.map((die) => die.id),
  };
}

export function evaluateExactSelection(
  challenge: ExactChallenge,
  selectedIds: string[],
  deselections: number,
): ChallengeValidation {
  const selectedIdSet = new Set(selectedIds);
  const total = challenge.dice.reduce(
    (sum, die) => sum + (selectedIdSet.has(die.id) ? die.value : 0),
    0,
  );
  const sumCorrect = total === challenge.target;
  const countCorrect = selectedIds.length === challenge.exactCount;
  const correct = sumCorrect && countCorrect;

  return {
    correct,
    total,
    target: challenge.target,
    selectedCount: selectedIds.length,
    requiredCount: challenge.exactCount,
    sumCorrect,
    countCorrect,
    bonusPoints: correct && deselections === 0 ? CLEAN_SOLVE_BONUS : 0,
    reason: correct
      ? "correct"
      : sumCorrect
        ? "wrong-count"
        : countCorrect
          ? "wrong-total"
          : "wrong-total-and-count",
  };
}

export function canSelectExactDie(
  challenge: ExactChallenge,
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
