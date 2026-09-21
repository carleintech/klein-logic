import type {
  DiceSet,
  DieValue,
  SelectableDie,
  SumRollChallenge,
} from "../../game/sumroll/types";

export type ServerArenaChallenge = SumRollChallenge;

type PublicChallengeBase = {
  id: string;
  type: ServerArenaChallenge["type"];
  round: number;
  seconds: number;
};

export type PublicMatchArenaChallenge = PublicChallengeBase & {
  type: "match";
  target: number;
  sets: DiceSet[];
};

export type PublicBuildArenaChallenge = PublicChallengeBase & {
  type: "build";
  target: number;
  dice: SelectableDie[];
};

export type PublicExactArenaChallenge = PublicChallengeBase & {
  type: "exact";
  target: number;
  dice: SelectableDie[];
  exactCount: number;
};

export type PublicMemoryArenaChallenge = PublicChallengeBase & {
  type: "memory";
  dice: DieValue[];
  options: number[];
  readyDurationMs: number;
  exposureDurationMs: number;
  hiddenDurationMs: number;
  responseDurationMs: number;
};

export type PublicArenaChallenge =
  | PublicMatchArenaChallenge
  | PublicBuildArenaChallenge
  | PublicExactArenaChallenge
  | PublicMemoryArenaChallenge;
