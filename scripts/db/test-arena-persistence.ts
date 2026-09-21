import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { serializeArenaChallenge } from "../../src/arena/challenges/serialize";
import { runTournamentAudit } from "../../src/arena/engine/audit";
import { createSimulatedProfiles, simulateRoundResponses } from "../../src/arena/engine/simulator";
import {
  advanceTournament,
  beginTournamentRound,
  createTournament,
  enterTournamentLobby,
  resolveTournamentRound,
  startTournament,
} from "../../src/arena/engine/tournament";
import { PIN3_DEMO_PRESET } from "../../src/arena/presets/pin3-demo";
import type { ArenaPlayer, TournamentState } from "../../src/arena/types";
import { closeDatabasePool, getDatabasePool } from "../../src/server/db/pool";
import { ArenaRepository } from "../../src/server/repositories/arena-repository";
import type {
  CreateParticipantRecord,
  StoredTournamentAggregate,
} from "../../src/server/arena/persistence-types";

const TEST_SEED = "PIN3-V2-PERSISTENCE";
const PRIVATE_CHALLENGE_KEYS = ["correctSetId", "solutionIds"];

function assertPersistedChallengeBoundary(
  aggregate: StoredTournamentAggregate,
): void {
  aggregate.rounds.forEach((round) => {
    const publicJson = JSON.stringify(round.publicChallenge);

    PRIVATE_CHALLENGE_KEYS.forEach((key) => {
      assert.equal(
        publicJson.includes(`\"${key}\"`),
        false,
        `Public round ${round.roundNumber} exposed ${key}.`,
      );
    });

    if (round.publicChallenge.type === "memory") {
      assert.equal(
        "target" in round.publicChallenge,
        false,
        `Public memory round ${round.roundNumber} exposed its target.`,
      );
    }

    assert.equal(round.serverChallenge.type, round.publicChallenge.type);
    assert.notEqual(round.serverChallenge.id, round.publicChallenge.id);
  });
}

function participantRecord(player: ArenaPlayer): CreateParticipantRecord {
  return {
    enginePlayerId: player.id,
    authUserId: null,
    displayName: player.displayName,
    role: "player",
    participantType: player.participantType,
    status: player.status,
    eliminatedRound: player.eliminatedRound,
    finalPlacement: player.finalPlacement,
    tieBreakValue: player.tieBreak,
  };
}

function isPostgresError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

async function expectDatabaseError(
  operation: () => Promise<unknown>,
  code: string,
  message: string,
): Promise<void> {
  try {
    await operation();
    assert.fail(message);
  } catch (error) {
    assert(isPostgresError(error, code), `${message} Received: ${String(error)}`);
  }
}

