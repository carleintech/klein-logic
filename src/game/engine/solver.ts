import type {
  PuzzleClue,
  PuzzleDefinition,
  RegionShape,
} from "@/game/types/puzzle";

import {
  type Rectangle,
  getRectangleDimensions,
  getRectangleShape,
  rectangleContainsCell,
  rectanglesOverlap,
} from "./geometry";

import type { PlacedRegion } from "./validator";

export type PuzzleSolution = PlacedRegion[];

export type SolveResult = {
  solutions: PuzzleSolution[];
  solutionCount: number;
  unique: boolean;
};

function shapeMatches(
  rectangle: Rectangle,
  requiredShape: RegionShape,
): boolean {
  if (requiredShape === "any") {
    return true;
  }

  return getRectangleShape(rectangle) === requiredShape;
}

/*
 * Generate every rectangle that could legally belong
 * to one particular clue.
 *
 * This does NOT consider already placed regions yet.
 */
export function getCandidateRectangles(
  puzzle: PuzzleDefinition,
  clue: PuzzleClue,
): Rectangle[] {
  const candidates: Rectangle[] = [];

  for (let top = 0; top < puzzle.rows; top++) {
    for (let left = 0; left < puzzle.cols; left++) {
      for (let bottom = top; bottom < puzzle.rows; bottom++) {
        for (let right = left; right < puzzle.cols; right++) {
          const rectangle: Rectangle = {
            top,
            left,
            bottom,
            right,
          };

          const dimensions = getRectangleDimensions(rectangle);

          /*
           * Region must contain exactly the number
           * of cells specified by its clue.
           */
          if (dimensions.area !== clue.size) {
            continue;
          }

          /*
           * Region must contain its own clue.
           */
          if (!rectangleContainsCell(rectangle, clue.position)) {
            continue;
          }

          /*
           * Region must satisfy its shape rule.
           */
          if (!shapeMatches(rectangle, clue.shape)) {
            continue;
          }

          /*
           * A region may not contain another clue.
           */
          const containsOtherClue = puzzle.clues.some((otherClue) => {
            if (otherClue.id === clue.id) {
              return false;
            }

            return rectangleContainsCell(rectangle, otherClue.position);
          });

          if (containsOtherClue) {
            continue;
          }

          candidates.push(rectangle);
        }
      }
    }
  }

  return candidates;
}

function overlapsAnyRegion(
  rectangle: Rectangle,
  regions: PlacedRegion[],
): boolean {
  return regions.some((region) =>
    rectanglesOverlap(rectangle, region.rectangle),
  );
}

function coversWholeBoard(
  puzzle: PuzzleDefinition,
  regions: PlacedRegion[],
): boolean {
  if (regions.length !== puzzle.clues.length) {
    return false;
  }

  const covered = new Set<string>();

  for (const region of regions) {
    for (
      let row = region.rectangle.top;
      row <= region.rectangle.bottom;
      row++
    ) {
      for (
        let col = region.rectangle.left;
        col <= region.rectangle.right;
        col++
      ) {
        const key = `${row}:${col}`;

        /*
         * This should already be prevented by
         * overlap checking, but keep this defensive.
         */
        if (covered.has(key)) {
          return false;
        }

        covered.add(key);
      }
    }
  }

  return covered.size === puzzle.rows * puzzle.cols;
}

/*
 * Solve the puzzle using backtracking.
 *
 * maxSolutions defaults to 2 because uniqueness only
 * requires knowing:
 *
 * 0 solutions = invalid
 * 1 solution  = unique
 * 2+          = ambiguous
 */
export function solvePuzzle(
  puzzle: PuzzleDefinition,
  maxSolutions = 2,
): SolveResult {
  const candidateMap = new Map<string, Rectangle[]>();

  for (const clue of puzzle.clues) {
    candidateMap.set(clue.id, getCandidateRectangles(puzzle, clue));
  }

  /*
   * Search the most constrained clues first.
   *
   * A clue with only one possible rectangle should
   * be considered before one with many possibilities.
   */
  const orderedClues = [...puzzle.clues].sort((a, b) => {
    const aCount = candidateMap.get(a.id)?.length ?? 0;

    const bCount = candidateMap.get(b.id)?.length ?? 0;

    return aCount - bCount;
  });

  const solutions: PuzzleSolution[] = [];

  function search(clueIndex: number, placedRegions: PlacedRegion[]) {
    if (solutions.length >= maxSolutions) {
      return;
    }

    /*
     * Every clue has been assigned.
     */
    if (clueIndex === orderedClues.length) {
      if (coversWholeBoard(puzzle, placedRegions)) {
        solutions.push(
          placedRegions.map((region) => ({
            clueId: region.clueId,
            rectangle: {
              ...region.rectangle,
            },
          })),
        );
      }

      return;
    }

    const clue = orderedClues[clueIndex];

    const candidates = candidateMap.get(clue.id) ?? [];

    for (const rectangle of candidates) {
      if (overlapsAnyRegion(rectangle, placedRegions)) {
        continue;
      }

      search(clueIndex + 1, [
        ...placedRegions,
        {
          clueId: clue.id,
          rectangle,
        },
      ]);

      if (solutions.length >= maxSolutions) {
        return;
      }
    }
  }

  search(0, []);

  return {
    solutions,
    solutionCount: solutions.length,
    unique: solutions.length === 1,
  };
}
