import type { PuzzleDefinition } from "@/game/types/puzzle";

import { puzzle001 } from "./puzzle-001";
import { puzzle002 } from "./puzzle-002";
import { puzzle003 } from "./puzzle-003";
import { expandedRegionsPuzzles } from "./expanded";

export const regionsPuzzles: PuzzleDefinition[] = [puzzle001, puzzle002, puzzle003, ...expandedRegionsPuzzles];

export function getRegionsPuzzle(index: number): PuzzleDefinition {
  return regionsPuzzles[index] ?? puzzle001;
}
