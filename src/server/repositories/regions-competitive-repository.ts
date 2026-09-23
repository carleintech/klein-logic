import "server-only";

import type { Pool, PoolClient } from "pg";

import type {
  ClassicLeaderboardEntry,
  JourneyLeaderboardEntry,
  RegionsCompetitiveAttemptStatus,
  RegionsCompetitiveMode,
  TimeAttackLeaderboardEntry,
} from "../../game/competitive/types";
import { withTransaction } from "../db/transaction";

type AttemptRow = {
  id: string;
  player_id: string;
  nickname: string;
  mode: RegionsCompetitiveMode;
  puzzle_id: string | null;
  status: RegionsCompetitiveAttemptStatus;
  current_puzzle_index: number;
  accepted_boards: number;
  prepared_at: Date;
  prepared_expires_at: Date;
  started_at: Date | null;
  deadline_at: Date | null;
  last_accepted_at: Date | null;
  completed_at: Date | null;
};

export type StoredRegionsAttempt = Readonly<{
  id: string;
  nickname: string;
  mode: RegionsCompetitiveMode;
  puzzleId: string | null;
  status: RegionsCompetitiveAttemptStatus;
  currentPuzzleIndex: number;
  acceptedBoards: number;
  preparedExpiresAt: Date;
  startedAt: Date | null;
  deadlineAt: Date | null;
  lastAcceptedAt: Date | null;
  completedAt: Date | null;
  trustedElapsedMs: number | null;
}>;

export type AcceptCompletionResult = Readonly<{
  attempt: StoredRegionsAttempt;
  idempotent: boolean;
  outcome: "accepted" | "expired" | "finalized" | "progress-mismatch";
}>;

function mapAttempt(row: AttemptRow, trustedElapsedMs: number | null = null): StoredRegionsAttempt {
  return {
    id: row.id,
    nickname: row.nickname,
    mode: row.mode,
    puzzleId: row.puzzle_id,
    status: row.status,
    currentPuzzleIndex: row.current_puzzle_index,
    acceptedBoards: row.accepted_boards,
    preparedExpiresAt: row.prepared_expires_at,
    startedAt: row.started_at,
    deadlineAt: row.deadline_at,
    lastAcceptedAt: row.last_accepted_at,
    completedAt: row.completed_at,
    trustedElapsedMs,
  };
}

async function getOwnedAttempt(client: Pool | PoolClient, subjectId: string, attemptId: string, lock = false): Promise<AttemptRow | null> {
  const result = await client.query<AttemptRow>(
    `select a.*, p.nickname
     from app.regions_competitive_attempts a
     join app.players p on p.id = a.player_id
     where a.id = $1 and p.subject_id = $2
     ${lock ? "for update of a" : ""}`,
    [attemptId, subjectId],
  );
  return result.rows[0] ?? null;
}

async function readTrustedElapsed(client: Pool | PoolClient, attemptId: string): Promise<number | null> {
  const result = await client.query<{ trusted_elapsed_ms: number }>(
    "select trusted_elapsed_ms from app.regions_competitive_results where attempt_id = $1",
    [attemptId],
  );
  return result.rows[0]?.trusted_elapsed_ms ?? null;
}

async function insertResult(client: PoolClient, attempt: AttemptRow, completedAt: Date): Promise<void> {
  if (!attempt.started_at) throw new Error("attempt-not-started");
  const trustedEndpoint = attempt.mode === "time-attack" && attempt.last_accepted_at
    ? attempt.last_accepted_at
    : completedAt;
  await client.query(
    `insert into app.regions_competitive_results
      (attempt_id, player_id, mode, puzzle_id, boards_solved, catalog_cleared, trusted_elapsed_ms, completed_at)
     values (
       $1, $2, $3, $4, $5, $6,
       greatest(0, floor(extract(epoch from ($7::timestamptz - $8::timestamptz)) * 1000))::integer,
       $9
     )
     on conflict (attempt_id) do nothing`,
    [
      attempt.id,
      attempt.player_id,
      attempt.mode,
      attempt.mode === "classic" ? attempt.puzzle_id : null,
      attempt.accepted_boards,
      attempt.current_puzzle_index >= 20,
      trustedEndpoint,
      attempt.started_at,
      completedAt,
    ],
  );
}

