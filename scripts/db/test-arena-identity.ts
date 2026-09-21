import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { runArenaChallengeBoundaryAudit } from "../../src/arena/challenges/audit";
import { serializeArenaChallenge } from "../../src/arena/challenges/serialize";
import { runTournamentAudit } from "../../src/arena/engine/audit";
import { PIN3_DEMO_PRESET } from "../../src/arena/presets/pin3-demo";
import { generateChallenge } from "../../src/game/sumroll/engine";
import type {
  ChallengeAnswer,
  SumRollChallenge,
} from "../../src/game/sumroll/types";
import {
  ArenaAuthorizationError,
  canPerformArenaOperation,
} from "../../src/server/arena/authorization";
import {
  createArenaIdentity,
  type ArenaIdentity,
} from "../../src/server/arena/identity";
import type {
  CreateParticipantRecord,
  StoredParticipant,
} from "../../src/server/arena/persistence-types";
import {
  closeDatabasePool,
  getDatabasePool,
} from "../../src/server/db/pool";
import { ArenaRepository } from "../../src/server/repositories/arena-repository";
import {
  ArenaService,
  type JoinTournamentRequest,
  type SubmitArenaAnswerRequest,
} from "../../src/server/services/arena-service";

type TestTournament = {
  tournamentId: string;
  roundId: string;
  challenge: SumRollChallenge;
  participants: StoredParticipant[];
};

function participantRecord(
  enginePlayerId: string,
  subjectId: string,
  status: CreateParticipantRecord["status"] = "active",
): CreateParticipantRecord {
  return {
    enginePlayerId,
    authUserId: subjectId,
    displayName: enginePlayerId.toUpperCase(),
    role: "player",
    participantType: "human",
    status,
    eliminatedRound: status === "eliminated" ? 1 : null,
    finalPlacement: status === "eliminated" ? 3 : null,
    tieBreakValue: 100,
  };
}

function correctAnswer(challenge: SumRollChallenge): ChallengeAnswer {
  if (challenge.type === "match") {
    return { type: "match", setId: challenge.correctSetId };
  }

  if (challenge.type === "build") {
    return { type: "build", selectedIds: challenge.solutionIds };
  }

  if (challenge.type === "exact") {
    return {
      type: "exact",
      selectedIds: challenge.solutionIds,
      deselections: 0,
    };
  }

  return { type: "memory", total: challenge.target };
}

async function expectAuthorizationError(
  operation: () => Promise<unknown>,
  code: ArenaAuthorizationError["code"],
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    return error instanceof ArenaAuthorizationError && error.code === code;
  });
}

async function createOpenTournament(
  repository: ArenaRepository,
  hostSubjectId: string,
  participants: CreateParticipantRecord[],
  label: string,
): Promise<TestTournament> {
  const created = await repository.createTournament({
    id: randomUUID(),
    joinCodeDigest: `identity-${label}-${randomUUID()}`,
    hostUserId: hostSubjectId,
    preset: PIN3_DEMO_PRESET,
    status: "lobby",
    currentRoundNumber: null,
    privateSeed: `PIN3-V2.2A-${label}`,
    participants,
  });
  const challenge = generateChallenge("match", {
    round: 1,
    runSeed: label === "a" ? 22_001 : 22_002,
  });
  const opensAt = new Date(Date.now() - 250);
  const round = await repository.createRound({
    tournamentId: created.tournament.id,
    roundNumber: 1,
    challengeType: challenge.type,
    status: "open",
    publicChallenge: serializeArenaChallenge(
      challenge,
      `identity-public-${label}`,
    ),
    serverChallenge: challenge,
    opensAt,
    deadlineAt: new Date(opensAt.getTime() + 60_000),
    advancingCount: 25,
  });

  return {
    tournamentId: created.tournament.id,
    roundId: round.round.id,
    challenge,
    participants: created.participants,
  };
}

