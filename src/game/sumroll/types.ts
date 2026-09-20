export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

export type ChallengeType = "match" | "build" | "exact";

export type PlayableChallengeType = ChallengeType;

export type SumRollModeType =
  | "classic"
  | "rush"
  | "memory"
  | "daily"
  | "arena";

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

export type ExactChallenge = ChallengeBase & {
  type: "exact";
  dice: SelectableDie[];
  exactCount: number;
  solutionIds: string[];
};

export type SumRollChallenge =
  | MatchChallenge
  | BuildChallenge
  | ExactChallenge;

export type ChallengeValidationReason =
  | "correct"
  | "wrong-total"
  | "wrong-count"
  | "wrong-total-and-count"
  | "invalid-answer";

export type ChallengeValidation = {
  correct: boolean;
  total: number;
  target: number;
  selectedCount: number;
  requiredCount: number | null;
  sumCorrect: boolean;
  countCorrect: boolean;
  bonusPoints: number;
  reason: ChallengeValidationReason;
};

export type ChallengeAnswer =
  | { type: "match"; setId: string }
  | { type: "build"; selectedIds: string[] }
  | { type: "exact"; selectedIds: string[]; deselections: number };

export type GenerateChallengeOptions = {
  round: number;
  runSeed: number;
};
