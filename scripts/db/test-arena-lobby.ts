import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { runArenaChallengeBoundaryAudit } from "../../src/arena/challenges/audit";
import { runTournamentAudit } from "../../src/arena/engine/audit";
import { PIN3_DEMO_PRESET } from "../../src/arena/presets/pin3-demo";
import {
  generateLobbyJoinCode,
  LOBBY_JOIN_CODE_PATTERN,
  type PublicLobbyView,
} from "../../src/server/arena/lobby";
import { ArenaAuthorizationError } from "../../src/server/arena/authorization";
import { createArenaIdentity } from "../../src/server/arena/identity";
import { closeDatabasePool, getDatabasePool } from "../../src/server/db/pool";
import { ArenaRepository } from "../../src/server/repositories/arena-repository";
import { ArenaService } from "../../src/server/services/arena-service";

type DevelopmentCounts = {
  tournaments: number;
  participants: number;
  events: number;
};

async function developmentCounts(): Promise<DevelopmentCounts> {
  const pool = getDatabasePool();
  const result = await pool.query<{
    tournaments: string;
    participants: string;
    events: string;
  }>(`
    select
      count(distinct tournament.id) as tournaments,
      count(distinct participant.id) as participants,
      count(distinct event.id) as events
    from arena.tournaments as tournament
    left join arena.tournament_participants as participant
      on participant.tournament_id = tournament.id
    left join arena.tournament_events as event
      on event.tournament_id = tournament.id
    where tournament.public_join_code is not null
  `);

  return {
    tournaments: Number(result.rows[0].tournaments),
    participants: Number(result.rows[0].participants),
    events: Number(result.rows[0].events),
  };
}

async function expectArenaError(
  operation: () => Promise<unknown>,
  code: ArenaAuthorizationError["code"],
): Promise<void> {
  await assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof ArenaAuthorizationError && error.code === code,
  );
}

function assertPublicLobbyIsSafe(
  lobby: PublicLobbyView,
  privateValues: string[],
): void {
  const serialized = JSON.stringify(lobby);
  const forbiddenKeys = [
    "authUserId",
    "hostUserId",
    "subjectId",
    "privateSeed",
    "presetSnapshot",
    "correctSetId",
    "solutionIds",
    "serverChallenge",
    "futureChallenge",
    "tieBreakValue",
    "access_token",
    "refresh_token",
  ];

  forbiddenKeys.forEach((key) => {
    assert.equal(serialized.includes(key), false, `Public lobby exposed ${key}.`);
  });
  privateValues.forEach((value) => {
    assert.equal(
      serialized.includes(value),
      false,
      "Public lobby exposed a private identity or seed value.",
    );
  });
}

