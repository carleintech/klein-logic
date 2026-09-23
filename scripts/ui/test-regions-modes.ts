import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

async function main(): Promise<void> {
  const [experience, board] = await Promise.all([
    source("src/components/game/RegionsExperience.tsx"),
    source("src/components/game/GameBoard.tsx"),
  ]);
  const checks: Record<string, boolean> = {};
  function check(name: string, condition: boolean): void {
    assert.equal(condition, true, name);
    checks[name] = true;
  }

  for (const mode of ["classic", "journey", "time-attack"]) check(`mode:${mode}`, experience.includes(`id: "${mode}"`));
  check("selectionBoundary", experience.includes("if (!mode)"));
  check("classicCountUp", experience.includes('mode === "classic"') && board.includes("formatTime(elapsedSeconds)"));
  check("classicNext", experience.includes("mode === \"classic\" && !isFinalPuzzle"));
  check("classicFinal", experience.includes("catalogComplete={mode === \"classic\" && isFinalPuzzle}"));
  check("journeyStartsAtOne", experience.includes("setPuzzleIndex(0)"));
  check("journeyOrdered", experience.includes("current + 1"));
  check("journeyTracksSolved", experience.includes("setBoardsSolved(solved)"));
  check("journeyTracksElapsed", experience.includes("setSessionElapsed") && experience.includes("startedAt.current"));
  check("journeyUsesCatalogDifficulty", experience.includes("puzzle.difficulty"));
  check("journeyComplete", experience.includes("Journey Complete"));
  check("journeyNoWrap", experience.includes("isFinalPuzzle") && !experience.includes("% regionsPuzzles.length"));
  check("timeAttackDuration", experience.includes("TIME_ATTACK_SECONDS = 180"));
  check("timeAttackDeadline", experience.includes("deadline.current") && experience.includes("TIME_ATTACK_SECONDS * 1000"));
  check("timeAttackSharedClock", experience.includes('mode !== "time-attack"') && experience.includes("setRemainingSeconds"));
  check("timeAttackDoesNotResetBoardClock", experience.includes("suppressBoardTimer={mode === \"time-attack\"}"));
  check("timeAttackAdvances", experience.includes("mode === \"journey\" ? 450 : 300"));
  check("timeAttackTimeout", experience.includes("nextRemaining <= 0") && experience.includes("setStatus(\"complete\")"));
  check("timeAttackNoWrap", experience.includes("isFinalPuzzle"));
  check("timeAttackResults", experience.includes("Time Attack Complete") && experience.includes("Boards solved"));
  check("timestampBasedClock", experience.includes("Date.now()") && experience.includes("deadline.current - now"));
  check("meaningfulWarningOnly", experience.includes("nextRemaining <= 10") && experience.includes("warningPlayed"));
  check("feedbackObserved", experience.includes("feedbackApi.warning()") && experience.includes("feedbackApi.roundChange()"));
  check("timeoutFeedback", experience.includes("feedbackApi.failure()"));
  check("boardCompletionCallback", board.includes("onComplete?: (result: GameBoardCompletion)") && board.includes("onComplete?.({"));
  check("boardOwnsCompletion", board.includes("isPuzzleComplete(puzzle, nextRegions)"));
  check("boardOwnsScoring", board.includes("BASE_REGION_SCORE"));
  check("boardOwnsHints", board.includes("HINT_PENALTY") && board.includes("handleHint"));
  check("boardOwnsUndo", board.includes("handleUndo"));
  check("modeNeutralBoard", !board.includes("RegionsMode") && !board.includes("time-attack"));
  check("resetMode", experience.includes("exitToModes") && experience.includes("setMode(null)"));
  check("restartMode", experience.includes("onClick={() => startMode(mode)}"));
  check("reducedMotionInherited", !experience.includes("requestAnimationFrame"));
  check("noPersistence", !experience.includes("localStorage") && !experience.includes("fetch("));
  check("noLeaderboard", !experience.includes("leaderboard") && !experience.includes("nickname"));
  check("noI18nDependency", !experience.includes("i18n") && !experience.includes("next-intl"));

  console.log(JSON.stringify({ checksPassed: Object.keys(checks).length, checks }, null, 2));
}

void main();
