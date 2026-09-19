import type { PuzzleDefinition } from "@/game/types/puzzle";

import { getCandidateRectangles, solvePuzzle } from "./solver";

export function verifyPuzzle(puzzle: PuzzleDefinition) {
  const result = solvePuzzle(puzzle, 2);

  const candidates = puzzle.clues.map((clue) => ({
    clueId: clue.id,
    size: clue.size,
    candidates: getCandidateRectangles(puzzle, clue).length,
  }));

  return {
    puzzleId: puzzle.id,
    candidates,
    solutionCount: result.solutionCount,
    unique: result.unique,
    valid: result.solutionCount > 0,
  };
}