async function main(): Promise<void> {
  const pool = getDatabasePool();
  const repository = new ArenaRepository(pool);
  const service = new ArenaService(repository);
  const hostSubjectId = randomUUID();
  const playerASubjectId = randomUUID();
  const playerBSubjectId = randomUUID();
  const eliminatedSubjectId = randomUUID();
  const crossTournamentSubjectId = randomUUID();
  const unknownSubjectId = randomUUID();

  const tournamentA = await createOpenTournament(
    repository,
    hostSubjectId,
    [
      participantRecord("player-a", playerASubjectId),
      participantRecord("player-b", playerBSubjectId),
      participantRecord("player-eliminated", eliminatedSubjectId, "eliminated"),
    ],
    "a",
  );
  const tournamentB = await createOpenTournament(
    repository,
    randomUUID(),
    [participantRecord("player-cross", crossTournamentSubjectId)],
    "b",
  );

  const hostIdentity = createArenaIdentity(hostSubjectId, "anonymous");
  const playerAIdentity = createArenaIdentity(playerASubjectId, "anonymous");
  const playerBIdentity = createArenaIdentity(playerBSubjectId, "anonymous");
  const eliminatedIdentity = createArenaIdentity(
    eliminatedSubjectId,
    "anonymous",
  );
  const crossIdentity = createArenaIdentity(
    crossTournamentSubjectId,
    "anonymous",
  );
  const unknownIdentity = createArenaIdentity(unknownSubjectId, "anonymous");
  const answer = correctAnswer(tournamentA.challenge);
  const playerA = tournamentA.participants.find(
    (participant) => participant.authUserId === playerASubjectId,
  );
  const playerB = tournamentA.participants.find(
    (participant) => participant.authUserId === playerBSubjectId,
  );
  assert(playerA && playerB);

  const maliciousAnswerRequest = {
    tournamentId: tournamentA.tournamentId,
    roundId: tournamentA.roundId,
    answer,
    participantId: playerB.id,
  } as SubmitArenaAnswerRequest & { participantId: string };
  const playerAResponse = await service.submitOwnAnswer(
    playerAIdentity,
    maliciousAnswerRequest,
  );
  assert.equal(playerAResponse.participantId, playerA.id);
  assert.notEqual(playerAResponse.participantId, playerB.id);

  if (tournamentA.challenge.type !== "match") {
    throw new Error("Identity response test requires a Match challenge.");
  }

  const matchChallenge = tournamentA.challenge;
  const wrongSet = matchChallenge.sets.find(
    (set) => set.id !== matchChallenge.correctSetId,
  );
  assert(wrongSet);
  const playerBResponse = await service.submitOwnAnswer(
    playerBIdentity,
    {
      tournamentId: tournamentA.tournamentId,
      roundId: tournamentA.roundId,
      answer: { type: "match", setId: wrongSet.id },
      participantId: playerA.id,
      correct: true,
      responseMs: 0,
    } as SubmitArenaAnswerRequest & {
      participantId: string;
      correct: boolean;
      responseMs: number;
    },
  );
  assert.equal(playerBResponse.participantId, playerB.id);
  assert.equal(playerBResponse.correct, false);
  assert((playerBResponse.responseMs ?? 0) > 0);

  const resolvedPlayer = await service.getOwnParticipantState(
    createArenaIdentity(playerASubjectId, "email"),
    tournamentA.tournamentId,
  );
  assert.equal(resolvedPlayer.id, playerA.id);

  await expectAuthorizationError(
    () =>
      service.submitOwnAnswer(unknownIdentity, maliciousAnswerRequest),
    "participant-required",
  );
  await expectAuthorizationError(
    () =>
      service.submitOwnAnswer(eliminatedIdentity, {
        tournamentId: tournamentA.tournamentId,
        roundId: tournamentA.roundId,
        answer,
      }),
    "participant-inactive",
  );
  await expectAuthorizationError(
    () =>
      service.submitOwnAnswer(crossIdentity, {
        tournamentId: tournamentA.tournamentId,
        roundId: tournamentA.roundId,
        answer,
      }),
    "participant-required",
  );
  await expectAuthorizationError(
    () =>
      service.submitOwnAnswer(playerAIdentity, {
        tournamentId: tournamentB.tournamentId,
        roundId: tournamentB.roundId,
        answer: correctAnswer(tournamentB.challenge),
      }),
    "participant-required",
  );
  await expectAuthorizationError(
    () =>
      service.submitOwnAnswer(playerAIdentity, {
        tournamentId: tournamentA.tournamentId,
        roundId: tournamentA.roundId,
        answer,
      }),
    "response-already-submitted",
  );

  await expectAuthorizationError(
    () =>
      service.authorizeHostOperation(
        {
          ...playerBIdentity,
          role: "host",
        } as ArenaIdentity & { role: "host" },
        tournamentA.tournamentId,
        "start-tournament",
      ),
    "host-required",
  );
  assert.equal(
    await service.authorizeHostOperation(
      hostIdentity,
      tournamentA.tournamentId,
      "start-tournament",
    ),
    "host",
  );
  assert.equal(
    await service.resolveAuthorizationRole(
      unknownIdentity,
      tournamentA.tournamentId,
    ),
    "spectator",
  );
  assert.equal(canPerformArenaOperation("spectator", "submit-own-answer"), false);
  assert.equal(canPerformArenaOperation("spectator", "read-public-tournament"), true);

  const joinTournament = await repository.createTournament({
    id: randomUUID(),
    joinCodeDigest: `identity-join-${randomUUID()}`,
    hostUserId: randomUUID(),
    preset: PIN3_DEMO_PRESET,
    status: "lobby",
    currentRoundNumber: null,
    privateSeed: "PIN3-V2.2A-JOIN",
    participants: [],
  });
  const joiningIdentity = createArenaIdentity(randomUUID(), "anonymous");
  const maliciousJoinRequest = {
    tournamentId: joinTournament.tournament.id,
    displayName: "  Identity Player  ",
    role: "host",
    authUserId: hostSubjectId,
  } as JoinTournamentRequest & { role: "host"; authUserId: string };
  const joined = await service.joinTournament(
    joiningIdentity,
    maliciousJoinRequest,
  );
  assert.equal(joined.role, "player");
  assert.equal(joined.authUserId, joiningIdentity.subjectId);
  assert.equal(joined.displayName, "Identity Player");

  await assert.rejects(
    () =>
      repository.addParticipant(joinTournament.tournament.id, {
        enginePlayerId: `human-without-identity-${randomUUID()}`,
        authUserId: null,
        displayName: "No Identity",
        role: "player",
        participantType: "human",
        status: "active",
        eliminatedRound: null,
        finalPlacement: null,
        tieBreakValue: 1,
      }),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23514",
  );

  const boundaryAudit = runArenaChallengeBoundaryAudit();
  const deterministicAuditA = runTournamentAudit(
    PIN3_DEMO_PRESET,
    "PIN3-V2.2A-REGRESSION",
  );
  const deterministicAuditB = runTournamentAudit(
    PIN3_DEMO_PRESET,
    "PIN3-V2.2A-REGRESSION",
  );
  assert.equal(boundaryAudit.publicSerializationSafe, true);
  assert.deepEqual(deterministicAuditA, deterministicAuditB);

  console.log(
    JSON.stringify(
      {
        playerCannotSubmitForAnotherPlayer: true,
        playerCannotInvokeHostOperation: true,
        hostCanInvokeHostOperation: true,
        participantResolvedServerSide: true,
        unknownIdentityCannotImpersonate: true,
        eliminatedParticipantRejected: true,
        crossTournamentSubmissionRejected: true,
        clientRoleIgnored: true,
        serverComputedCorrectnessAndTiming: true,
        duplicateResponseProtectionPreserved: true,
        publicChallengeBoundaryPreserved: true,
        deterministicTournamentPreserved: true,
        humanIdentityConstraintEnforced: true,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDatabasePool);