async function main(): Promise<void> {
  const pool = getDatabasePool();
  const repository = new ArenaRepository(pool);
  const before = await developmentCounts();
  const host = createArenaIdentity(randomUUID(), "anonymous");
  const player = createArenaIdentity(randomUUID(), "anonymous");
  const forgedHost = randomUUID();
  const service = new ArenaService(repository);

  const generatedCodes = new Set<string>();
  for (let index = 0; index < 256; index += 1) {
    const code = generateLobbyJoinCode();
    assert(LOBBY_JOIN_CODE_PATTERN.test(code));
    assert.equal(/[0O1I]/.test(code), false);
    generatedCodes.add(code);
  }
  assert(generatedCodes.size > 250, "Join-code randomness produced excessive collisions.");

  const created = await service.createLobby(host);
  assert.equal(created.status, "lobby");
  assert.equal(created.capacity, PIN3_DEMO_PRESET.playerCount);
  assert.equal(created.participantCount, 0);
  assert.equal(created.isHost, true);
  assert.equal(created.ownParticipant, null);
  assert(LOBBY_JOIN_CODE_PATTERN.test(created.joinCode));

  const createdAggregate = await repository.getLobbyAggregateByCode(
    created.joinCode,
  );
  assert(createdAggregate);
  assert.equal(createdAggregate.tournament.hostUserId, host.subjectId);
  assert.equal(createdAggregate.tournament.presetId, PIN3_DEMO_PRESET.id);
  assert.equal(createdAggregate.participants.length, 0);
  assert.equal(
    createdAggregate.events.some((event) => event.eventType === "lobby-created"),
    true,
  );

  const collisionRecoveryCode = generateLobbyJoinCode();
  const collisionCodes = [created.joinCode, collisionRecoveryCode];
  const collisionService = new ArenaService(repository, {
    generateJoinCode: () => collisionCodes.shift() ?? generateLobbyJoinCode(),
  });
  const secondLobby = await collisionService.createLobby(
    createArenaIdentity(randomUUID(), "anonymous"),
  );
  assert.equal(secondLobby.joinCode, collisionRecoveryCode);
  assert.notEqual(secondLobby.joinCode, created.joinCode);

  const maliciousJoinRequest = {
    joinCode: `  ${created.joinCode.toLowerCase()}  `,
    displayName: "  Alpha   Player  ",
    participantId: randomUUID(),
    hostUserId: forgedHost,
    role: "host",
    capacity: 500,
  };
  const firstJoin = await service.joinLobby(player, maliciousJoinRequest);
  assert.equal(firstJoin.outcome, "joined");
  assert.equal(firstJoin.lobby.participantCount, 1);
  assert.equal(firstJoin.lobby.ownParticipant?.displayName, "Alpha Player");
  assert.equal(firstJoin.lobby.isHost, false);
  assert.equal("role" in firstJoin.lobby, false);

  const rejoin = await service.joinLobby(player, {
    joinCode: created.joinCode,
    displayName: "Different Name",
  });
  assert.equal(rejoin.outcome, "rejoined_existing");
  assert.equal(rejoin.lobby.participantCount, 1);
  assert.equal(rejoin.lobby.ownParticipant?.displayName, "Alpha Player");

  await expectArenaError(
    () =>
      service.joinLobby(createArenaIdentity(randomUUID(), "anonymous"), {
        joinCode: "ZZZZZZ",
        displayName: "Unknown Player",
      }),
    "tournament-not-found",
  );
  await expectArenaError(
    () => service.getLobby(player, "bad-code"),
    "invalid-join-code",
  );

  for (const invalidName of [
    " ",
    "A",
    "A".repeat(25),
    "Bad\u0000Name",
    "Bad\tName",
  ]) {
    await expectArenaError(
      () =>
        service.joinLobby(createArenaIdentity(randomUUID(), "anonymous"), {
          joinCode: created.joinCode,
          displayName: invalidName,
        }),
      "invalid-display-name",
    );
  }

  await expectArenaError(
    () =>
      service.joinLobby(createArenaIdentity(randomUUID(), "anonymous"), {
        joinCode: created.joinCode,
        displayName: "alpha player",
      }),
    "display-name-taken",
  );

  const sameIdentityOtherTournament = await service.joinLobby(player, {
    joinCode: secondLobby.joinCode,
    displayName: "Alpha Player",
  });
  assert.equal(sameIdentityOtherTournament.outcome, "joined");

  await expectArenaError(
    () => service.startLobby(player, created.joinCode),
    "host-required",
  );
  await expectArenaError(
    () => service.cancelLobby(player, created.joinCode),
    "host-required",
  );
  await expectArenaError(
    () => service.startLobby(host, created.joinCode),
    "lobby-not-ready",
  );

  const secondHost = createArenaIdentity(
    (await repository.getLobbyAggregateByCode(secondLobby.joinCode))!.tournament
      .hostUserId!,
    "anonymous",
  );
  const cancelled = await service.cancelLobby(secondHost, secondLobby.joinCode);
  assert.equal(cancelled.status, "cancelled");
  await expectArenaError(
    () =>
      service.joinLobby(createArenaIdentity(randomUUID(), "anonymous"), {
        joinCode: secondLobby.joinCode,
        displayName: "Late Player",
      }),
    "tournament-not-joinable",
  );

  const duplicateLobby = await service.createLobby(
    createArenaIdentity(randomUUID(), "anonymous"),
  );
  const duplicateIdentity = createArenaIdentity(randomUUID(), "anonymous");
  const duplicateResults = await Promise.all([
    service.joinLobby(duplicateIdentity, {
      joinCode: duplicateLobby.joinCode,
      displayName: "Concurrent Player",
    }),
    service.joinLobby(duplicateIdentity, {
      joinCode: duplicateLobby.joinCode,
      displayName: "Concurrent Player",
    }),
  ]);
  assert.deepEqual(
    duplicateResults.map((result) => result.outcome).sort(),
    ["joined", "rejoined_existing"],
  );
  assert.equal(
    (await service.getLobby(duplicateIdentity, duplicateLobby.joinCode))
      .participantCount,
    1,
  );

  const displayNameLobby = await service.createLobby(
    createArenaIdentity(randomUUID(), "anonymous"),
  );
  const displayNameRace = await Promise.allSettled([
    service.joinLobby(createArenaIdentity(randomUUID(), "anonymous"), {
      joinCode: displayNameLobby.joinCode,
      displayName: "Shared Name",
    }),
    service.joinLobby(createArenaIdentity(randomUUID(), "anonymous"), {
      joinCode: displayNameLobby.joinCode,
      displayName: "shared name",
    }),
  ]);
  assert.equal(
    displayNameRace.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    displayNameRace.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof ArenaAuthorizationError &&
        result.reason.code === "display-name-taken",
    ).length,
    1,
  );

  const capacityHost = createArenaIdentity(randomUUID(), "anonymous");
  const capacityLobby = await service.createLobby(capacityHost);
  const capacityMember = createArenaIdentity(randomUUID(), "anonymous");
  for (let index = 1; index <= 49; index += 1) {
    const joiningIdentity =
      index === 1
        ? capacityMember
        : createArenaIdentity(randomUUID(), "anonymous");
    await service.joinLobby(joiningIdentity, {
      joinCode: capacityLobby.joinCode,
      displayName: `Player ${index.toString().padStart(2, "0")}`,
    });
  }

  const finalJoinAttempts = await Promise.allSettled([
    service.joinLobby(createArenaIdentity(randomUUID(), "anonymous"), {
      joinCode: capacityLobby.joinCode,
      displayName: "Final Alpha",
    }),
    service.joinLobby(createArenaIdentity(randomUUID(), "anonymous"), {
      joinCode: capacityLobby.joinCode,
      displayName: "Final Bravo",
    }),
  ]);
  assert.equal(
    finalJoinAttempts.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    finalJoinAttempts.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof ArenaAuthorizationError &&
        result.reason.code === "tournament-full",
    ).length,
    1,
  );
  const fullLobby = await service.getLobby(capacityHost, capacityLobby.joinCode);
  assert.equal(fullLobby.participantCount, 50);

  const nonHost = createArenaIdentity(randomUUID(), "anonymous");
  await expectArenaError(
    () => service.startLobby(nonHost, capacityLobby.joinCode),
    "host-required",
  );
  const started = await service.startLobby(capacityHost, capacityLobby.joinCode);
  assert.equal(started.status, "countdown");
  const reconnectAfterStart = await service.joinLobby(capacityMember, {
    joinCode: capacityLobby.joinCode,
    displayName: "Ignored Reconnect Name",
  });
  assert.equal(reconnectAfterStart.outcome, "rejoined_existing");
  assert.equal(reconnectAfterStart.lobby.participantCount, 50);
  assert.equal(reconnectAfterStart.lobby.ownParticipant?.displayName, "Player 01");
  await expectArenaError(
    () =>
      service.joinLobby(createArenaIdentity(randomUUID(), "anonymous"), {
        joinCode: capacityLobby.joinCode,
        displayName: "After Start",
      }),
    "tournament-not-joinable",
  );

  const safeView = await service.getLobby(player, created.joinCode);
  assertPublicLobbyIsSafe(safeView, [
    host.subjectId,
    player.subjectId,
    createdAggregate.tournament.privateSeed,
  ]);

  const startedAggregate = await repository.getLobbyAggregateByCode(
    capacityLobby.joinCode,
  );
  const cancelledAggregate = await repository.getLobbyAggregateByCode(
    secondLobby.joinCode,
  );
  assert(startedAggregate && cancelledAggregate);
  assert.equal(
    startedAggregate.events.some((event) => event.eventType === "lobby-started"),
    true,
  );
  assert.equal(
    startedAggregate.events.filter(
      (event) => event.eventType === "participant-joined",
    ).length,
    50,
  );
  assert.equal(
    cancelledAggregate.events.some(
      (event) => event.eventType === "lobby-cancelled",
    ),
    true,
  );

  const arenaServiceSource = await readFile(
    path.join(process.cwd(), "src", "server", "services", "arena-service.ts"),
    "utf8",
  );
  assert.equal(arenaServiceSource.includes("@supabase"), false);

  const challengeAudit = runArenaChallengeBoundaryAudit();
  const deterministicA = runTournamentAudit(
    PIN3_DEMO_PRESET,
    "PIN3-V2.3A-REGRESSION",
  );
  const deterministicB = runTournamentAudit(
    PIN3_DEMO_PRESET,
    "PIN3-V2.3A-REGRESSION",
  );
  assert.equal(challengeAudit.publicSerializationSafe, true);
  assert.deepEqual(deterministicA, deterministicB);

  const after = await developmentCounts();
  const added = {
    tournaments: after.tournaments - before.tournaments,
    participants: after.participants - before.participants,
    events: after.events - before.events,
  };

  console.log(
    JSON.stringify(
      {
        authenticatedHostCreatedLobby: true,
        hostIdentityDerivedServerSide: true,
        joinCodeFormatValid: true,
        joinCodeCollisionRetried: true,
        joinCodeNormalizationPassed: true,
        authenticatedPlayerJoined: true,
        unknownJoinCodeRejected: true,
        reconnectIdempotent: true,
        reconnectPreservedDisplayName: true,
        forgedParticipantAndHostFieldsIgnored: true,
        nonHostTransitionsRejected: true,
        hostStartAndCancelAuthorized: true,
        nonJoinableLobbyRejectedNewPlayer: true,
        capacityEnforced: true,
        concurrentFinalSlotNeverExceededCapacity: true,
        concurrentDuplicateJoinCreatedOneMembership: true,
        concurrentDisplayNameCollisionRejected: true,
        reconnectAfterStartResolvedExistingMembership: true,
        displayNameValidationPassed: true,
        tournamentScopedDisplayNameUniquenessPassed: true,
        multiTournamentMembershipPassed: true,
        publicLobbyProjectionSafe: true,
        auditEventsPersisted: true,
        providerBoundaryPreserved: true,
        challengePrivacyPreserved: true,
        deterministicTournamentPreserved: true,
        developmentDataAdded: added,
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
