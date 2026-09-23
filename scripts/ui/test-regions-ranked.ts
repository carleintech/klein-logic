import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { verifyRegionsCompletion } from "../../src/game/engine/verify-completion";
import { regionsPuzzles } from "../../src/game/puzzles";
import { solvePuzzle } from "../../src/game/engine/solver";

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

async function main(): Promise<void> {
  const [migration, actions, service, repository, ranked, leaderboard, experience, board, route] = await Promise.all([
    source("db/migrations/0005_regions_competitive_leaderboards.sql"),
    source("src/app/play/actions.ts"),
    source("src/server/services/regions-competitive-service.ts"),
    source("src/server/repositories/regions-competitive-repository.ts"),
    source("src/components/game/RegionsRankedExperience.tsx"),
    source("src/components/game/RegionsLeaderboard.tsx"),
    source("src/components/game/RegionsExperience.tsx"),
    source("src/components/game/GameBoard.tsx"),
    source("src/app/api/regions/leaderboards/route.ts"),
  ]);
  const checks: Record<string, boolean> = {};
  const check = (name: string, condition: boolean) => { assert.equal(condition, true, name); checks[name] = true; };

  const puzzle = regionsPuzzles[0];
  const proof = solvePuzzle(puzzle, 1).solutions[0];
  assert(proof);
  check("pureProofAcceptsSolution", verifyRegionsCompletion(puzzle, proof));
  check("pureProofRejectsIncomplete", !verifyRegionsCompletion(puzzle, proof.slice(1)));
  check("pureProofRejectsDuplicate", !verifyRegionsCompletion(puzzle, [proof[0], ...proof.slice(0, -1)]));
  check("attemptSchema", migration.includes("regions_competitive_attempts") && migration.includes("prepared_expires_at"));
  check("submissionSchema", migration.includes("regions_competitive_submissions") && migration.includes("unique (attempt_id, submission_key)"));
  check("resultSchema", migration.includes("regions_competitive_results") && migration.includes("attempt_id uuid not null unique"));
  check("localResultsSeparate", !migration.includes("alter table app.regions_results"));
  check("explicitStatuses", ["prepared", "active", "completed", "expired", "abandoned", "invalid"].every((status) => migration.includes(`'${status}'`)));
  check("oneOpenAttempt", migration.includes("regions_competitive_attempts_one_open_per_player") && migration.includes("where status in ('prepared', 'active')"));
  check("rankingIndexes", migration.includes("classic_rank_idx") && migration.includes("journey_rank_idx") && migration.includes("time_attack_rank_idx"));
  check("serverIdentityEveryMutation", (actions.match(/requireArenaIdentity\(\)/g)?.length ?? 0) >= 7);
  check("clientCannotSupplySubject", !ranked.includes("subjectId") && !ranked.includes("playerId"));
  check("prepareStartHandshake", actions.includes("prepareRegionsRankedAttemptAction") && actions.includes("startRegionsRankedAttemptAction"));
  check("startNotOnPrepare", repository.includes("status = 'active', started_at = clock_timestamp()") && migration.includes("started_at timestamptz"));
  check("serverDeadline", repository.includes("deadline_at = clock_timestamp()") && repository.includes("180 seconds"));
  check("timeAttackFixed180", migration.includes("session_duration_seconds = 180"));
  check("serverReceiptClock", repository.includes("select clock_timestamp() as now"));
  check("browserElapsedIgnored", ranked.includes("elapsedMs:") && !service.includes("request.elapsedMs"));
  check("browserBoardsIgnored", ranked.includes("boardsSolved:") && !service.includes("request.boardsSolved"));
  check("browserRemainingIgnored", ranked.includes("remainingSeconds:") && !service.includes("request.remainingSeconds"));
  check("proofInCompletionPayload", board.includes("proof: nextRegions.map"));
  check("trustedCatalogValidation", service.includes("verifyRegionsCompletion(expectedPuzzle") && service.includes("regionsPuzzles[attempt.currentPuzzleIndex]"));
  check("orderedProgression", repository.includes("current_puzzle_index !== input.expectedPuzzleIndex"));
  check("ownershipJoin", repository.includes("p.subject_id = $2"));
  check("rowLock", repository.includes("for update of a"));
  check("atomicFinalization", repository.includes("withTransaction") && repository.includes("insertResult(client"));
  check("idempotentRetry", repository.includes("submission_key = $2") && service.includes("getOwnedBySubmission"));
  check("bestPerPlayer", (repository.match(/partition by r.player_id/g)?.length ?? 0) === 3);
  check("classicPerPuzzle", repository.includes("r.puzzle_id = $1"));
  check("journeyRanking", repository.includes("catalog_cleared desc, boards_solved desc, trusted_elapsed_ms"));
  check("timeAttackRanking", repository.includes("r.boards_solved desc, r.trusted_elapsed_ms"));
  check("boundedTop50", service.includes("Math.min(50") && leaderboard.includes("Top 50"));
  check("publicDtoNoIdentity", !leaderboard.includes("subjectId") && !leaderboard.includes("playerId") && !leaderboard.includes("attemptId"));
  check("safeRoute", route.includes("Cache-Control") && route.includes("no-store"));
  check("localAndRankedDistinct", experience.includes("Local play") && experience.includes("Ranked run"));
  check("leaderboardEntryPoint", experience.includes("View Leaderboards"));
  check("leaderboardTabs", leaderboard.includes("CLASSIC") || leaderboard.includes('"classic"'));
  check("classicPuzzleSelector", leaderboard.includes("puzzleId") && leaderboard.includes("regionsPuzzles.map"));
  check("rankedNickname", ranked.includes("Playing as {profile.nickname}"));
  check("eligibilityLabel", ranked.includes("Leaderboard eligible"));
  check("explicitReadyStart", ranked.includes("Prepare ranked run") && ranked.includes("Start ranked run"));
  check("latencyDisclosure", ranked.includes("network latency is included") && leaderboard.includes("Network latency is included"));
  check("profileRequired", ranked.includes("A player name is required") && ranked.includes("Local play remains available"));
  check("mobileGrid", leaderboard.includes("grid-cols-[3rem_1fr_auto]") && experience.includes("grid-cols-2"));
  check("noCheatProofClaim", !ranked.toLowerCase().includes("cheat-proof") && !leaderboard.toLowerCase().includes("cheat-proof"));
  check("repairScriptUntouchedByFeature", !migration.includes("schema_migrations") && !service.includes("schema_migrations"));

  console.log(JSON.stringify({ checksPassed: Object.keys(checks).length, checks }, null, 2));
}

void main();
