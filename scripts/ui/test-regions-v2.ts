import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { verifyPuzzle } from "../../src/game/engine/verify-puzzle";
import { regionsPuzzles } from "../../src/game/puzzles";

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

async function main(): Promise<void> {
  const [experience, catalog, page, board, puzzle001, puzzle002, puzzle003] = await Promise.all([
    source("src/components/game/RegionsExperience.tsx"),
    source("src/game/puzzles/index.ts"),
    source("src/app/play/page.tsx"),
    source("src/components/game/GameBoard.tsx"),
    source("src/game/puzzles/puzzle-001.ts"),
    source("src/game/puzzles/puzzle-002.ts"),
    source("src/game/puzzles/puzzle-003.ts"),
  ]);
  const checks: Record<string, boolean> = {};
  function check(name: string, condition: boolean): void {
    assert.equal(condition, true, name);
    checks[name] = true;
  }
  check("clientProgressionBoundary", experience.startsWith('"use client"'));
  check("pageUsesRegionsExperience", page.includes("RegionsExperience"));
  check("catalogExportsPuzzles", catalog.includes("regionsPuzzles"));
  check("catalogHasTwentyBoards", catalog.includes("puzzle001") && catalog.includes("puzzle002") && catalog.includes("puzzle003") && catalog.includes("expandedRegionsPuzzles"));
  check("catalogSelectsSafely", catalog.includes("regionsPuzzles[index]") && catalog.includes("?? puzzle001"));
  check("catalogCount", regionsPuzzles.length === 20);
  check("catalogOrdersStable", regionsPuzzles.every((puzzle, index) => puzzle.order === index + 1));
  check("difficultyCoverage", new Set(regionsPuzzles.map((puzzle) => puzzle.difficulty)).size === 5);
  for (const [name, sourceText] of [["001", puzzle001], ["002", puzzle002], ["003", puzzle003]] as const) {
    check(`board:${name}:definition`, sourceText.includes("PuzzleDefinition"));
    check(`board:${name}:fiveByFive`, sourceText.includes("rows: 5") && sourceText.includes("cols: 5"));
    check(`board:${name}:fiveClues`, (sourceText.match(/position:/g) ?? []).length === 5);
  }
  for (const puzzle of regionsPuzzles) {
    const verification = verifyPuzzle(puzzle);
    check(`verified:${puzzle.id}`, verification.valid);
    check(`dimensions:${puzzle.id}`, puzzle.rows > 0 && puzzle.cols > 0);
  }
  check("boardSwitchesByKey", experience.includes("puzzle.id}`"));
  check("boardCounterVisible", experience.includes("Puzzle {puzzleIndex + 1} / {regionsPuzzles.length}"));
  check("nextPuzzleCallback", experience.includes("onNextPuzzle"));
  check("nextPuzzleAdvances", experience.includes("current + 1"));
  check("finalPuzzleStops", experience.includes("isFinalPuzzle") && experience.includes("catalogComplete"));
  check("catalogCompletionState", experience.includes("catalogComplete={mode === \"classic\" && isFinalPuzzle}") && board.includes("catalogComplete = false"));
  check("completionDoesNotChangeValidator", board.includes("validateRegion") && board.includes("isPuzzleComplete"));
  check("completionDoesNotChangeScoring", board.includes("BASE_REGION_SCORE") && board.includes("PERFECT_GAME_BONUS"));
  check("completionDoesNotChangeTimer", board.includes("setElapsedSeconds") && board.includes("window.setInterval"));
  check("nextPuzzleIsOptional", board.includes("onNextPuzzle?: () => void"));
  check("playAgainPreserved", board.includes("onClick={handleReset}") && board.includes("Play Again"));
  check("noArenaCoupling", !experience.includes("Arena") && !catalog.includes("Arena"));
  console.log(JSON.stringify({ checksPassed: Object.keys(checks).length, checks }, null, 2));
}

void main();
