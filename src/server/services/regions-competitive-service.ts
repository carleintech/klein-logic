import "server-only";

import type { ArenaIdentity } from "../arena/identity";
import type {
  ActiveRegionsAttempt,
  ClassicLeaderboardEntry,
  JourneyLeaderboardEntry,
  PreparedRegionsAttempt,
  RegionsCompetitiveMode,
  RegionsCompetitiveSubmission,
  TimeAttackLeaderboardEntry,
} from "../../game/competitive/types";
import { verifyRegionsCompletion } from "../../game/engine/verify-completion";
import { regionsPuzzles } from "../../game/puzzles";
import { getDatabasePool } from "../db/pool";
import {
  RegionsCompetitiveRepository,
  type StoredRegionsAttempt,
} from "../repositories/regions-competitive-repository";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RegionsCompetitiveErrorCode =
  | "profile-required"
  | "invalid-mode"
  | "invalid-puzzle"
  | "invalid-attempt"
  | "attempt-active"
  | "attempt-expired"
  | "attempt-finalized"
  | "invalid-proof"
  | "progress-mismatch";

export class RegionsCompetitiveError extends Error {
  constructor(public readonly code: RegionsCompetitiveErrorCode, message: string) {
    super(message);
    this.name = "RegionsCompetitiveError";
  }
}

function mapRepositoryError(error: unknown): never {
  if (error instanceof RegionsCompetitiveError) throw error;
  const value = error instanceof Error ? error.message : "";
  if (value === "profile-required") throw new RegionsCompetitiveError("profile-required", "Choose a player name before starting a ranked run.");
  if (value === "attempt-active") throw new RegionsCompetitiveError("attempt-active", "Finish or wait for the current ranked run before starting another.");
  if (value === "attempt-expired") throw new RegionsCompetitiveError("attempt-expired", "This ranked run has expired.");
  if (value === "attempt-finalized") throw new RegionsCompetitiveError("attempt-finalized", "This ranked run is already finished.");
  if (value === "attempt-not-found") throw new RegionsCompetitiveError("invalid-attempt", "This ranked run is unavailable.");
  throw error;
}

function validateMode(value: string): RegionsCompetitiveMode {
  if (value === "classic" || value === "journey" || value === "time-attack") return value;
  throw new RegionsCompetitiveError("invalid-mode", "Choose a supported ranked mode.");
}

function puzzleById(puzzleId: string | null | undefined) {
  const puzzle = regionsPuzzles.find((candidate) => candidate.id === puzzleId);
  if (!puzzle) throw new RegionsCompetitiveError("invalid-puzzle", "Choose a valid Regions puzzle.");
  return puzzle;
}

function toActivePublic(attempt: StoredRegionsAttempt): ActiveRegionsAttempt {
  const nextPuzzle = attempt.mode === "classic"
    ? attempt.puzzleId
    : regionsPuzzles[attempt.currentPuzzleIndex]?.id ?? null;
  return {
    attemptId: attempt.id,
    mode: attempt.mode,
    puzzleId: attempt.puzzleId,
    nextPuzzleId: nextPuzzle,
    nickname: attempt.nickname,
    status: attempt.status,
    acceptedBoards: attempt.acceptedBoards,
    startedAt: attempt.startedAt?.toISOString() ?? null,
    deadlineAt: attempt.deadlineAt?.toISOString() ?? null,
    trustedElapsedMs: attempt.trustedElapsedMs,
  };
}

export class RegionsCompetitiveService {
  constructor(private readonly repository = new RegionsCompetitiveRepository(getDatabasePool())) {}

