import "server-only";

import type { Pool } from "pg";

import type { PlayerProfile, RegionsResultInput, RegionsStats } from "../player/types";

type PlayerRow = { id: string; nickname: string; created_at: Date; updated_at: Date };

function mapPlayer(row: PlayerRow): PlayerProfile {
  return { id: row.id, nickname: row.nickname, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}

export class PlayerRepository {
  constructor(private readonly pool: Pool) {}

  async getBySubject(subjectId: string): Promise<PlayerProfile | null> {
    const result = await this.pool.query<PlayerRow>("select id, nickname, created_at, updated_at from app.players where subject_id = $1", [subjectId]);
    return result.rows[0] ? mapPlayer(result.rows[0]) : null;
  }

  async create(subjectId: string, nickname: string, normalizedNickname: string): Promise<PlayerProfile> {
    const result = await this.pool.query<PlayerRow>(
      "insert into app.players (subject_id, nickname, normalized_nickname) values ($1, $2, $3) returning id, nickname, created_at, updated_at",
      [subjectId, nickname, normalizedNickname],
    );
    return mapPlayer(result.rows[0]);
  }

  async updateNickname(subjectId: string, nickname: string, normalizedNickname: string): Promise<PlayerProfile> {
    const result = await this.pool.query<PlayerRow>(
      "update app.players set nickname = $2, normalized_nickname = $3 where subject_id = $1 returning id, nickname, created_at, updated_at",
      [subjectId, nickname, normalizedNickname],
    );
    if (!result.rows[0]) throw new Error("Player profile was not found.");
    return mapPlayer(result.rows[0]);
  }

  async insertRegionsResult(subjectId: string, input: RegionsResultInput): Promise<void> {
    await this.pool.query(
      `insert into app.regions_results
        (player_id, result_key, mode, puzzle_id, completion_ms, score, hints_used, boards_solved,
         final_puzzle_id, total_elapsed_ms, configured_duration_seconds, remaining_seconds, catalog_cleared)
       select id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
       from app.players where subject_id = $1
       on conflict (result_key) do nothing`,
      [subjectId, input.resultKey, input.mode, input.puzzleId ?? null, input.completionMs ?? null, input.score ?? null, input.hintsUsed ?? null, input.boardsSolved ?? null, input.finalPuzzleId ?? null, input.totalElapsedMs ?? null, input.configuredDurationSeconds ?? null, input.remainingSeconds ?? null, input.catalogCleared ?? false],
    );
  }

  async getStats(subjectId: string): Promise<RegionsStats> {
    const result = await this.pool.query<{
      classic_puzzles_completed: string;
      best_classic_completion_ms: number | null;
      total_regions_solves: string;
      journey_sessions_completed: string;
      highest_journey_puzzle: string | null;
      journey_catalog_completions: string;
      best_journey_total_elapsed_ms: number | null;
      time_attack_sessions: string;
      best_time_attack_boards: string;
      best_time_attack_remaining_seconds: number | null;
    }>(
      `select
        count(*) filter (where mode = 'classic')::text as classic_puzzles_completed,
        min(completion_ms) filter (where mode = 'classic') as best_classic_completion_ms,
        count(*)::text as total_regions_solves,
        count(*) filter (where mode = 'journey')::text as journey_sessions_completed,
        max(final_puzzle_id) filter (where mode = 'journey') as highest_journey_puzzle,
        count(*) filter (where mode = 'journey' and catalog_cleared)::text as journey_catalog_completions,
        min(total_elapsed_ms) filter (where mode = 'journey' and catalog_cleared) as best_journey_total_elapsed_ms,
        count(*) filter (where mode = 'time-attack')::text as time_attack_sessions,
        coalesce(max(boards_solved) filter (where mode = 'time-attack'), 0)::text as best_time_attack_boards,
        max(remaining_seconds) filter (where mode = 'time-attack') as best_time_attack_remaining_seconds
       from app.regions_results where player_id = (select id from app.players where subject_id = $1)`,
      [subjectId],
    );
    const row = result.rows[0];
    return {
      classicPuzzlesCompleted: Number(row?.classic_puzzles_completed ?? 0),
      bestClassicCompletionMs: row?.best_classic_completion_ms ?? null,
      totalRegionsSolves: Number(row?.total_regions_solves ?? 0),
      journeySessionsCompleted: Number(row?.journey_sessions_completed ?? 0),
      highestJourneyPuzzle: row?.highest_journey_puzzle ?? null,
      journeyCatalogCompletions: Number(row?.journey_catalog_completions ?? 0),
      bestJourneyTotalElapsedMs: row?.best_journey_total_elapsed_ms ?? null,
      timeAttackSessions: Number(row?.time_attack_sessions ?? 0),
      bestTimeAttackBoards: Number(row?.best_time_attack_boards ?? 0),
      bestTimeAttackRemainingSeconds: row?.best_time_attack_remaining_seconds ?? null,
    };
  }
}
