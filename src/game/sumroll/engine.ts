import { generateBuildChallenge } from "./challenges/build";
import { generateMatchChallenge, sumDice } from "./challenges/match";
import type {
  GenerateChallengeOptions,
  PlayableChallengeType,
  SumRollChallenge,
} from "./types";

export * from "./challenges/build";
export * from "./challenges/match";
export * from "./difficulty";
export * from "./types";

export function generateChallenge(
  type: PlayableChallengeType,
  options: GenerateChallengeOptions,
): SumRollChallenge {
  return type === "match"
    ? generateMatchChallenge(options)
    : generateBuildChallenge(options);
}

// Compatibility exports for the first SumRoll Match implementation.
export const generateRound = (round: number, runSeed = 1) =>
  generateMatchChallenge({ round, runSeed });

export const getDiceSum = sumDice;
