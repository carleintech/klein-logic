import {
  createChallengeRandom,
  getDifficulty,
  randomDie,
  shuffle,
} from "../difficulty";
import type {
  BuildChallenge,
  ChallengeEvaluation,
  GenerateChallengeOptions,
  SelectableDie,
} from "../types";

export function generateBuildChallenge({
  round,
  runSeed,
}: GenerateChallengeOptions): BuildChallenge {
  const difficulty = getDifficulty(round);
  const random = createChallengeRandom("build", round, runSeed);
  const dice: SelectableDie[] = Array.from(
    { length: difficulty.buildDiceCount },
    (_, index) => ({
      id: `die-${index}`,
      value: randomDie(random),
    }),
  );
  const solutionDice = shuffle(dice, random).slice(
    0,
    difficulty.buildSolutionSize,
  );
  const target = solutionDice.reduce((total, die) => total + die.value, 0);

  return {
    id: `build-${runSeed}-${round}`,
    type: "build",
    round,
    target,
    seconds: difficulty.seconds,
    dice: shuffle(dice, random),
    solutionIds: solutionDice.map((die) => die.id),
  };
}

export function evaluateBuildSelection(
  challenge: BuildChallenge,
  selectedIds: string[],
): ChallengeEvaluation {
  const selectedIdSet = new Set(selectedIds);
  const total = challenge.dice.reduce(
    (sum, die) => sum + (selectedIdSet.has(die.id) ? die.value : 0),
    0,
  );

  return {
    correct: selectedIds.length > 0 && total === challenge.target,
    total,
    target: challenge.target,
  };
}
