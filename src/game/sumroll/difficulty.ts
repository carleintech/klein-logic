import type { DieValue, PlayableChallengeType } from "./types";

export type SumRollDifficulty = {
  seconds: number;
  matchDiceCount: number;
  buildDiceCount: number;
  buildSolutionSize: number;
  exactDiceCount: number;
  exactRequiredCount: number;
  memoryDiceCount: number;
  memoryReadyMs: number;
  memoryExposureMs: number;
  memoryHiddenMs: number;
  memoryResponseMs: number;
};

export function getDifficulty(round: number): SumRollDifficulty {
  if (round <= 3) {
    return {
      seconds: 10,
      matchDiceCount: 3,
      buildDiceCount: 6,
      buildSolutionSize: 2,
      exactDiceCount: 6,
      exactRequiredCount: round === 1 ? 2 : 3,
      memoryDiceCount: 3,
      memoryReadyMs: 800,
      memoryExposureMs: 1_600,
      memoryHiddenMs: 400,
      memoryResponseMs: 8_000,
    };
  }

  if (round <= 6) {
    return {
      seconds: 9,
      matchDiceCount: 4,
      buildDiceCount: 7,
      buildSolutionSize: 3,
      exactDiceCount: 7,
      exactRequiredCount: 3,
      memoryDiceCount: 4,
      memoryReadyMs: 700,
      memoryExposureMs: 1_400,
      memoryHiddenMs: 350,
      memoryResponseMs: 7_000,
    };
  }

  if (round <= 8) {
    return {
      seconds: 8,
      matchDiceCount: 5,
      buildDiceCount: 8,
      buildSolutionSize: 4,
      exactDiceCount: 8,
      exactRequiredCount: 4,
      memoryDiceCount: 5,
      memoryReadyMs: 650,
      memoryExposureMs: 1_200,
      memoryHiddenMs: 300,
      memoryResponseMs: 6_500,
    };
  }

  return {
    seconds: 7,
    matchDiceCount: 5,
    buildDiceCount: 8,
    buildSolutionSize: 4,
    exactDiceCount: 9,
    exactRequiredCount: 5,
    memoryDiceCount: 6,
    memoryReadyMs: 600,
    memoryExposureMs: 1_000,
    memoryHiddenMs: 250,
    memoryResponseMs: 6_000,
  };
}

export function createChallengeRandom(
  type: PlayableChallengeType,
  round: number,
  runSeed: number,
): () => number {
  const typeOffset =
    type === "match" ? 17 : type === "build" ? 53 : type === "exact" ? 89 : 127;
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