export class RegionsCompetitiveRepository {
  constructor(private readonly pool: Pool) {}

  async prepare(subjectId: string, mode: RegionsCompetitiveMode, puzzleId: string | null): Promise<StoredRegionsAttempt> {
    return withTransaction(this.pool, async (client) => {
      const player = await client.query<{ id: string }>("select id from app.players where subject_id = $1 for update", [subjectId]);
      const playerId = player.rows[0]?.id;
      if (!playerId) throw new Error("profile-required");

      const clock = await client.query<{ now: Date }>("select clock_timestamp() as now");
      const now = clock.rows[0].now;

      await client.query(
        `update app.regions_competitive_attempts
         set status = 'expired', completed_at = clock_timestamp()
         where player_id = $1 and status = 'prepared' and prepared_expires_at <= clock_timestamp()`,
        [playerId],
      );

      const open = await client.query<AttemptRow>(
        `select a.*, p.nickname from app.regions_competitive_attempts a join app.players p on p.id = a.player_id
         where a.player_id = $1 and a.status in ('prepared', 'active') for update of a`,
        [playerId],
      );
      if (open.rows[0]) {
        const existing = open.rows[0];
        if (existing.status === "active" && existing.deadline_at && existing.deadline_at <= now) {
          if (existing.mode !== "classic" && existing.accepted_boards > 0) await insertResult(client, existing, now);
          await client.query("update app.regions_competitive_attempts set status = 'expired', completed_at = $2 where id = $1", [existing.id, now]);
        } else {
          if (existing.status === "prepared" && existing.mode === mode && existing.puzzle_id === puzzleId) return mapAttempt(existing);
          throw new Error("attempt-active");
        }
      }

      const inserted = await client.query<AttemptRow>(
        `insert into app.regions_competitive_attempts (player_id, mode, puzzle_id, session_duration_seconds)
         values ($1, $2, $3, case when $2 = 'time-attack' then 180 else null end)
         returning *, (select nickname from app.players where id = $1) as nickname`,
        [playerId, mode, puzzleId],
      );
      return mapAttempt(inserted.rows[0]);
    });
  }

  async start(subjectId: string, attemptId: string): Promise<StoredRegionsAttempt> {
    return withTransaction(this.pool, async (client) => {
      const attempt = await getOwnedAttempt(client, subjectId, attemptId, true);
      if (!attempt) throw new Error("attempt-not-found");
      if (attempt.status === "active") return mapAttempt(attempt);
      if (attempt.status !== "prepared") throw new Error("attempt-finalized");
      const clock = await client.query<{ now: Date }>("select clock_timestamp() as now");
      if (attempt.prepared_expires_at <= clock.rows[0].now) {
        const expired = await client.query<AttemptRow>(
          "update app.regions_competitive_attempts set status = 'expired', completed_at = clock_timestamp() where id = $1 returning *, $2::text as nickname",
          [attemptId, attempt.nickname],
        );
        return mapAttempt(expired.rows[0]);
      }

      const duration = attempt.mode === "classic" ? "15 minutes" : attempt.mode === "journey" ? "30 minutes" : "180 seconds";
      const result = await client.query<AttemptRow>(
        `update app.regions_competitive_attempts
         set status = 'active', started_at = clock_timestamp(), deadline_at = clock_timestamp() + $2::interval
         where id = $1
         returning *, $3::text as nickname`,
        [attemptId, duration, attempt.nickname],
      );
      return mapAttempt(result.rows[0]);
    });
  }

  async getOwned(subjectId: string, attemptId: string): Promise<StoredRegionsAttempt | null> {
    const row = await getOwnedAttempt(this.pool, subjectId, attemptId);
    return row ? mapAttempt(row, await readTrustedElapsed(this.pool, attemptId)) : null;
  }

