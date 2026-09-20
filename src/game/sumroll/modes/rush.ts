import { generateChallenge, validateChallenge } from "../engine";
import type {
  ChallengeAnswer,
  ChallengeValidation,
  PlayableChallengeType,
  SumRollChallenge,
} from "../types";

export const RUSH_DURATION_MS = 60_000;
export const RUSH_WRONG_PENALTY_MS = 3_000;
export const RUSH_SKIP_PENALTY_MS = 2_000;
export const RUSH_BASE_SCORE = 200;
export const RUSH_FAST_BONUS = 100;
export const RUSH_FAST_THRESHOLD_MS = 3_000;

export type RushSession = {
  seed: number;
  status: "playing" | "complete";
  remainingMs: number;
  challengeIndex: number;
  challenge: SumRollChallenge;
  score: number;
  solved: number;
  attempts: number;
  skipped: number;
  combo: number;
  bestCombo: number;
  totalResponseMs: number;
  fastestResponseMs: number | null;
};

export type RushResolution = {
  session: RushSession;
  validation: ChallengeValidation;
  points: number;
  penaltyMs: number;
  multiplier: number;
};

export type RushResults = {
  score: number;
  solved: number;
  attempted: number;
  skipped: number;
  accuracyPercent: number;
  bestCombo: number;
  averageResponseMs: number | null;
  fastestResponseMs: number | null;
};

export function getRushComboMultiplier(combo: number): number {
  if (combo >= 10) {
    return 5;
  }

  if (combo >= 8) {
    return 4;
  }

  if (combo >= 5) {
    return 3;
  }

  if (combo >= 3) {
    return 2;
  }

  return 1;
}

export function createRushSession(seed: number): RushSession {
  return {
    seed,
    status: "playing",
    remainingMs: RUSH_DURATION_MS,
    challengeIndex: 0,
    challenge: createRushChallenge(seed, 0, 0),
    score: 0,
    solved: 0,
    attempts: 0,
    skipped: 0,
    combo: 0,
    bestCombo: 0,
    totalResponseMs: 0,
    fastestResponseMs: null,
  };
}

export function tickRushSession(
  session: RushSession,
  elapsedMs: number,
): RushSession {
  if (session.status === "complete" || elapsedMs <= 0) {
    return session;
  }

  const remainingMs = Math.max(0, session.remainingMs - elapsedMs);

  return {
    ...session,
    remainingMs,
    status: remainingMs === 0 ? "complete" : "playing",
  };
}

export function submitRushAnswer(
  session: RushSession,
  answer: ChallengeAnswer,
  responseMs: number,
): RushResolution {
  const validation = validateChallenge(session.challenge, answer);
  const normalizedResponseMs = Math.max(0, Math.round(responseMs));
  const attempts = session.attempts + 1;
  const totalResponseMs = session.totalResponseMs + normalizedResponseMs;
  if (!validation.correct) {
    const penalized = applyRushPenalty(session, RUSH_WRONG_PENALTY_MS);
    const nextSession = advanceRushChallenge({
      ...penalized,
      attempts,
      combo: 0,
      totalResponseMs,
    });

    return {
      session: nextSession,
      validation,
      points: 0,
      penaltyMs: RUSH_WRONG_PENALTY_MS,
      multiplier: 1,
    };
  }

  const combo = session.combo + 1;
  const fastestResponseMs =
    session.fastestResponseMs === null
      ? normalizedResponseMs
      : Math.min(session.fastestResponseMs, normalizedResponseMs);
  const multiplier = getRushComboMultiplier(combo);
  const fastBonus =
    normalizedResponseMs <= RUSH_FAST_THRESHOLD_MS ? RUSH_FAST_BONUS : 0;
  const points = (RUSH_BASE_SCORE + fastBonus) * multiplier;
  const nextSession = advanceRushChallenge({
    ...session,
    attempts,
    solved: session.solved + 1,
    combo,
    bestCombo: Math.max(session.bestCombo, combo),
    score: session.score + points,
    totalResponseMs,
    fastestResponseMs,
  });

  return {
    session: nextSession,
    validation,
    points,
    penaltyMs: 0,
    multiplier,
  };
}

export function skipRushChallenge(session: RushSession): RushSession {
  const penalized = applyRushPenalty(session, RUSH_SKIP_PENALTY_MS);

  return advanceRushChallenge({
    ...penalized,
    skipped: session.skipped + 1,
    combo: 0,
  });
}

export function getRushResults(session: RushSession): RushResults {
  return {
    score: session.score,
    solved: session.solved,
    attempted: session.attempts,
    skipped: session.skipped,
    accuracyPercent:
      session.attempts === 0
        ? 0
        : Math.round((session.solved / session.attempts) * 100),
    bestCombo: session.bestCombo,
    averageResponseMs:
      session.attempts === 0
        ? null
        : Math.round(session.totalResponseMs / session.attempts),
    fastestResponseMs: session.fastestResponseMs,
  };
}

function applyRushPenalty(session: RushSession, penaltyMs: number): RushSession {
  const remainingMs = Math.max(0, session.remainingMs - penaltyMs);

  return {
    ...session,
    remainingMs,
    status: remainingMs === 0 ? "complete" : session.status,
  };
}

function advanceRushChallenge(session: RushSession): RushSession {
  if (session.status === "complete") {
    return session;
  }

  const nextIndex = session.challengeIndex + 1;
  const elapsedSeconds = (RUSH_DURATION_MS - session.remainingMs) / 1_000;

  return {
    ...session,
    challengeIndex: nextIndex,
    challenge: createRushChallenge(session.seed, nextIndex, elapsedSeconds),
  };
}

function createRushChallenge(
  seed: number,
  challengeIndex: number,
  elapsedSeconds: number,
): SumRollChallenge {
  const plan = getRushChallengePlan(elapsedSeconds, challengeIndex);

  return generateChallenge(plan.type, {
    round: plan.difficultyRound,
    runSeed: seed * 1_000 + challengeIndex + 1,
  });
}

function getRushChallengePlan(
  elapsedSeconds: number,
  challengeIndex: number,
): { type: PlayableChallengeType; difficultyRound: number } {
  if (elapsedSeconds < 15) {
    return {
      type: challengeIndex % 3 === 2 ? "build" : "match",
      difficultyRound: Math.min(3, 1 + Math.floor(elapsedSeconds / 5)),
    };
  }

  if (elapsedSeconds < 30) {
    return {
      type: "build",
      difficultyRound: Math.min(6, 4 + Math.floor((elapsedSeconds - 15) / 5)),
    };
  }

  if (elapsedSeconds < 45) {
    return {
      type: challengeIndex % 2 === 0 ? "build" : "exact",
      difficultyRound: elapsedSeconds < 38 ? 7 : 8,
    };
  }

  const lateTypes: PlayableChallengeType[] = [
    "exact",
    "exact",
    "match",
    "build",
  ];

  return {
    type: lateTypes[challengeIndex % lateTypes.length],
    difficultyRound: elapsedSeconds < 53 ? 9 : 10,
  };
}
