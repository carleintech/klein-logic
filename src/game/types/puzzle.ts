export type CellPosition = {
  row: number;
  col: number;
};

export type RegionShape = "square" | "wide" | "tall" | "any";

export type RegionDifficulty = "introductory" | "easy" | "medium" | "hard" | "expert";

export type PuzzleClue = {
  id: string;

  position: CellPosition;

  size: number;

  shape: RegionShape;
};

export type PuzzleDefinition = {
  id: string;

  title: string;

  rows: number;

  cols: number;

  clues: PuzzleClue[];

  difficulty?: RegionDifficulty;

  order?: number;

  parTimeSeconds?: number;
};
