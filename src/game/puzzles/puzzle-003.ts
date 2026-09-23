import type { PuzzleDefinition } from "@/game/types/puzzle";

export const puzzle003: PuzzleDefinition = {
  id: "003",
  title: "Vertical Echo",
  difficulty: "introductory",
  order: 3,
  rows: 5,
  cols: 5,
  clues: [
    { id: "red", position: { row: 4, col: 0 }, size: 3, shape: "wide" },
    { id: "yellow", position: { row: 4, col: 4 }, size: 4, shape: "any" },
    { id: "green", position: { row: 2, col: 2 }, size: 8, shape: "any" },
    { id: "purple", position: { row: 0, col: 0 }, size: 4, shape: "any" },
    { id: "blue", position: { row: 0, col: 4 }, size: 6, shape: "tall" },
  ],
};
