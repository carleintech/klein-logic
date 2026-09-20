import { createChallengeRandom, getDifficulty, randomDie } from "../difficulty";
import type {
  ChallengeEvaluation,
  DiceSet,
  DieValue,
  GenerateChallengeOptions,
  MatchChallenge,
} from "../types";

const SET_COUNT = 4;

function createDiceValues(count: number, random: () => number): DieValue[] {
  return Array.from({ length: count }, () => randomDie(random));
}

function diceKey(values: DieValue[]): string {
  return [...values].sort((a, b) => a - b).join("-");
}

export function sumDice(values: DieValue[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function generateMatchChallenge({
  round,
  runSeed,
}: GenerateChallengeOptions): MatchChallenge {
  const difficulty = getDifficulty(round);
  const random = createChallengeRandom("match", round, runSeed);
  const correctValues = createDiceValues(difficulty.matchDiceCount, random);
  const target = sumDice(correctValues);
  const correctIndex = Math.floor(random() * SET_COUNT);
  const usedSets = new Set([diceKey(correctValues)]);
  const sets: DiceSet[] = [];

  for (let index = 0; index < SET_COUNT; index += 1) {
    if (index === correctIndex) {
      sets.push({ id: `set-${index}`, values: correctValues });
      continue;
    }

    let values = createDiceValues(difficulty.matchDiceCount, random);
    let attempts = 0;

    while (
      (sumDice(values) === target || usedSets.has(diceKey(values))) &&
      attempts < 250
    ) {
      values = createDiceValues(difficulty.matchDiceCount, random);
      attempts += 1;
    }

    usedSets.add(diceKey(values));
    sets.push({ id: `set-${index}`, values });
  }

  return {
    id: `match-${runSeed}-${round}`,
    type: "match",
    round,
    target,
    seconds: difficulty.seconds,
    sets,
    correctSetId: `set-${correctIndex}`,
  };
}

export function evaluateMatchAnswer(
  challenge: MatchChallenge,
  setId: string,
): ChallengeEvaluation {
  const selectedSet = challenge.sets.find((set) => set.id === setId);

  return {
    correct: setId === challenge.correctSetId,
    total: selectedSet ? sumDice(selectedSet.values) : 0,
    target: challenge.target,
  };
}