  async getOwnedBySubmission(subjectId: string, attemptId: string, submissionKey: string): Promise<StoredRegionsAttempt | null> {
    const result = await this.pool.query<AttemptRow>(
      `select a.*, p.nickname
       from app.regions_competitive_attempts a
       join app.players p on p.id = a.player_id
       join app.regions_competitive_submissions s on s.attempt_id = a.id
       where a.id = $1 and p.subject_id = $2 and s.submission_key = $3`,
      [attemptId, subjectId, submissionKey],
    );
    return result.rows[0] ? mapAttempt(result.rows[0], await readTrustedElapsed(this.pool, attemptId)) : null;
  }

  async acceptCompletion(input: {
    subjectId: string;
    attemptId: string;
    submissionKey: string;
    expectedPuzzleId: string;
    expectedPuzzleIndex: number;
    catalogSize: number;
  }): Promise<AcceptCompletionResult> {
    return withTransaction(this.pool, async (client) => {
      let attempt = await getOwnedAttempt(client, input.subjectId, input.attemptId, true);
      if (!attempt) throw new Error("attempt-not-found");
      const clock = await client.query<{ now: Date }>("select clock_timestamp() as now");
      const received = clock.rows[0].now;

      const retry = await client.query("select 1 from app.regions_competitive_submissions where attempt_id = $1 and submission_key = $2", [input.attemptId, input.submissionKey]);
      if (retry.rowCount === 1) {
        return { attempt: mapAttempt(attempt, await readTrustedElapsed(client, input.attemptId)), idempotent: true, outcome: "accepted" };
      }
      if (attempt.status !== "active") {
        return { attempt: mapAttempt(attempt, await readTrustedElapsed(client, input.attemptId)), idempotent: false, outcome: "finalized" };
      }
      if (!attempt.deadline_at || attempt.deadline_at < received) {
        if (attempt.mode !== "classic" && attempt.started_at && attempt.accepted_boards > 0) await insertResult(client, attempt, received);
        const expired = await client.query<AttemptRow>(
          "update app.regions_competitive_attempts set status = 'expired', completed_at = $2 where id = $1 returning *, $3::text as nickname",
          [attempt.id, received, attempt.nickname],
        );
        return { attempt: mapAttempt(expired.rows[0], await readTrustedElapsed(client, input.attemptId)), idempotent: false, outcome: "expired" };
      }

      const storedPuzzleId = attempt.mode === "classic" ? attempt.puzzle_id : input.expectedPuzzleId;
      if (attempt.current_puzzle_index !== input.expectedPuzzleIndex || storedPuzzleId !== input.expectedPuzzleId) {
        return { attempt: mapAttempt(attempt), idempotent: false, outcome: "progress-mismatch" };
      }

      await client.query(
        `insert into app.regions_competitive_submissions (attempt_id, submission_key, puzzle_id, puzzle_index, received_at)
         values ($1, $2, $3, $4, $5)`,
        [attempt.id, input.submissionKey, input.expectedPuzzleId, input.expectedPuzzleIndex, received],
      );
      const nextBoards = attempt.accepted_boards + 1;
      const complete = attempt.mode === "classic" || nextBoards >= input.catalogSize;
      const updated = await client.query<AttemptRow>(
        `update app.regions_competitive_attempts
         set accepted_boards = $2,
             current_puzzle_index = current_puzzle_index + 1,
             last_accepted_at = $3,
             status = case when $4 then 'completed' else status end,
             completed_at = case when $4 then $3 else completed_at end
         where id = $1 returning *, $5::text as nickname`,
        [attempt.id, nextBoards, received, complete, attempt.nickname],
      );
      attempt = updated.rows[0];
      if (complete) await insertResult(client, attempt, received);
      return { attempt: mapAttempt(attempt, await readTrustedElapsed(client, input.attemptId)), idempotent: false, outcome: "accepted" };
    });
  }

