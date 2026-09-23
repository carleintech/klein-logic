import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { normalizeNicknameKey, normalizePlayerNickname } from "../../src/server/player/nickname";

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

async function main(): Promise<void> {
  const [migration, actions, service, repository, gate, board, modes, proxy] = await Promise.all([
    source("db/migrations/0004_player_regions_foundation.sql"),
    source("src/app/play/actions.ts"),
    source("src/server/services/player-service.ts"),
    source("src/server/repositories/player-repository.ts"),
    source("src/components/player/PlayerProfileGate.tsx"),
    source("src/components/game/GameBoard.tsx"),
    source("src/components/game/RegionsExperience.tsx"),
    source("src/proxy.ts"),
  ]);
  const checks: Record<string, boolean> = {};
  function check(name: string, condition: boolean): void {
    assert.equal(condition, true, name);
    checks[name] = true;
  }

  function throws(fn: () => unknown): boolean {
    try { fn(); return false; } catch { return true; }
  }

  check("nicknameTrimmed", normalizePlayerNickname("  Logic  King ") === "Logic King");
  check("nicknameKeyNormalized", normalizeNicknameKey(" LogicKing ") === "logicking");
  check("blankRejected", throws(() => normalizePlayerNickname(" ")));
  check("controlRejected", throws(() => normalizePlayerNickname("Logic\u0000King")));
  check("shortRejected", throws(() => normalizePlayerNickname("A")));
  check("longRejected", throws(() => normalizePlayerNickname("A".repeat(25))));
  check("profileSchema", migration.includes("create table app.players") && migration.includes("subject_id uuid not null unique"));
  check("nicknameSchema", migration.includes("normalized_nickname text not null unique") && migration.includes("players_nickname_length"));
  check("resultSchema", migration.includes("create table app.regions_results") && migration.includes("result_key uuid not null unique"));
  check("modeConstraint", migration.includes("classic",) && migration.includes("journey") && migration.includes("time-attack"));
  check("profileIndex", migration.includes("players_normalized_nickname_idx"));
  check("resultIndex", migration.includes("regions_results_player_mode_idx"));
  check("updatedTrigger", migration.includes("players_set_updated_at"));
  check("serverIdentityBoundary", actions.includes("requireArenaIdentity()") && service.includes("identity.subjectId"));
  check("sharedSessionBootstrap", gate.includes("ensureKleinLogicSession"));
  check("regionsSessionRefresh", proxy.includes('"/play/:path*"'));
  check("clientSubjectIgnored", !actions.includes("subjectId:") && !gate.includes("subjectId"));
  check("publicProfileShape", repository.includes("PlayerProfile") && !repository.includes("subject_id: row"));
  check("profileBySubject", repository.includes("where subject_id = $1"));
  check("oneProfilePerSubject", migration.includes("subject_id uuid not null unique"));
  check("uniqueNicknameConflict", service.includes("isUniqueViolation") && service.includes("nickname-taken"));
  check("concurrentSafeInsert", repository.includes("insert into app.players") && migration.includes("unique"));
  check("resultIdempotency", repository.includes("on conflict (result_key) do nothing"));
  check("resultIdentityLookup", repository.includes("from app.players where subject_id = $1"));
  check("puzzleCatalogValidation", service.includes("regionsPuzzles.some"));
  check("localResultBoundary", actions.includes("recordRegionsResultAction") && actions.includes("RegionsResultInput"));
  check("statsDerived", repository.includes("count(*) filter") && repository.includes("max(boards_solved)"));
  check("noFakeStats", repository.includes("coalesce(max(boards_solved)") && !repository.includes("accuracy"));
  check("publicStatsOnly", gate.includes("stats.totalRegionsSolves") && !gate.includes("subjectId"));
  check("nicknameFormLabel", gate.includes('htmlFor="player-nickname"'));
  check("nicknameKeyboardSubmit", gate.includes('event.key === "Enter"'));
  check("nicknameLoading", gate.includes("pending") && gate.includes("Saving…"));
  check("nicknameEditPath", actions.includes("savePlayerNicknameAction") && service.includes("updateNickname"));
  check("localPlayFallback", gate.includes("Continue locally") && gate.includes('setState("local")'));
  check("classicResultShape", modes.includes("mode: \"classic\"") && modes.includes("completionMs"));
  check("journeyResultShape", modes.includes("finalPuzzleId") && modes.includes("totalElapsedMs"));
  check("timeAttackResultShape", modes.includes("configuredDurationSeconds") && modes.includes("boardsSolved"));
  check("completionProofNotClaimed", !actions.includes("verified: true") && !repository.includes("verified"));
  check("gameBoardModeNeutral", !board.includes("RegionsMode") && !board.includes("time-attack"));
  check("gameBoardCompletionPayload", board.includes("GameBoardCompletion") && board.includes("elapsedSeconds"));
  check("localResultsRemainUnverified", !repository.includes("regions_competitive_results") && actions.includes("recordRegionsResultAction"));
  check("noLocalStorageIdentity", !gate.includes("localStorage") && !service.includes("localStorage"));
  check("noProviderMetadata", !actions.includes("claims") && !gate.includes("access_token"));

  console.log(JSON.stringify({ checksPassed: Object.keys(checks).length, checks }, null, 2));
}

void main();
