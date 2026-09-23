import type { PuzzleDefinition } from "@/game/types/puzzle";

import { isPuzzleComplete } from "./completion";
import { validateRegion, type PlacedRegion } from "./validator";

export type RegionsCompletionProof = ReadonlyArray<Readonly<PlacedRegion>>;

export function verifyRegionsCompletion(
  puzzle: PuzzleDefinition,
  proof: unknown,
): boolean {
  if (!Array.isArray(proof)) return false;
  if (proof.length !== puzzle.clues.length) return false;

  const placed: PlacedRegion[] = [];
  const usedClues = new Set<string>();

  for (const submitted of proof) {
    if (
      typeof submitted !== "object" || submitted === null ||
      !("clueId" in submitted) || typeof submitted.clueId !== "string" ||
      !("rectangle" in submitted) || typeof submitted.rectangle !== "object" || submitted.rectangle === null
    ) return false;
    const rectangle = submitted.rectangle as Record<string, unknown>;
    if (![rectangle.top, rectangle.left, rectangle.bottom, rectangle.right].every(Number.isInteger)) return false;
    if (usedClues.has(submitted.clueId)) return false;
    const clue = puzzle.clues.find((candidate) => candidate.id === submitted.clueId);
    if (!clue) return false;

    const region: PlacedRegion = {
      clueId: submitted.clueId,
      rectangle: {
        top: rectangle.top as number,
        left: rectangle.left as number,
        bottom: rectangle.bottom as number,
        right: rectangle.right as number,
      },
    };
    if (!validateRegion({ puzzle, clue, rectangle: region.rectangle, existingRegions: placed }).valid) {
      return false;
    }
    placed.push(region);
    usedClues.add(region.clueId);
  }

  return isPuzzleComplete(puzzle, placed);
}