  async finalizeExpired(subjectId: string, attemptId: string): Promise<StoredRegionsAttempt> {
    return withTransaction(this.pool, async (client) => {
      const attempt = await getOwnedAttempt(client, subjectId, attemptId, true);
      if (!attempt) throw new Error("attempt-not-found");
      if (attempt.status !== "active") return mapAttempt(attempt, await readTrustedElapsed(client, attemptId));
      const clock = await client.query<{ now: Date }>("select clock_timestamp() as now");
      const now = clock.rows[0].now;
      if (!attempt.deadline_at || attempt.deadline_at > now) throw new Error("attempt-active");

      if (attempt.mode !== "classic" && attempt.started_at && attempt.accepted_boards > 0) await insertResult(client, attempt, now);
      const updated = await client.query<AttemptRow>(
        "update app.regions_competitive_attempts set status = 'expired', completed_at = clock_timestamp() where id = $1 returning *, $2::text as nickname",
        [attempt.id, attempt.nickname],
      );
      return mapAttempt(updated.rows[0], await readTrustedElapsed(client, attemptId));
    });
  }

  async classicLeaderboard(puzzleId: string, limit: number): Promise<ClassicLeaderboardEntry[]> {
    const result = await this.pool.query<{ rank: string; nickname: string; trusted_elapsed_ms: number; completed_at: Date }>(
      `with personal as (
         select r.*, p.nickname, row_number() over (partition by r.player_id order by r.trusted_elapsed_ms, r.completed_at, r.id) as personal_rank
         from app.regions_competitive_results r join app.players p on p.id = r.player_id
         where r.mode = 'classic' and r.puzzle_id = $1
       ), leaders as (
         select row_number() over (order by trusted_elapsed_ms, completed_at, id)::text as rank, * from personal where personal_rank = 1
       )
       select rank, nickname, trusted_elapsed_ms, completed_at from leaders order by rank::integer limit $2`,
      [puzzleId, limit],
    );
    return result.rows.map((row) => ({ rank: Number(row.rank), nickname: row.nickname, completionMs: row.trusted_elapsed_ms, completedAt: row.completed_at.toISOString() }));
  }

  async journeyLeaderboard(limit: number): Promise<JourneyLeaderboardEntry[]> {
    const result = await this.pool.query<{ rank: string; nickname: string; catalog_cleared: boolean; boards_solved: number; trusted_elapsed_ms: number }>(
      `with personal as (
         select r.*, p.nickname, row_number() over (
           partition by r.player_id order by r.catalog_cleared desc, r.boards_solved desc, r.trusted_elapsed_ms, r.completed_at, r.id
         ) as personal_rank
         from app.regions_competitive_results r join app.players p on p.id = r.player_id where r.mode = 'journey'
       ), leaders as (
         select row_number() over (order by catalog_cleared desc, boards_solved desc, trusted_elapsed_ms, completed_at, id)::text as rank, *
         from personal where personal_rank = 1
       )
       select rank, nickname, catalog_cleared, boards_solved, trusted_elapsed_ms from leaders order by rank::integer limit $1`,
      [limit],
    );
    return result.rows.map((row) => ({ rank: Number(row.rank), nickname: row.nickname, catalogCleared: row.catalog_cleared, puzzlesCompleted: row.boards_solved, trustedElapsedMs: row.trusted_elapsed_ms }));
  }

  async timeAttackLeaderboard(limit: number): Promise<TimeAttackLeaderboardEntry[]> {
    const result = await this.pool.query<{ rank: string; nickname: string; boards_solved: number; trusted_elapsed_ms: number }>(
      `with personal as (
         select r.*, p.nickname, row_number() over (
           partition by r.player_id order by r.boards_solved desc, r.trusted_elapsed_ms, r.completed_at, r.id
         ) as personal_rank
         from app.regions_competitive_results r join app.players p on p.id = r.player_id where r.mode = 'time-attack'
       ), leaders as (
         select row_number() over (order by boards_solved desc, trusted_elapsed_ms, completed_at, id)::text as rank, *
         from personal where personal_rank = 1
       )
       select rank, nickname, boards_solved, trusted_elapsed_ms from leaders order by rank::integer limit $1`,
      [limit],
    );
    return result.rows.map((row) => ({ rank: Number(row.rank), nickname: row.nickname, boardsSolved: row.boards_solved, timeToLastSolveMs: row.trusted_elapsed_ms }));
  }
}
