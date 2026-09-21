import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { validateChallenge } from "../../game/sumroll/engine";
import type { ChallengeAnswer } from "../../game/sumroll/types";
import {
  ArenaAuthorizationError,
  canPerformArenaOperation,
  type ArenaAuthorizationRole,
  type ArenaOperation,
} from "../arena/authorization";
import type { ArenaIdentity } from "../arena/identity";
import type {
  StoredParticipant,
  StoredResponse,
} from "../arena/persistence-types";
import { ArenaRepository } from "../repositories/arena-repository";

type HostOperation = Extract<
  ArenaOperation,
  "start-tournament" | "cancel-tournament" | "administer-tournament"
>;

export type JoinTournamentRequest = {
  tournamentId: string;
  displayName: string;
};

export type SubmitArenaAnswerRequest = {
  tournamentId: string;
  roundId: string;
  answer: ChallengeAnswer;
};

function isPostgresError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function normalizeDisplayName(displayName: string): string {
  const normalized = displayName.trim().replace(/\s+/g, " ");

  if (normalized.length < 2 || normalized.length > 24) {
    throw new Error("Display name must contain between 2 and 24 characters.");
  }

  return normalized;
}

function createTieBreakValue(tournamentId: string, subjectId: string): number {
  return createHash("sha256")
    .update(`${tournamentId}:${subjectId}`)
    .digest()
    .readUInt32BE(0);
}

export class ArenaService {
  constructor(private readonly repository: ArenaRepository) {}

  async resolveAuthorizationRole(
    identity: ArenaIdentity,
    tournamentId: string,
  ): Promise<ArenaAuthorizationRole> {
    const tournament = await this.repository.getTournament(tournamentId);

    if (!tournament) {
      throw new ArenaAuthorizationError(
        "tournament-not-found",
        "The requested tournament was not found.",
      );
    }

    if (tournament.hostUserId === identity.subjectId) {
      return "host";
    }

    const participant = await this.repository.getParticipantBySubject(
      tournamentId,
      identity.subjectId,
    );

    return participant ? "player" : "spectator";
  }

  async authorizeHostOperation(
    identity: ArenaIdentity,
    tournamentId: string,
    operation: HostOperation,
  ): Promise<"host"> {
    const role = await this.resolveAuthorizationRole(identity, tournamentId);

    if (role !== "host" || !canPerformArenaOperation(role, operation)) {
      throw new ArenaAuthorizationError(
        "host-required",
        "Only the persisted tournament host may perform this operation.",
      );
    }

    return "host";
  }

  async joinTournament(
    identity: ArenaIdentity,
    request: JoinTournamentRequest,
  ): Promise<StoredParticipant> {
    const result = await this.repository.addParticipantForIdentity({
      tournamentId: request.tournamentId,
      subjectId: identity.subjectId,
      enginePlayerId: `human-${randomUUID()}`,
      displayName: normalizeDisplayName(request.displayName),
      tieBreakValue: createTieBreakValue(
        request.tournamentId,
        identity.subjectId,
      ),
    });

    return result.participant;
  }

  async getOwnParticipantState(
    identity: ArenaIdentity,
    tournamentId: string,
  ): Promise<StoredParticipant> {
    const participant = await this.repository.getParticipantBySubject(
      tournamentId,
      identity.subjectId,
    );

    if (!participant) {
      throw new ArenaAuthorizationError(
        "participant-required",
        "The authenticated identity does not own a tournament participant.",
      );
    }

    return participant;
  }

  async submitOwnAnswer(
    identity: ArenaIdentity,
    request: SubmitArenaAnswerRequest,
  ): Promise<StoredResponse> {
    const [participant, round] = await Promise.all([
      this.repository.getParticipantBySubject(
        request.tournamentId,
        identity.subjectId,
      ),
      this.repository.getRound(request.tournamentId, request.roundId),
    ]);

    if (!participant) {
      throw new ArenaAuthorizationError(
        "participant-required",
        "The authenticated identity does not own a tournament participant.",
      );
    }

    if (participant.status !== "active") {
      throw new ArenaAuthorizationError(
        "participant-inactive",
        "Only an active participant may submit an Arena response.",
      );
    }

    if (!round || round.status !== "open") {
      throw new ArenaAuthorizationError(
        "round-not-open",
        "The requested tournament round is not open.",
      );
    }

    const validation = validateChallenge(round.serverChallenge, request.answer);

    try {
      const result = await this.repository.insertResponseForIdentity({
        tournamentId: request.tournamentId,
        roundId: request.roundId,
        subjectId: identity.subjectId,
        answerPayload: request.answer,
        correct: validation.correct,
      });

      return result.response;
    } catch (error) {
      if (isPostgresError(error, "23505")) {
        throw new ArenaAuthorizationError(
          "response-already-submitted",
          "This participant already submitted a response for the round.",
        );
      }

      throw error;
    }
  }
}
