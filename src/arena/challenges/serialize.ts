import type {
  PublicArenaChallenge,
  ServerArenaChallenge,
} from "./types";

function assertNever(value: never): never {
  void value;
  throw new Error("Unsupported Arena challenge type.");
}

export function serializeArenaChallenge(
  challenge: ServerArenaChallenge,
  publicChallengeId: string,
): PublicArenaChallenge {
  if (challenge.type === "match") {
    return {
      id: publicChallengeId,
      type: "match",
      round: challenge.round,
      seconds: challenge.seconds,
      target: challenge.target,
      sets: challenge.sets.map((set) => ({
        id: set.id,
        values: [...set.values],
      })),
    };
  }

  if (challenge.type === "build") {
    return {
      id: publicChallengeId,
      type: "build",
      round: challenge.round,
      seconds: challenge.seconds,
      target: challenge.target,
      dice: challenge.dice.map((die) => ({ ...die })),
    };
  }

  if (challenge.type === "exact") {
    return {
      id: publicChallengeId,
      type: "exact",
      round: challenge.round,
      seconds: challenge.seconds,
      target: challenge.target,
      dice: challenge.dice.map((die) => ({ ...die })),
      exactCount: challenge.exactCount,
    };
  }

  if (challenge.type === "memory") {
    return {
      id: publicChallengeId,
      type: "memory",
      round: challenge.round,
      seconds: challenge.seconds,
      dice: [...challenge.dice],
      options: [...challenge.options],
      readyDurationMs: challenge.readyDurationMs,
      exposureDurationMs: challenge.exposureDurationMs,
      hiddenDurationMs: challenge.hiddenDurationMs,
      responseDurationMs: challenge.responseDurationMs,
    };
  }

  return assertNever(challenge);
}
