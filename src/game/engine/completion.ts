import type { PuzzleDefinition } from "@/game/types/puzzle";

import type { PlacedRegion } from "./validator";

import { getRectangleDimensions } from "./geometry";

export function isPuzzleComplete(
  puzzle: PuzzleDefinition,
  regions: PlacedRegion[],
): boolean {
  // Every clue must have a region.
  if (regions.length !== puzzle.clues.length) {
    return false;
  }

  // Since validation prevents overlap,
  // adding all region areas tells us whether
  // every board cell has been covered.
  const coveredCells = regions.reduce((total, region) => {
    return total + getRectangleDimensions(region.rectangle).area;
  }, 0);

  const boardCells = puzzle.rows * puzzle.cols;

  return coveredCells === boardCells;
}