async function persistTournament(): Promise<{
  aggregate: StoredTournamentAggregate;
  finalState: TournamentState;
  expectedStateVersion: number;
}> {
  const pool = getDatabasePool();
  const repository = new ArenaRepository(pool);
  let state = startTournament(
    enterTournamentLobby(createTournament(PIN3_DEMO_PRESET, TEST_SEED)),
  );
  const profiles = createSimulatedProfiles(state);
  const created = await repository.createTournament({
    id: randomUUID(),
    joinCodeDigest: `test-${randomUUID()}`,
    hostUserId: null,
    preset: state.preset,
    status: state.status,
    currentRoundNumber: null,
    privateSeed: state.seed,
    participants: state.players.map(participantRecord),
  });
  const tournamentId = created.tournament.id;

  assert.equal(created.participants.length, 50);
  assert.equal(created.tournament.stateVersion, 1);

  const reloaded = await repository.getTournamentAggregate(tournamentId);
  assert.equal(reloaded.tournament.id, tournamentId);
  assert.deepEqual(reloaded.tournament.presetSnapshot, PIN3_DEMO_PRESET);
  assert.equal(reloaded.participants.length, 50);

  await expectDatabaseError(
    () => repository.addParticipant(tournamentId, participantRecord(state.players[0])),
    "23505",
    "Duplicate tournament participant was not rejected.",
  );

  let responseCount = 0;

  while (state.status !== "completed") {
    state = beginTournamentRound(state);
    const roundConfig = state.preset.rounds[state.roundIndex];
    const challenge = state.currentChallenge;
    assert(challenge, "The engine did not create a round challenge.");

    const openedAt = new Date();
    const roundRecord = await repository.createRound({
      tournamentId,
      roundNumber: roundConfig.number,
      challengeType: roundConfig.challengeType,
      status: "open",
      publicChallenge: serializeArenaChallenge(
        challenge,
        `round-${roundConfig.number}`,
      ),
      serverChallenge: challenge,
      opensAt: openedAt,
      deadlineAt: new Date(openedAt.getTime() + roundConfig.responseWindowMs),
      advancingCount: roundConfig.advancingPlayers,
    });

    if (roundConfig.number === 1) {
      await expectDatabaseError(
        () =>
          repository.createRound({
            tournamentId,
            roundNumber: roundConfig.number,
            challengeType: roundConfig.challengeType,
            status: "open",
            publicChallenge: serializeArenaChallenge(challenge, "duplicate-round"),
            serverChallenge: challenge,
            opensAt: openedAt,
            deadlineAt: new Date(openedAt.getTime() + roundConfig.responseWindowMs),
            advancingCount: roundConfig.advancingPlayers,
          }),
        "23505",
        "Duplicate tournament round number was not rejected.",
      );
    }

    const simulatedResponses = simulateRoundResponses(state, profiles);
    const participantByEngineId = new Map(
      created.participants.map((participant) => [
        participant.enginePlayerId,
        participant,
      ]),
    );

    for (const response of simulatedResponses) {
      const participant = participantByEngineId.get(response.playerId);
      assert(participant, `Missing stored participant ${response.playerId}.`);

      await repository.insertResponse({
        tournamentId,
        roundId: roundRecord.round.id,
        participantId: participant.id,
        answerPayload:
          response.responseMs === null ? { timeout: true } : { simulated: true },
        responseMs: response.responseMs,
        correct: response.correct,
        disposition: "accepted",
      });
      responseCount += 1;
    }

    if (roundConfig.number === 1) {
      const firstResponse = simulatedResponses[0];
      const firstParticipant = participantByEngineId.get(firstResponse.playerId);
      assert(firstParticipant);

      await expectDatabaseError(
        () =>
          repository.insertResponse({
            tournamentId,
            roundId: roundRecord.round.id,
            participantId: firstParticipant.id,
            answerPayload: { simulated: true },
            responseMs: firstResponse.responseMs,
            correct: firstResponse.correct,
            disposition: "accepted",
          }),
        "23505",
        "Duplicate round response was not rejected.",
      );
    }

    const resolved = resolveTournamentRound(state, simulatedResponses);
    const result = resolved.roundHistory.at(-1);
    assert(result, "The engine did not produce a round result.");
    const advanced = advanceTournament(resolved);

    await repository.persistRoundResult({
      tournamentId,
      roundId: roundRecord.round.id,
      result,
      nextTournamentStatus: advanced.status,
      nextRoundNumber: advanced.preset.rounds[advanced.roundIndex].number,
      players: advanced.players.map(participantRecord),
    });

    state = advanced;
  }

  const aggregate = await repository.getTournamentAggregate(tournamentId);
  const expectedStateVersion = 1 + state.preset.rounds.length + responseCount + state.preset.rounds.length;

  return { aggregate, finalState: state, expectedStateVersion };
}

async function main(): Promise<void> {
  const pool = getDatabasePool();
  const { aggregate, finalState, expectedStateVersion } = await persistTournament();
  const expectedAudit = runTournamentAudit(PIN3_DEMO_PRESET, TEST_SEED);
  const persistedHistory = aggregate.rounds.map((round) => round.resultSnapshot);
  const champion = aggregate.participants.find(
    (participant) => participant.status === "champion",
  );
  const expectedChampion = finalState.players.find(
    (participant) => participant.status === "champion",
  );

  assert.equal(aggregate.tournament.status, "completed");
  assert.equal(aggregate.tournament.stateVersion, expectedStateVersion);
  assert.equal(aggregate.rounds.length, 7);
  assert.equal(aggregate.responses.length, 128);
  assertPersistedChallengeBoundary(aggregate);
  assert.deepEqual(persistedHistory, finalState.roundHistory);
  assert.deepEqual(persistedHistory, expectedAudit.rounds);
  assert.equal(champion?.enginePlayerId, expectedChampion?.id);
  assert.equal(champion?.enginePlayerId, expectedAudit.championId);
  assert.equal(champion?.finalPlacement, 1);

  finalState.players.forEach((player) => {
    const stored = aggregate.participants.find(
      (participant) => participant.enginePlayerId === player.id,
    );
    assert(stored, `Participant ${player.id} did not survive reload.`);
    assert.equal(stored.status, player.status);
    assert.equal(stored.eliminatedRound, player.eliminatedRound);
    assert.equal(stored.finalPlacement, player.finalPlacement);
  });

  await expectDatabaseError(
    () =>
      pool.query(
        "update arena.tournament_events set event_type = 'changed' where id = $1",
        [aggregate.events[0].id],
      ),
    "P0001",
    "Historical tournament event mutation was not rejected.",
  );

  console.log(
    JSON.stringify(
      {
        tournamentCreatedAndReloaded: true,
        participantsPersisted: aggregate.participants.length,
        duplicateParticipantRejected: true,
        roundsPersisted: aggregate.rounds.length,
        duplicateRoundRejected: true,
        responsesPersisted: aggregate.responses.length,
        duplicateResponseRejected: true,
        challengeBoundaryPreserved: true,
        historySurvivedReload: true,
        deterministicRankingPreserved: true,
        champion: champion?.enginePlayerId,
        placementsSurvivedReload: true,
        stateVersion: aggregate.tournament.stateVersion,
        appendOnlyEventsEnforced: true,
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
