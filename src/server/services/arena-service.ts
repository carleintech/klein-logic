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
import {
  generateLobbyJoinCode,
  generateLobbyPrivateSeed,
  MULTIPLAYER_LOBBY_PRESET,
  normalizeLobbyDisplayName,
  normalizeLobbyJoinCode,
  type JoinLobbyResult,
  type PublicLobbyView,
} from "../arena/lobby";
import type {
  StoredParticipant,
  StoredResponse,
  StoredTournamentAggregate,
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

export type JoinLobbyRequest = {
  joinCode: string;
  displayName: string;
};

export type ArenaServiceOptions = {
  generateJoinCode?: () => string;
  generatePrivateSeed?: () => string;
};

function isPostgresError(
  error: unknown,
  code: string,
): error is { code: string; constraint?: unknown } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function createTieBreakValue(tournamentId: string, subjectId: string): number {
  return createHash("sha256")
    .update(`${tournamentId}:${subjectId}`)
    .digest()
    .readUInt32BE(0);
}

function normalizeJoinCodeOrThrow(joinCode: string): string {
  try {
    return normalizeLobbyJoinCode(joinCode);
  } catch {
    throw new ArenaAuthorizationError(
      "invalid-join-code",
      "The lobby join code is invalid.",
    );
  }
}

function normalizeDisplayNameOrThrow(displayName: string): string {
  try {
    return normalizeLobbyDisplayName(displayName);
  } catch (error) {
    throw new ArenaAuthorizationError(
      "invalid-display-name",
      error instanceof Error ? error.message : "The display name is invalid.",
    );
  }
}

function serializePublicLobby(
  aggregate: StoredTournamentAggregate,
  identity: ArenaIdentity,
): PublicLobbyView {
  const joinCode = aggregate.tournament.publicJoinCode;

  if (!joinCode) {
    throw new Error("A multiplayer lobby must have a public join code.");
  }

  const ownParticipant = aggregate.participants.find(
    (participant) => participant.authUserId === identity.subjectId,
  );

  return {
    joinCode,
    stateVersion: aggregate.tournament.stateVersion,
    presetId: aggregate.tournament.presetId,
    presetName: aggregate.tournament.presetSnapshot.name,
    status: aggregate.tournament.status,
    capacity: aggregate.tournament.capacity,
    participantCount: aggregate.participants.length,
    participants: aggregate.participants.map((participant) => ({
      displayName: participant.displayName,
      status: participant.status,
    })),
    isHost: aggregate.tournament.hostUserId === identity.subjectId,
    ownParticipant: ownParticipant
      ? {
          displayName: ownParticipant.displayName,
          status: ownParticipant.status,
          joinedAt: ownParticipant.joinedAt.toISOString(),
        }
      : null,
  };
}

export class ArenaService {
  private readonly generateJoinCode: () => string;
  private readonly generatePrivateSeed: () => string;

  constructor(
    private readonly repository: ArenaRepository,
    options: ArenaServiceOptions = {},
  ) {
    this.generateJoinCode = options.generateJoinCode ?? generateLobbyJoinCode;
    this.generatePrivateSeed =
      options.generatePrivateSeed ?? generateLobbyPrivateSeed;
  }

  async createLobby(identity: ArenaIdentity): Promise<PublicLobbyView> {
    const privateSeed = this.generatePrivateSeed();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const joinCode = normalizeJoinCodeOrThrow(this.generateJoinCode());

      try {
        const aggregate = await this.repository.createLobby({
          publicJoinCode: joinCode,
          joinCodeDigest: createHash("sha256").update(joinCode).digest("hex"),
          hostSubjectId: identity.subjectId,
          preset: MULTIPLAYER_LOBBY_PRESET,
          privateSeed,
        });

        return serializePublicLobby(aggregate, identity);
      } catch (error) {
        const isJoinCodeCollision =
          isPostgresError(error, "23505") &&
          "constraint" in error &&
          (error.constraint === "tournaments_public_join_code_unique" ||
            error.constraint === "tournaments_join_code_digest_key");

        if (!isJoinCodeCollision || attempt === 7) {
          throw error;
        }
      }
    }

    throw new Error("Unable to allocate a unique lobby join code.");
  }

  async joinLobby(
    identity: ArenaIdentity,
    request: JoinLobbyRequest,
  ): Promise<JoinLobbyResult> {
    const joinCode = normalizeJoinCodeOrThrow(request.joinCode);
    const result = await this.repository.joinLobbyForIdentity({
      publicJoinCode: joinCode,
      subjectId: identity.subjectId,
      enginePlayerId: `human-${randomUUID()}`,
      displayName: normalizeDisplayNameOrThrow(request.displayName),
      tieBreakValue: createTieBreakValue(joinCode, identity.subjectId),
    });
    const aggregate = await this.repository.getTournamentAggregate(
      result.tournamentId,
    );

    return {
      outcome: result.outcome,
      lobby: serializePublicLobby(aggregate, identity),
    };
  }

  async getLobby(
    identity: ArenaIdentity,
    joinCodeInput: string,
  ): Promise<PublicLobbyView> {
    const joinCode = normalizeJoinCodeOrThrow(joinCodeInput);
    const aggregate = await this.repository.getLobbyAggregateByCode(joinCode);

    if (!aggregate) {
      throw new ArenaAuthorizationError(
        "tournament-not-found",
        "The requested lobby was not found.",
      );
    }

    return serializePublicLobby(aggregate, identity);
  }

  async startLobby(
    identity: ArenaIdentity,
    joinCodeInput: string,
  ): Promise<PublicLobbyView> {
    const joinCode = normalizeJoinCodeOrThrow(joinCodeInput);
    const aggregate = await this.repository.getLobbyAggregateByCode(joinCode);

    if (!aggregate) {
      throw new ArenaAuthorizationError(
        "tournament-not-found",
        "The requested lobby was not found.",
      );
    }

    await this.authorizeHostOperation(
      identity,
      aggregate.tournament.id,
      "start-tournament",
    );
    const tournamentId = await this.repository.transitionLobby({
      publicJoinCode: joinCode,
      hostSubjectId: identity.subjectId,
      transition: "start",
    });

    return serializePublicLobby(
      await this.repository.getTournamentAggregate(tournamentId),
      identity,
    );
  }

  async cancelLobby(
    identity: ArenaIdentity,
    joinCodeInput: string,
  ): Promise<PublicLobbyView> {
    const joinCode = normalizeJoinCodeOrThrow(joinCodeInput);
    const aggregate = await this.repository.getLobbyAggregateByCode(joinCode);

    if (!aggregate) {
      throw new ArenaAuthorizationError(
        "tournament-not-found",
        "The requested lobby was not found.",
      );
    }

    await this.authorizeHostOperation(
      identity,
      aggregate.tournament.id,
      "cancel-tournament",
    );
    const tournamentId = await this.repository.transitionLobby({
      publicJoinCode: joinCode,
      hostSubjectId: identity.subjectId,
      transition: "cancel",
    });

    return serializePublicLobby(
      await this.repository.getTournamentAggregate(tournamentId),
      identity,
    );
  }

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
      displayName: normalizeDisplayNameOrThrow(request.displayName),
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