  async prepare(identity: ArenaIdentity, request: { mode: string; puzzleId?: string }): Promise<PreparedRegionsAttempt> {
    const mode = validateMode(request.mode);
    const puzzleId = mode === "classic" ? puzzleById(request.puzzleId).id : null;
    try {
      const attempt = await this.repository.prepare(identity.subjectId, mode, puzzleId);
      return {
        attemptId: attempt.id,
        mode: attempt.mode,
        puzzleId: attempt.puzzleId,
        nickname: attempt.nickname,
        status: "prepared",
        preparedExpiresAt: attempt.preparedExpiresAt.toISOString(),
      };
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  async start(identity: ArenaIdentity, attemptId: string): Promise<ActiveRegionsAttempt> {
    if (!UUID_PATTERN.test(attemptId)) throw new RegionsCompetitiveError("invalid-attempt", "This ranked run is unavailable.");
    try {
      const attempt = await this.repository.start(identity.subjectId, attemptId);
      if (attempt.status === "expired") throw new RegionsCompetitiveError("attempt-expired", "This ranked run expired before it started.");
      return toActivePublic(attempt);
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  async submit(identity: ArenaIdentity, request: RegionsCompetitiveSubmission): Promise<ActiveRegionsAttempt> {
    if (!UUID_PATTERN.test(request.attemptId) || !UUID_PATTERN.test(request.submissionKey)) {
      throw new RegionsCompetitiveError("invalid-attempt", "This ranked submission is invalid.");
    }
    const attempt = await this.repository.getOwned(identity.subjectId, request.attemptId);
    if (!attempt) throw new RegionsCompetitiveError("invalid-attempt", "This ranked run is unavailable.");
    if (attempt.status !== "active") {
      const retry = await this.repository.getOwnedBySubmission(identity.subjectId, request.attemptId, request.submissionKey);
      if (retry) return toActivePublic(retry);
      throw new RegionsCompetitiveError("attempt-finalized", "This ranked run is no longer active.");
    }

    const expectedPuzzle = attempt.mode === "classic"
      ? puzzleById(attempt.puzzleId)
      : regionsPuzzles[attempt.currentPuzzleIndex];
    if (!expectedPuzzle || request.puzzleId !== expectedPuzzle.id) {
      throw new RegionsCompetitiveError("progress-mismatch", "That puzzle is not the next board in this ranked run.");
    }
    if (!verifyRegionsCompletion(expectedPuzzle, request.proof)) {
      throw new RegionsCompetitiveError("invalid-proof", "The submitted board is not a valid completed Regions solution.");
    }

    try {
      const accepted = await this.repository.acceptCompletion({
        subjectId: identity.subjectId,
        attemptId: request.attemptId,
        submissionKey: request.submissionKey,
        expectedPuzzleId: expectedPuzzle.id,
        expectedPuzzleIndex: attempt.currentPuzzleIndex,
        catalogSize: regionsPuzzles.length,
      });
      if (accepted.outcome === "expired") throw new RegionsCompetitiveError("attempt-expired", "The ranked submission arrived after the server deadline.");
      if (accepted.outcome === "finalized") throw new RegionsCompetitiveError("attempt-finalized", "This ranked run is already finished.");
      if (accepted.outcome === "progress-mismatch") throw new RegionsCompetitiveError("progress-mismatch", "The ranked run has already advanced.");
      return toActivePublic(accepted.attempt);
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  async finalizeExpired(identity: ArenaIdentity, attemptId: string): Promise<ActiveRegionsAttempt> {
    if (!UUID_PATTERN.test(attemptId)) throw new RegionsCompetitiveError("invalid-attempt", "This ranked run is unavailable.");
    try {
      return toActivePublic(await this.repository.finalizeExpired(identity.subjectId, attemptId));
    } catch (error) {
      mapRepositoryError(error);
    }
  }

  classicLeaderboard(puzzleId: string, limit = 50): Promise<ClassicLeaderboardEntry[]> {
    puzzleById(puzzleId);
    return this.repository.classicLeaderboard(puzzleId, Math.min(50, Math.max(1, Math.floor(limit))));
  }

  journeyLeaderboard(limit = 50): Promise<JourneyLeaderboardEntry[]> {
    return this.repository.journeyLeaderboard(Math.min(50, Math.max(1, Math.floor(limit))));
  }

  timeAttackLeaderboard(limit = 50): Promise<TimeAttackLeaderboardEntry[]> {
    return this.repository.timeAttackLeaderboard(Math.min(50, Math.max(1, Math.floor(limit))));
  }
}
