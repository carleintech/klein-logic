import type { ValidationError } from "./validator";

type MessageContext = {
  expectedSize?: number;
};

export function getValidationMessage(
  error: ValidationError,
  context: MessageContext = {},
): string {
  switch (error) {
    case "outside-board":
      return "That region goes outside the board.";

    case "missing-clue":
      return "The region must contain the numbered clue.";

    case "wrong-size":
      return context.expectedSize
        ? `Oops! This region must contain exactly ${context.expectedSize} cells.`
        : "Oops! This region has the wrong number of cells.";

    case "wrong-shape":
      return "Oops! That region has the wrong orientation.";

    case "contains-other-clue":
      return "A region cannot contain another numbered clue.";

    case "overlap":
      return "That region overlaps another completed region.";

    default: {
      const exhaustiveCheck: never = error;

      return exhaustiveCheck;
    }
  }
}
