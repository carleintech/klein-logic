import {
  evaluateBuildSelection,
  generateBuildChallenge,
} from "./challenges/build";
import {
  evaluateExactSelection,
  generateExactChallenge,
} from "./challenges/exact";
import {
  evaluateMatchAnswer,
  generateMatchChallenge,
  sumDice,
} from "./challenges/match";
import {
  evaluateMemoryAnswer,
  generateMemoryChallenge,
} from "./challenges/memory";
import type {
  ChallengeAnswer,
  ChallengeValidation,
  GenerateChallengeOptions,
  PlayableChallengeType,
  SumRollChallenge,
} from "./types";

export * from "./challenges/build";
export * from "./challenges/exact";
export * from "./challenges/match";
export * from "./challenges/memory";
export * from "./difficulty";
export * from "./types";

export function generateChallenge(
  type: PlayableChallengeType,
  options: GenerateChallengeOptions,
): SumRollChallenge {
  if (type === "match") {
    return generateMatchChallenge(options);
  }

  if (type === "build") {
    return generateBuildChallenge(options);
  }

  if (type === "memory") {
    return generateMemoryChallenge(options);
  }

  return generateExactChallenge(options);
}

export function validateChallenge(
  challenge: SumRollChallenge,
  answer: ChallengeAnswer,
): ChallengeValidation {
  if (challenge.type === "match" && answer.type === "match") {
    return evaluateMatchAnswer(challenge, answer.setId);
  }

  if (challenge.type === "build" && answer.type === "build") {
    return evaluateBuildSelection(challenge, answer.selectedIds);
  }

  if (challenge.type === "exact" && answer.type === "exact") {
    return evaluateExactSelection(
      challenge,
      answer.selectedIds,
      answer.deselections,
    );
  }

  if (challenge.type === "memory" && answer.type === "memory") {
    return evaluateMemoryAnswer(challenge, answer.total);
  }

  return {
    correct: false,
    total: 0,
    target: challenge.target,
    selectedCount: 0,
    requiredCount: challenge.type === "exact" ? challenge.exactCount : null,
    sumCorrect: false,
    countCorrect: false,
    bonusPoints: 0,
    reason: "invalid-answer",
  };
}

// Compatibility exports for the first SumRoll Match implementation.
export const generateRound = (round: number, runSeed = 1) =>
  generateMatchChallenge({ round, runSeed });

export const getDiceSum = sumDice;
