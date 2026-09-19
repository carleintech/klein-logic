import type { CellPosition, RegionShape } from "@/game/types/puzzle";

export type Rectangle = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};

export type RectangleDimensions = {
  width: number;
  height: number;
  area: number;
};

export function createRectangle(
  start: CellPosition,
  end: CellPosition,
): Rectangle {
  return {
    top: Math.min(start.row, end.row),
    left: Math.min(start.col, end.col),
    bottom: Math.max(start.row, end.row),
    right: Math.max(start.col, end.col),
  };
}

export function getRectangleDimensions(
  rectangle: Rectangle,
): RectangleDimensions {
  const width = rectangle.right - rectangle.left + 1;

  const height = rectangle.bottom - rectangle.top + 1;

  return {
    width,
    height,
    area: width * height,
  };
}

export function getRectangleShape(
  rectangle: Rectangle,
): Exclude<RegionShape, "any"> {
  const { width, height } = getRectangleDimensions(rectangle);

  if (width === height) {
    return "square";
  }

  if (width > height) {
    return "wide";
  }

  return "tall";
}

export function rectangleContainsCell(
  rectangle: Rectangle,
  position: CellPosition,
): boolean {
  return (
    position.row >= rectangle.top &&
    position.row <= rectangle.bottom &&
    position.col >= rectangle.left &&
    position.col <= rectangle.right
  );
}

export function rectanglesOverlap(a: Rectangle, b: Rectangle): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

export function rectangleIsInsideBoard(
  rectangle: Rectangle,
  rows: number,
  cols: number,
): boolean {
  return (
    rectangle.top >= 0 &&
    rectangle.left >= 0 &&
    rectangle.bottom < rows &&
    rectangle.right < cols
  );
}

export function getRectangleCells(rectangle: Rectangle): CellPosition[] {
  const cells: CellPosition[] = [];

  for (let row = rectangle.top; row <= rectangle.bottom; row++) {
    for (let col = rectangle.left; col <= rectangle.right; col++) {
      cells.push({
        row,
        col,
      });
    }
  }

  return cells;
}
