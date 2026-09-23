import type { PuzzleDefinition, RegionDifficulty, RegionShape } from "@/game/types/puzzle";

type Blueprint = {
  id: string;
  title: string;
  difficulty: RegionDifficulty;
  order: number;
  rows: number[];
  columns: number[];
};

const BLUEPRINTS: Blueprint[] = [
  { id: "004", title: "Four Corners", difficulty: "introductory", order: 4, rows: [2, 2], columns: [2, 2] },
  { id: "005", title: "Cross Current", difficulty: "introductory", order: 5, rows: [2, 2], columns: [3, 1] },
  { id: "006", title: "Long Horizon", difficulty: "easy", order: 6, rows: [1, 1, 3], columns: [2, 3] },
  { id: "007", title: "Five Signals", difficulty: "easy", order: 7, rows: [2, 2, 1], columns: [2, 2, 1] },
  { id: "008", title: "Open Field", difficulty: "easy", order: 8, rows: [3, 3], columns: [2, 3] },
  { id: "009", title: "Vertical Divide", difficulty: "easy", order: 9, rows: [2, 2, 2], columns: [2, 2] },
  { id: "010", title: "Balanced Grid", difficulty: "easy", order: 10, rows: [3, 3], columns: [3, 3] },
  { id: "011", title: "Measured Steps", difficulty: "medium", order: 11, rows: [1, 2, 2, 1], columns: [2, 2, 2] },
  { id: "012", title: "Narrow Passage", difficulty: "medium", order: 12, rows: [2, 2, 2], columns: [1, 2, 3] },
  { id: "013", title: "Signal Matrix", difficulty: "medium", order: 13, rows: [2, 2, 2], columns: [2, 3, 1] },
  { id: "014", title: "Quiet Geometry", difficulty: "medium", order: 14, rows: [1, 3, 2], columns: [3, 1, 2] },
  { id: "015", title: "Deep Pattern", difficulty: "medium", order: 15, rows: [2, 3, 2], columns: [1, 3, 2] },
  { id: "016", title: "Hard Boundary", difficulty: "hard", order: 16, rows: [1, 2, 2, 2, 1], columns: [2, 2, 2] },
  { id: "017", title: "Dense Relation", difficulty: "hard", order: 17, rows: [2, 1, 3, 2], columns: [3, 2, 1] },
  { id: "018", title: "Edge Theory", difficulty: "hard", order: 18, rows: [1, 3, 1, 3], columns: [1, 2, 3] },
  { id: "019", title: "Expert Lattice", difficulty: "expert", order: 19, rows: [2, 2, 2, 2], columns: [2, 2, 2, 2] },
  { id: "020", title: "Master Signal", difficulty: "expert", order: 20, rows: [1, 2, 3, 2, 2], columns: [2, 1, 3, 2] },
];

function shapeFor(width: number, height: number): RegionShape {
  if (width === height) return "square";
  return width > height ? "wide" : "tall";
}

function buildLayout(rows: number[], columns: number[]): string[][] {
  const labels = rows.flatMap((_, rowBand) =>
    columns.map((_, columnBand) => String.fromCharCode(97 + rowBand * columns.length + columnBand)),
  );
  let labelIndex = 0;
  return rows.flatMap((height) => {
    const rowLabels = columns.map(() => labels[labelIndex++]);
    return Array.from({ length: height }, () =>
      columns.flatMap((width, columnIndex) => Array.from({ length: width }, () => rowLabels[columnIndex])),
    );
  });
}

function buildPuzzle(blueprint: Blueprint): PuzzleDefinition {
  const layout = buildLayout(blueprint.rows, blueprint.columns);
  const regions = new Map<string, { top: number; left: number; bottom: number; right: number }>();

  layout.forEach((row, rowIndex) => row.forEach((label, colIndex) => {
    const current = regions.get(label);
    regions.set(label, current
      ? { top: Math.min(current.top, rowIndex), left: Math.min(current.left, colIndex), bottom: Math.max(current.bottom, rowIndex), right: Math.max(current.right, colIndex) }
      : { top: rowIndex, left: colIndex, bottom: rowIndex, right: colIndex });
  }));

  const clues = [...regions.entries()].map(([label, rectangle]) => {
    const width = rectangle.right - rectangle.left + 1;
    const height = rectangle.bottom - rectangle.top + 1;
    return {
      id: `region-${label}`,
      position: { row: rectangle.top, col: rectangle.left },
      size: width * height,
      shape: shapeFor(width, height),
    };
  });

  return {
    id: blueprint.id,
    title: blueprint.title,
    rows: layout.length,
    cols: layout[0]?.length ?? 0,
    clues,
    difficulty: blueprint.difficulty,
    order: blueprint.order,
    parTimeSeconds: Math.max(30, layout.length * (layout[0]?.length ?? 0) * 2),
  };
}

export const expandedRegionsPuzzles = BLUEPRINTS.map(buildPuzzle);
