import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { RegionsCompetitiveMode } from "../../src/game/competitive/types";
import { solvePuzzle } from "../../src/game/engine/solver";
import { regionsPuzzles } from "../../src/game/puzzles";
import { createArenaIdentity, type ArenaIdentity } from "../../src/server/arena/identity";
import { closeDatabasePool, getDatabasePool } from "../../src/server/db/pool";
import { RegionsCompetitiveError, RegionsCompetitiveService } from "../../src/server/services/regions-competitive-service";
import { PlayerService } from "../../src/server/services/player-service";

const pool = getDatabasePool();
const competitive = new RegionsCompetitiveService();
const players = new PlayerService();

function proofFor(index: number) {
  const puzzle = regionsPuzzles[index];
  const proof = solvePuzzle(puzzle, 1).solutions[0];
  assert(proof, `Puzzle ${puzzle.id} must have a solution.`);
  return { puzzle, proof };
}

async function expectCompetitiveError(operation: () => Promise<unknown>, code: RegionsCompetitiveError["code"]) {
  await assert.rejects(operation, (error: unknown) => error instanceof RegionsCompetitiveError && error.code === code);
}

async function prepareAndStart(identity: ArenaIdentity, mode: RegionsCompetitiveMode, puzzleId?: string) {
  const prepared = await competitive.prepare(identity, { mode, puzzleId });
  return competitive.start(identity, prepared.attemptId);
}

async function submitBoard(identity: ArenaIdentity, attemptId: string, index: number, submissionKey = randomUUID()) {
  const { puzzle, proof } = proofFor(index);
  return competitive.submit(identity, {
    attemptId,
    submissionKey,
    puzzleId: puzzle.id,
    proof,
    elapsedMs: 1,
    boardsSolved: 999,
    remainingSeconds: 999,
  });
}

