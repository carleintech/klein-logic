"use client";

import { useState } from "react";
import type { PuzzleDefinition, PuzzleClue } from "@/game/types/puzzle";

type GameBoardProps = {
  puzzle: PuzzleDefinition;
};

type CellState = {
  regionId: string | null;
};

export default function GameBoard({ puzzle }: GameBoardProps) {
  const [cells, setCells] = useState<CellState[]>(() =>
    Array.from({ length: puzzle.rows * puzzle.cols }, () => ({
      regionId: null,
    })),
  );

  const getIndex = (row: number, col: number) => {
    return row * puzzle.cols + col;
  };

  const getClue = (row: number, col: number): PuzzleClue | undefined => {
    return puzzle.clues.find(
      (clue) => clue.position.row === row && clue.position.col === col,
    );
  };

  const handleCellClick = (row: number, col: number) => {
    const clue = getClue(row, col);

    if (!clue) {
      return;
    }

    const index = getIndex(row, col);

    setCells((current) => {
      const next = [...current];

      next[index] = {
        regionId: clue.id,
      };

      return next;
    });
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <div
        className="grid overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900"
        style={{
          gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({
          length: puzzle.rows,
        }).map((_, row) =>
          Array.from({
            length: puzzle.cols,
          }).map((_, col) => {
            const index = getIndex(row, col);

            const clue = getClue(row, col);

            const state = cells[index];

            return (
              <button
                key={`${row}-${col}`}
                type="button"
                onClick={() => handleCellClick(row, col)}
                className={[
                  "relative aspect-square",
                  "border-b border-r border-neutral-700",
                  "transition-colors",
                  "hover:bg-neutral-800",
                  state.regionId ? "bg-neutral-700" : "bg-neutral-900",
                ].join(" ")}
              >
                {clue && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-xl font-bold text-black shadow">
                      {clue.size}
                    </span>
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
