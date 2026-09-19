import type { ValidationError } from "./validator";

export function getValidationMessage(error: ValidationError): string {
  switch (error) {
    case "outside-board":
      return "That region goes outside the board.";

    case "missing-clue":
      return "The region must contain its clue.";

    case "wrong-size":
      return "That region has the wrong number of cells.";

    case "wrong-shape":
      return "That region has the wrong shape.";

    case "contains-other-clue":
      return "A region cannot contain another clue.";

    case "overlap":
      return "That region overlaps another region.";

    default: {
      const exhaustiveCheck: never = error;
      return exhaustiveCheck;
    }
  }
}