async function main(): Promise<void> {
  const suffix = randomUUID().slice(0, 6);
  const subjects = Array.from({ length: 4 }, () => randomUUID());
  const identities = subjects.map((subject) => createArenaIdentity(subject, "anonymous"));
  const [playerA, playerB, playerC, playerD] = identities;

  try {
    await Promise.all(identities.map((identity, index) => players.saveNickname(identity, `Rank${index + 1}-${suffix}`)));

    await expectCompetitiveError(() => competitive.prepare(playerA, { mode: "invalid" }), "invalid-mode");
    await expectCompetitiveError(() => competitive.prepare(playerA, { mode: "classic", puzzleId: "999" }), "invalid-puzzle");

    const preparedA = await competitive.prepare(playerA, { mode: "classic", puzzleId: regionsPuzzles[0].id });
    const storedPrepared = await pool.query<{ subject_id: string; started_at: Date | null }>(
      `select p.subject_id::text, a.started_at from app.regions_competitive_attempts a join app.players p on p.id = a.player_id where a.id = $1`,
      [preparedA.attemptId],
    );
    assert.deepEqual(storedPrepared.rows[0], { subject_id: subjects[0], started_at: null });
    await expectCompetitiveError(() => competitive.prepare(playerA, { mode: "journey" }), "attempt-active");

    const beforeStart = await pool.query<{ now: Date }>("select clock_timestamp() as now");
    const classicA = await competitive.start(playerA, preparedA.attemptId);
    const afterStart = await pool.query<{ now: Date }>("select clock_timestamp() as now");
    assert(classicA.startedAt);
    const trustedStart = new Date(classicA.startedAt);
    assert(trustedStart >= beforeStart.rows[0].now && trustedStart <= afterStart.rows[0].now);
    await expectCompetitiveError(() => competitive.submit(playerB, { attemptId: classicA.attemptId, submissionKey: randomUUID(), puzzleId: regionsPuzzles[0].id, proof: proofFor(0).proof }), "invalid-attempt");
    await expectCompetitiveError(() => competitive.submit(playerA, { attemptId: classicA.attemptId, submissionKey: randomUUID(), puzzleId: regionsPuzzles[0].id, proof: [] }), "invalid-proof");
    await expectCompetitiveError(() => competitive.submit(playerA, { attemptId: classicA.attemptId, submissionKey: randomUUID(), puzzleId: regionsPuzzles[1].id, proof: proofFor(1).proof }), "progress-mismatch");

    await pool.query("update app.regions_competitive_attempts set started_at = clock_timestamp() - interval '6 seconds' where id = $1", [classicA.attemptId]);
    const classicKey = randomUUID();
    const completedA = await submitBoard(playerA, classicA.attemptId, 0, classicKey);
    assert.equal(completedA.status, "completed");
    assert((completedA.trustedElapsedMs ?? 0) >= 5_900);
    assert.equal((await submitBoard(playerA, classicA.attemptId, 0, classicKey)).trustedElapsedMs, completedA.trustedElapsedMs);
    await expectCompetitiveError(() => submitBoard(playerA, classicA.attemptId, 0), "attempt-finalized");

    const classicB = await prepareAndStart(playerB, "classic", regionsPuzzles[0].id);
    await pool.query("update app.regions_competitive_attempts set started_at = clock_timestamp() - interval '10 seconds' where id = $1", [classicB.attemptId]);
    await submitBoard(playerB, classicB.attemptId, 0);
    const classicASecond = await prepareAndStart(playerA, "classic", regionsPuzzles[0].id);
    await pool.query("update app.regions_competitive_attempts set started_at = clock_timestamp() - interval '3 seconds' where id = $1", [classicASecond.attemptId]);
    await submitBoard(playerA, classicASecond.attemptId, 0);

    const classicLeaders = await competitive.classicLeaderboard(regionsPuzzles[0].id);
    assert.equal(classicLeaders[0].nickname, `Rank1-${suffix}`);
    assert.equal(classicLeaders[1].nickname, `Rank2-${suffix}`);
    assert.equal(classicLeaders.filter((entry) => entry.nickname === `Rank1-${suffix}`).length, 1);
    assert.equal((await competitive.classicLeaderboard(regionsPuzzles[1].id)).length, 0);

    const journeyA = await prepareAndStart(playerA, "journey");
    for (let index = 0; index < regionsPuzzles.length; index += 1) await submitBoard(playerA, journeyA.attemptId, index);
    const journeyAResult = await competitive.finalizeExpired(playerA, journeyA.attemptId);
    assert.equal(journeyAResult.status, "completed");
    assert.equal(journeyAResult.acceptedBoards, regionsPuzzles.length);

    const journeyB = await prepareAndStart(playerB, "journey");
    await expectCompetitiveError(() => submitBoard(playerB, journeyB.attemptId, 1), "progress-mismatch");
    await submitBoard(playerB, journeyB.attemptId, 0);
    await submitBoard(playerB, journeyB.attemptId, 1);
    await pool.query("update app.regions_competitive_attempts set started_at = clock_timestamp() - interval '12 seconds', deadline_at = clock_timestamp() - interval '1 second' where id = $1", [journeyB.attemptId]);
    await competitive.finalizeExpired(playerB, journeyB.attemptId);

    const journeyC = await prepareAndStart(playerC, "journey");
    for (let index = 0; index < 3; index += 1) await submitBoard(playerC, journeyC.attemptId, index);
    await pool.query("update app.regions_competitive_attempts set started_at = clock_timestamp() - interval '20 seconds', deadline_at = clock_timestamp() - interval '1 second' where id = $1", [journeyC.attemptId]);
    await competitive.finalizeExpired(playerC, journeyC.attemptId);

    const journeyD = await prepareAndStart(playerD, "journey");
    await submitBoard(playerD, journeyD.attemptId, 0);
    await submitBoard(playerD, journeyD.attemptId, 1);
    await pool.query("update app.regions_competitive_attempts set started_at = clock_timestamp() - interval '5 seconds', deadline_at = clock_timestamp() - interval '1 second' where id = $1", [journeyD.attemptId]);
    await competitive.finalizeExpired(playerD, journeyD.attemptId);

    const journeyLeaders = await competitive.journeyLeaderboard();
    assert.equal(journeyLeaders[0].nickname, `Rank1-${suffix}`);
    assert.equal(journeyLeaders[0].catalogCleared, true);
    assert.equal(journeyLeaders[1].nickname, `Rank3-${suffix}`);
    assert.equal(journeyLeaders[2].nickname, `Rank4-${suffix}`);
    assert.equal(journeyLeaders[3].nickname, `Rank2-${suffix}`);

    const timeA = await prepareAndStart(playerA, "time-attack");
    const timing = await pool.query<{ duration: string }>("select extract(epoch from (deadline_at - started_at))::text as duration from app.regions_competitive_attempts where id = $1", [timeA.attemptId]);
    assert.equal(Number(timing.rows[0].duration), 180);
    await pool.query("update app.regions_competitive_attempts set started_at = clock_timestamp() - interval '10 seconds' where id = $1", [timeA.attemptId]);
    await submitBoard(playerA, timeA.attemptId, 0);
    const timeAProgress = await submitBoard(playerA, timeA.attemptId, 1);
    assert.equal(timeAProgress.acceptedBoards, 2);
    await pool.query("update app.regions_competitive_attempts set deadline_at = clock_timestamp() - interval '1 second' where id = $1", [timeA.attemptId]);
    await competitive.finalizeExpired(playerA, timeA.attemptId);

    const timeB = await prepareAndStart(playerB, "time-attack");
    await submitBoard(playerB, timeB.attemptId, 0);
    await pool.query("update app.regions_competitive_attempts set deadline_at = clock_timestamp() - interval '1 second' where id = $1", [timeB.attemptId]);
    await competitive.finalizeExpired(playerB, timeB.attemptId);

    const timeC = await prepareAndStart(playerC, "time-attack");
    await pool.query("update app.regions_competitive_attempts set started_at = clock_timestamp() - interval '20 seconds' where id = $1", [timeC.attemptId]);
    await submitBoard(playerC, timeC.attemptId, 0);
    await submitBoard(playerC, timeC.attemptId, 1);
    await pool.query("update app.regions_competitive_attempts set deadline_at = clock_timestamp() - interval '1 second' where id = $1", [timeC.attemptId]);
    await competitive.finalizeExpired(playerC, timeC.attemptId);

    const timeD = await prepareAndStart(playerD, "time-attack");
    await pool.query("update app.regions_competitive_attempts set deadline_at = clock_timestamp() - interval '1 second' where id = $1", [timeD.attemptId]);
    await expectCompetitiveError(() => submitBoard(playerD, timeD.attemptId, 0), "attempt-expired");

    const timeLeaders = await competitive.timeAttackLeaderboard();
    assert.equal(timeLeaders[0].nickname, `Rank1-${suffix}`);
    assert.equal(timeLeaders[0].boardsSolved, 2);
    assert.equal(timeLeaders[1].nickname, `Rank3-${suffix}`);
    assert.equal(timeLeaders[2].nickname, `Rank2-${suffix}`);

    const concurrent = await prepareAndStart(playerD, "classic", regionsPuzzles[2].id);
    const concurrentKey = randomUUID();
    const concurrentResults = await Promise.all([
      submitBoard(playerD, concurrent.attemptId, 2, concurrentKey),
      submitBoard(playerD, concurrent.attemptId, 2, concurrentKey),
    ]);
    assert.equal(concurrentResults[0].trustedElapsedMs, concurrentResults[1].trustedElapsedMs);
    const concurrencyCount = await pool.query<{ results: string; submissions: string }>(
      `select
        (select count(*)::text from app.regions_competitive_results where attempt_id = $1) as results,
        (select count(*)::text from app.regions_competitive_submissions where attempt_id = $1) as submissions`,
      [concurrent.attemptId],
    );
    assert.deepEqual(concurrencyCount.rows[0], { results: "1", submissions: "1" });

    const privacyPayload = JSON.stringify([...classicLeaders, ...journeyLeaders, ...timeLeaders]);
    assert(!privacyPayload.includes(subjects[0]));
    assert(!privacyPayload.includes("attemptId"));
    assert(!privacyPayload.includes("player_id"));
    assert(!privacyPayload.includes("token"));

    console.log(JSON.stringify({
      attemptLifecycleAndOwnership: true,
      trustedServerStartAndDeadlines: true,
      classicGeometryVerification: true,
      browserTimingClaimsIgnored: true,
      completionIdempotencyAndConcurrency: true,
      journeyOrderedServerProgression: true,
      journeyCompletedAndIncompleteRanking: true,
      timeAttackServerDerivedProgression: true,
      timeAttackDeadlineEnforced: true,
      bestPerPlayerLeaderboards: true,
      puzzleLeaderboardIsolation: true,
      publicLeaderboardPrivacy: true,
    }, null, 2));
  } finally {
    await pool.query("delete from app.players where subject_id = any($1::uuid[])", [subjects]);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDatabasePool);
