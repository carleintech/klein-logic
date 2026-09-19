import type { PuzzleDefinition, PuzzleClue } from "@/game/types/puzzle";

import {
  type Rectangle,
  getRectangleDimensions,
  getRectangleShape,
  rectangleContainsCell,
  rectangleIsInsideBoard,
  rectanglesOverlap,
} from "./geometry";

export type PlacedRegion = {
  clueId: string;
  rectangle: Rectangle;
};

export type ValidationError =
  | "outside-board"
  | "missing-clue"
  | "wrong-size"
  | "wrong-shape"
  | "contains-other-clue"
  | "overlap";

export type ValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      reason: ValidationError;
    };

type ValidateRegionOptions = {
  puzzle: PuzzleDefinition;
  clue: PuzzleClue;
  rectangle: Rectangle;
  existingRegions: PlacedRegion[];
};

export function validateRegion({
  puzzle,
  clue,
  rectangle,
  existingRegions,
}: ValidateRegionOptions): ValidationResult {
  // 1. Rectangle must remain on the board.
  if (!rectangleIsInsideBoard(rectangle, puzzle.rows, puzzle.cols)) {
    return {
      valid: false,
      reason: "outside-board",
    };
  }

  // 2. Rectangle must contain its own clue.
  if (!rectangleContainsCell(rectangle, clue.position)) {
    return {
      valid: false,
      reason: "missing-clue",
    };
  }

  // 3. Area must equal the clue number.
  const dimensions = getRectangleDimensions(rectangle);

  if (dimensions.area !== clue.size) {
    return {
      valid: false,
      reason: "wrong-size",
    };
  }

  // 4. Shape/orientation must match.
  const actualShape = getRectangleShape(rectangle);

  if (clue.shape !== "any" && clue.shape !== actualShape) {
    return {
      valid: false,
      reason: "wrong-shape",
    };
  }

  // 5. A region cannot swallow another clue.
  const containsOtherClue = puzzle.clues.some((otherClue) => {
    if (otherClue.id === clue.id) {
      return false;
    }

    return rectangleContainsCell(rectangle, otherClue.position);
  });

  if (containsOtherClue) {
    return {
      valid: false,
      reason: "contains-other-clue",
    };
  }

  // 6. Regions cannot overlap.
  const overlapsExisting = existingRegions.some((region) => {
    // Replacing the same clue is allowed.
    if (region.clueId === clue.id) {
      return false;
    }

    return rectanglesOverlap(rectangle, region.rectangle);
  });

  if (overlapsExisting) {
    return {
      valid: false,
      reason: "overlap",
    };
  }

  return {
    valid: true,
  };
}
