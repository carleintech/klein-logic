import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { regionsPuzzles } from "../../src/game/puzzles";
import { createArenaIdentity } from "../../src/server/arena/identity";
import { closeDatabasePool, getDatabasePool } from "../../src/server/db/pool";
import { PlayerProfileError, PlayerService } from "../../src/server/services/player-service";

async function main(): Promise<void> {
  const pool = getDatabasePool();
  const service = new PlayerService();
  const subjectA = randomUUID();
  const subjectB = randomUUID();
  const identityA = createArenaIdentity(subjectA, "anonymous");
  const identityB = createArenaIdentity(subjectB, "anonymous");
  const suffix = randomUUID().slice(0, 8);
  const nicknameA = `Logic-${suffix}`;
  const nicknameB = `Rival-${suffix}`;
  const [firstPuzzle, secondPuzzle, thirdPuzzle] = regionsPuzzles;
  assert(firstPuzzle && secondPuzzle && thirdPuzzle);

  try {
    const schema = await pool.query<{
      players_subject_unique: boolean;
      nickname_unique: boolean;
      result_key_unique: boolean;
      player_fk_cascade: boolean;
      updated_at_trigger: boolean;
    }>(
      `select
        exists (select 1 from pg_constraint where conrelid = 'app.players'::regclass and contype = 'u' and pg_get_constraintdef(oid) ilike '%subject_id%') as players_subject_unique,
        exists (select 1 from pg_constraint where conrelid = 'app.players'::regclass and contype = 'u' and pg_get_constraintdef(oid) ilike '%normalized_nickname%') as nickname_unique,
        exists (select 1 from pg_constraint where conrelid = 'app.regions_results'::regclass and contype = 'u' and pg_get_constraintdef(oid) ilike '%result_key%') as result_key_unique,
        exists (select 1 from pg_constraint where conrelid = 'app.regions_results'::regclass and contype = 'f' and confdeltype = 'c') as player_fk_cascade,
        exists (select 1 from pg_trigger where tgrelid = 'app.players'::regclass and tgname = 'players_set_updated_at' and not tgisinternal) as updated_at_trigger`,
    );
    assert.deepEqual(schema.rows[0], {
      players_subject_unique: true,
      nickname_unique: true,
      result_key_unique: true,
      player_fk_cascade: true,
      updated_at_trigger: true,
    });

    assert.equal(await service.getProfile(identityA), null);
    const created = await service.saveNickname(identityA, `  ${nicknameA}  `);
    assert.equal(created.nickname, nicknameA);
    assert.equal(Object.hasOwn(created, "subjectId"), false);
    assert.equal((await service.getProfile(identityA))?.id, created.id);

    await service.saveNickname(identityB, nicknameB);
    await assert.rejects(
      () => service.saveNickname(identityB, nicknameA.toUpperCase()),
      (error: unknown) => error instanceof PlayerProfileError && error.code === "nickname-taken",
    );

    const updated = await service.saveNickname(identityA, `${nicknameA}-2`);
    assert.equal(updated.id, created.id);
    assert.equal(updated.nickname, `${nicknameA}-2`);
    assert.notEqual(updated.updatedAt, created.updatedAt);

    const classicKey = randomUUID();
    await service.recordRegionsResult(identityA, {
      resultKey: classicKey,
      mode: "classic",
      puzzleId: firstPuzzle.id,
      completionMs: 12_500,
      score: 900,
      hintsUsed: 1,
    });
    await service.recordRegionsResult(identityA, {
      resultKey: classicKey,
      mode: "classic",
      puzzleId: firstPuzzle.id,
      completionMs: 99_999,
      score: 1,
      hintsUsed: 9,
    });
    await service.recordRegionsResult(identityA, {
      resultKey: randomUUID(),
      mode: "classic",
      puzzleId: secondPuzzle.id,
      completionMs: 8_750,
      score: 1_100,
      hintsUsed: 0,
    });
    await service.recordRegionsResult(identityA, {
      resultKey: randomUUID(),
      mode: "journey",
      finalPuzzleId: thirdPuzzle.id,
      boardsSolved: 3,
      totalElapsedMs: 70_000,
      catalogCleared: true,
    });
    await service.recordRegionsResult(identityA, {
      resultKey: randomUUID(),
      mode: "journey",
      finalPuzzleId: secondPuzzle.id,
      boardsSolved: 2,
      totalElapsedMs: 82_000,
      catalogCleared: true,
    });
    await service.recordRegionsResult(identityA, {
      resultKey: randomUUID(),
      mode: "time-attack",
      finalPuzzleId: thirdPuzzle.id,
      boardsSolved: 7,
      configuredDurationSeconds: 60,
      remainingSeconds: 8,
    });
    await service.recordRegionsResult(identityA, {
      resultKey: randomUUID(),
      mode: "time-attack",
      finalPuzzleId: secondPuzzle.id,
      boardsSolved: 5,
      configuredDurationSeconds: 60,
      remainingSeconds: 14,
    });

    const idempotency = await pool.query<{ count: string; completion_ms: number }>(
      "select count(*)::text as count, min(completion_ms) as completion_ms from app.regions_results where result_key = $1",
      [classicKey],
    );
    assert.deepEqual(idempotency.rows[0], { count: "1", completion_ms: 12_500 });

    const stats = await service.getStats(identityA);
    assert.deepEqual(stats, {
      classicPuzzlesCompleted: 2,
      bestClassicCompletionMs: 8_750,
      totalRegionsSolves: 6,
      journeySessionsCompleted: 2,
      highestJourneyPuzzle: thirdPuzzle.id,
      journeyCatalogCompletions: 2,
      bestJourneyTotalElapsedMs: 70_000,
      timeAttackSessions: 2,
      bestTimeAttackBoards: 7,
      bestTimeAttackRemainingSeconds: 14,
    });
    assert.deepEqual(await service.getStats(identityB), {
      classicPuzzlesCompleted: 0,
      bestClassicCompletionMs: null,
      totalRegionsSolves: 0,
      journeySessionsCompleted: 0,
      highestJourneyPuzzle: null,
      journeyCatalogCompletions: 0,
      bestJourneyTotalElapsedMs: null,
      timeAttackSessions: 0,
      bestTimeAttackBoards: 0,
      bestTimeAttackRemainingSeconds: null,
    });

    const privacy = await pool.query<{ subject_id: string }>(
      `select p.subject_id::text
       from app.regions_results r join app.players p on p.id = r.player_id
       where r.result_key = $1`,
      [classicKey],
    );
    assert.equal(privacy.rows[0]?.subject_id, subjectA);

    console.log(JSON.stringify({
      schemaContractVerified: true,
      profileCreateReadUpdate: true,
      nicknameUniquenessCaseInsensitive: true,
      resultModesPersisted: ["classic", "journey", "time-attack"],
      idempotentResultKey: true,
      personalBestAggregation: true,
      identityIsolation: true,
      publicProfileOmitsSubjectId: true,
    }, null, 2));
  } finally {
    await pool.query("delete from app.players where subject_id = any($1::uuid[])", [[subjectA, subjectB]]);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDatabasePool);
