export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

export type ChallengeType = "match" | "build" | "exact" | "rush" | "memory";

export type PlayableChallengeType = Extract<ChallengeType, "match" | "build">;

export type DiceSet = {
  id: string;
  values: DieValue[];
};

export type SelectableDie = {
  id: string;
  value: DieValue;
};

type ChallengeBase = {
  id: string;
  round: number;
  target: number;
  seconds: number;
};

export type MatchChallenge = ChallengeBase & {
  type: "match";
  sets: DiceSet[];
  correctSetId: string;
};

export type BuildChallenge = ChallengeBase & {
  type: "build";
  dice: SelectableDie[];
  solutionIds: string[];
};

export type SumRollChallenge = MatchChallenge | BuildChallenge;

export type ChallengeEvaluation = {
  correct: boolean;
  total: number;
  target: number;
};

export type GenerateChallengeOptions = {
  round: number;
  runSeed: number;
};
