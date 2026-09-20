import type { DieValue, PlayableChallengeType } from "./types";

export type SumRollDifficulty = {
  seconds: number;
  matchDiceCount: number;
  buildDiceCount: number;
  buildSolutionSize: number;
};

export function getDifficulty(round: number): SumRollDifficulty {
  if (round <= 3) {
    return {
      seconds: 10,
      matchDiceCount: 3,
      buildDiceCount: 6,
      buildSolutionSize: 2,
    };
  }

  if (round <= 6) {
    return {
      seconds: 9,
      matchDiceCount: 4,
      buildDiceCount: 7,
      buildSolutionSize: 3,
    };
  }

  return {
    seconds: 8,
    matchDiceCount: 5,
    buildDiceCount: 8,
    buildSolutionSize: 4,
  };
}

export function createChallengeRandom(
  type: PlayableChallengeType,
  round: number,
  runSeed: number,
): () => number {
  const typeOffset = type === "match" ? 17 : 53;
  let state = (runSeed * 10_007 + round * 97 + typeOffset) >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function randomDie(random: () => number): DieValue {
  return (Math.floor(random() * 6) + 1) as DieValue;
}

export function shuffle<T>(values: T[], random: () => number): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}
