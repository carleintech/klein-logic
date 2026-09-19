"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type {
  CellPosition,
  PuzzleClue,
  PuzzleDefinition,
} from "@/game/types/puzzle";

import {
  createRectangle,
  getRectangleDimensions,
  rectangleContainsCell,
} from "@/game/engine/geometry";

import {
  validateRegion,
  type PlacedRegion,
  type ValidationError,
} from "@/game/engine/validator";

import { getValidationMessage } from "@/game/engine/messages";
import { isPuzzleComplete } from "@/game/engine/completion";
import { solvePuzzle } from "@/game/engine/solver";

type GameBoardProps = {
  puzzle: PuzzleDefinition;
};

type DrawState = {
  pointerId: number;
  start: CellPosition;
  end: CellPosition;
};

type Feedback =
  | {
      type: "success";
      text: string;
    }
  | {
      type: "warning";
      text: string;
    }
  | {
      type: "danger";
      text: string;
    }
  | {
      type: "info";
      text: string;
    }
  | null;

const MAX_LIVES = 3;

const BASE_REGION_SCORE = 250;
const PERFECT_REGION_BONUS = 100;
const PERFECT_GAME_BONUS = 500;
const NO_HINT_BONUS = 300;
const HINT_PENALTY = 150;

const REGION_COLORS: Record<string, string> = {
  red: "bg-red-600/60",
  yellow: "bg-yellow-500/50",
  green: "bg-green-600/50",
  purple: "bg-purple-600/50",
  blue: "bg-cyan-600/50",
};

const CLUE_COLORS: Record<string, string> = {
  red: "bg-red-500 text-white",
  yellow: "bg-yellow-400 text-black",
  green: "bg-emerald-500 text-white",
  purple: "bg-purple-500 text-white",
  blue: "bg-cyan-500 text-white",
};

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);

  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function rectanglesEqual(
  a: PlacedRegion["rectangle"],
  b: PlacedRegion["rectangle"],
): boolean {
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.bottom === b.bottom &&
    a.right === b.right
  );
}

function shouldLoseLife(error: ValidationError): boolean {
  /*
   * Wrong size is treated as learning feedback.
   * We don't punish a finger-slip or incomplete drag.
   */
  if (error === "wrong-size") {
    return false;
  }

  /*
   * These represent actual illegal submissions.
   */
  return (
    error === "wrong-shape" ||
    error === "contains-other-clue" ||
    error === "overlap" ||
    error === "missing-clue"
  );
}

export default function GameBoard({ puzzle }: GameBoardProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);

  const [regions, setRegions] = useState<PlacedRegion[]>([]);

  const [history, setHistory] = useState<PlacedRegion[][]>([]);

  const [selectedClue, setSelectedClue] = useState<PuzzleClue | null>(null);

  const [draw, setDraw] = useState<DrawState | null>(null);

  const [feedback, setFeedback] = useState<Feedback>(null);

  const [completed, setCompleted] = useState(false);

  const [gameOver, setGameOver] = useState(false);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [lives, setLives] = useState(MAX_LIVES);

  const [hintsUsed, setHintsUsed] = useState(0);

  const [score, setScore] = useState(0);

  const [regionMistakes, setRegionMistakes] = useState<Record<string, number>>(
    {},
  );

  const [lastScoredClue, setLastScoredClue] = useState<string | null>(null);

  /*
   * -------------------------------------------------------
   * TIMER
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (completed || gameOver) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [completed, gameOver]);

  /*
   * -------------------------------------------------------
   * SOLVER
   * -------------------------------------------------------
   */

  const solvedPuzzle = useMemo(() => {
    return solvePuzzle(puzzle, 1);
  }, [puzzle]);

  const solution = solvedPuzzle.solutions[0] ?? null;

  /*
   * -------------------------------------------------------
   * CLUE HELPERS
   * -------------------------------------------------------
   */

  function getClueAt(row: number, col: number): PuzzleClue | undefined {
    return puzzle.clues.find(
      (clue) => clue.position.row === row && clue.position.col === col,
    );
  }

  function getClueById(clueId: string): PuzzleClue | undefined {
    return puzzle.clues.find((clue) => clue.id === clueId);
  }

  /*
   * -------------------------------------------------------
   * POINTER -> GRID CELL
   * -------------------------------------------------------
   */

  function getCellFromPointer(
    clientX: number,
    clientY: number,
  ): CellPosition | null {
    const board = boardRef.current;

    if (!board) {
      return null;
    }

    const bounds = board.getBoundingClientRect();

    const relativeX = clientX - bounds.left;

    const relativeY = clientY - bounds.top;

    if (
      relativeX < 0 ||
      relativeY < 0 ||
      relativeX >= bounds.width ||
      relativeY >= bounds.height
    ) {
      return null;
    }

    const cellWidth = bounds.width / puzzle.cols;

    const cellHeight = bounds.height / puzzle.rows;

    return {
      row: Math.floor(relativeY / cellHeight),
      col: Math.floor(relativeX / cellWidth),
    };
  }

  /*
   * -------------------------------------------------------
   * PREVIEW
   * -------------------------------------------------------
   */

  const previewRectangle = useMemo(() => {
    if (!draw) {
      return null;
    }

    return createRectangle(draw.start, draw.end);
  }, [draw]);

  const previewDimensions = useMemo(() => {
    if (!previewRectangle) {
      return null;
    }

    return getRectangleDimensions(previewRectangle);
  }, [previewRectangle]);

  const previewValidation = useMemo(() => {
    if (!selectedClue || !previewRectangle) {
      return null;
    }

    return validateRegion({
      puzzle,
      clue: selectedClue,
      rectangle: previewRectangle,
      existingRegions: regions,
    });
  }, [selectedClue, previewRectangle, puzzle, regions]);

  /*
   * -------------------------------------------------------
   * BOARD HELPERS
   * -------------------------------------------------------
   */

  function getRegionForCell(
    row: number,
    col: number,
  ): PlacedRegion | undefined {
    return regions.find((region) =>
      rectangleContainsCell(region.rectangle, {
        row,
        col,
      }),
    );
  }

  function isPreviewCell(row: number, col: number): boolean {
    if (!previewRectangle) {
      return false;
    }

    return rectangleContainsCell(previewRectangle, {
      row,
      col,
    });
  }

  function cloneRegions(source: PlacedRegion[]): PlacedRegion[] {
    return source.map((region) => ({
      clueId: region.clueId,
      rectangle: {
        ...region.rectangle,
      },
    }));
  }

  function saveHistory() {
    setHistory((current) => [...current, cloneRegions(regions)]);
  }

  /*
   * -------------------------------------------------------
   * SELECT CLUE
   * -------------------------------------------------------
   */

  function selectClue(clue: PuzzleClue) {
    if (completed || gameOver) {
      return;
    }

    setSelectedClue(clue);

    setDraw(null);

    setFeedback({
      type: "info",
      text: `Region ${clue.size} selected. Draw a rectangle containing exactly ${clue.size} cells.`,
    });
  }

  /*
   * -------------------------------------------------------
   * POINTER DOWN
   * -------------------------------------------------------
   */

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (completed || gameOver) {
      return;
    }

    const position = getCellFromPointer(event.clientX, event.clientY);

    if (!position) {
      return;
    }

    const clueAtPosition = getClueAt(position.row, position.col);

    if (!selectedClue) {
      if (clueAtPosition) {
        selectClue(clueAtPosition);
      }

      return;
    }

    if (clueAtPosition && clueAtPosition.id !== selectedClue.id) {
      selectClue(clueAtPosition);

      return;
    }

    event.preventDefault();

    event.currentTarget.setPointerCapture(event.pointerId);

    setFeedback(null);

    setDraw({
      pointerId: event.pointerId,
      start: position,
      end: position,
    });
  }

  /*
   * -------------------------------------------------------
   * POINTER MOVE
   * -------------------------------------------------------
   */

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draw || completed || gameOver) {
      return;
    }

    if (event.pointerId !== draw.pointerId) {
      return;
    }

    const position = getCellFromPointer(event.clientX, event.clientY);

    if (!position) {
      return;
    }

    setDraw((current) => {
      if (!current) {
        return null;
      }

      if (
        current.end.row === position.row &&
        current.end.col === position.col
      ) {
        return current;
      }

      return {
        ...current,
        end: position,
      };
    });
  }

  /*
   * -------------------------------------------------------
   * POINTER UP
   * -------------------------------------------------------
   */

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!draw || !selectedClue || completed || gameOver) {
      return;
    }

    if (event.pointerId !== draw.pointerId) {
      return;
    }

    const finalPosition =
      getCellFromPointer(event.clientX, event.clientY) ?? draw.end;

    const rectangle = createRectangle(draw.start, finalPosition);

    const validation = validateRegion({
      puzzle,
      clue: selectedClue,
      rectangle,
      existingRegions: regions,
    });

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDraw(null);

    /*
     * -----------------------------------------------------
     * INVALID REGION
     * -----------------------------------------------------
     */

    if (!validation.valid) {
      const loseLife = shouldLoseLife(validation.reason);

      if (!loseLife) {
        setFeedback({
          type: "warning",
          text: getValidationMessage(validation.reason, {
            expectedSize: selectedClue.size,
          }),
        });

        return;
      }

      const nextLives = lives - 1;

      setLives(nextLives);

      setRegionMistakes((current) => ({
        ...current,
        [selectedClue.id]: (current[selectedClue.id] ?? 0) + 1,
      }));

      setSelectedClue(null);

      if (nextLives <= 0) {
        setGameOver(true);

        setFeedback(null);

        return;
      }

      setFeedback({
        type: "danger",
        text: `${getValidationMessage(validation.reason, {
          expectedSize: selectedClue.size,
        })} You lost a life.`,
      });

      return;
    }

    /*
     * -----------------------------------------------------
     * VALID REGION
     * -----------------------------------------------------
     */

    saveHistory();

    const replacingExisting = regions.some(
      (region) => region.clueId === selectedClue.id,
    );

    const nextRegions: PlacedRegion[] = [
      ...regions.filter((region) => region.clueId !== selectedClue.id),
      {
        clueId: selectedClue.id,
        rectangle,
      },
    ];

    /*
     * Don't award points repeatedly
     * for redrawing the same clue.
     */
    if (!replacingExisting) {
      const mistakesForRegion = regionMistakes[selectedClue.id] ?? 0;

      const perfectBonus = mistakesForRegion === 0 ? PERFECT_REGION_BONUS : 0;

      const earned = BASE_REGION_SCORE + perfectBonus;

      setScore((current) => current + earned);

      setLastScoredClue(selectedClue.id);

      window.setTimeout(() => {
        setLastScoredClue(null);
      }, 600);

      setFeedback({
        type: "success",
        text:
          perfectBonus > 0
            ? `Perfect region! +${earned} points`
            : `Region complete! +${earned} points`,
      });
    } else {
      setFeedback({
        type: "success",
        text: "Region updated.",
      });
    }

    setRegions(nextRegions);

    setSelectedClue(null);

    /*
     * -----------------------------------------------------
     * PUZZLE COMPLETION
     * -----------------------------------------------------
     */

    if (isPuzzleComplete(puzzle, nextRegions)) {
      let bonus = 0;

      if (lives === MAX_LIVES) {
        bonus += PERFECT_GAME_BONUS;
      }

      if (hintsUsed === 0) {
        bonus += NO_HINT_BONUS;
      }

      if (bonus > 0) {
        setScore((current) => current + bonus);
      }

      setCompleted(true);
    }
  }

  /*
   * -------------------------------------------------------
   * POINTER CANCEL
   * -------------------------------------------------------
   */

  function handlePointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDraw(null);
  }

  /*
   * -------------------------------------------------------
   * UNDO
   * -------------------------------------------------------
   */

  function handleUndo() {
    if (history.length === 0 || completed || gameOver) {
      return;
    }

    const previous = history[history.length - 1];

    setRegions(cloneRegions(previous));

    setHistory((current) => current.slice(0, -1));

    setSelectedClue(null);

    setDraw(null);

    setFeedback({
      type: "info",
      text: "Last move undone.",
    });
  }

  /*
   * -------------------------------------------------------
   * CLEAR
   * -------------------------------------------------------
   */

  function handleClear() {
    if (!selectedClue || completed || gameOver) {
      return;
    }

    const exists = regions.some((region) => region.clueId === selectedClue.id);

    if (!exists) {
      setFeedback({
        type: "warning",
        text: "That region has not been completed yet.",
      });

      return;
    }

    saveHistory();

    setRegions((current) =>
      current.filter((region) => region.clueId !== selectedClue.id),
    );

    setFeedback({
      type: "info",
      text: `Region ${selectedClue.size} cleared.`,
    });

    setSelectedClue(null);
  }

  /*
   * -------------------------------------------------------
   * HINT
   * -------------------------------------------------------
   */

  function handleHint() {
    if (completed || gameOver || !solution) {
      return;
    }

    const unfinishedRegion = solution.find((solutionRegion) => {
      const currentRegion = regions.find(
        (region) => region.clueId === solutionRegion.clueId,
      );

      if (!currentRegion) {
        return true;
      }

      return !rectanglesEqual(
        currentRegion.rectangle,
        solutionRegion.rectangle,
      );
    });

    if (!unfinishedRegion) {
      return;
    }

    saveHistory();

    const nextRegions: PlacedRegion[] = [
      ...regions.filter((region) => region.clueId !== unfinishedRegion.clueId),
      {
        clueId: unfinishedRegion.clueId,
        rectangle: {
          ...unfinishedRegion.rectangle,
        },
      },
    ];

    const clue = getClueById(unfinishedRegion.clueId);

    setRegions(nextRegions);

    setSelectedClue(null);

    setDraw(null);

    setHintsUsed((current) => current + 1);

    setScore((current) => Math.max(0, current - HINT_PENALTY));

    setFeedback({
      type: "info",
      text: clue
        ? `Hint revealed region ${clue.size}. -${HINT_PENALTY} points`
        : `Hint used. -${HINT_PENALTY} points`,
    });

    if (isPuzzleComplete(puzzle, nextRegions)) {
      setCompleted(true);
    }
  }

  /*
   * -------------------------------------------------------
   * RESET
   * -------------------------------------------------------
   */

  function handleReset() {
    setRegions([]);
    setHistory([]);

    setSelectedClue(null);

    setDraw(null);

    setFeedback(null);

    setCompleted(false);

    setGameOver(false);

    setElapsedSeconds(0);

    setLives(MAX_LIVES);

    setHintsUsed(0);

    setScore(0);

    setRegionMistakes({});

    setLastScoredClue(null);
  }

  const completedCount = regions.length;

  const progressPercent = Math.round(
    (completedCount / puzzle.clues.length) * 100,
  );

  /*
   * -------------------------------------------------------
   * RENDER
   * -------------------------------------------------------
   */

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* GAME HUD */}

      <div className="mb-4 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
        <div className="grid grid-cols-3 items-center gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
              Lives
            </p>

            <div className="mt-2 flex gap-1 text-lg">
              {Array.from({
                length: MAX_LIVES,
              }).map((_, index) => (
                <span
                  key={index}
                  className={index < lives ? "" : "grayscale opacity-25"}
                >
                  ❤️
                </span>
              ))}
            </div>
          </div>

          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
              Time
            </p>

            <p className="mt-1 text-xl font-black text-white">
              {formatTime(elapsedSeconds)}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
              Score
            </p>

            <p className="mt-1 text-xl font-black text-amber-300">
              ⭐ {score.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="font-bold text-neutral-400">Regions</span>

          <span className="font-black text-white">
            {completedCount}
            {" / "}
            {puzzle.clues.length}
          </span>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-300"
            style={{
              width: `${progressPercent}%`,
            }}
          />
        </div>
      </div>

      {/* INSTRUCTIONS */}

      {!completed && !gameOver && (
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">
              Every Cell Matters.
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              Select a number, then draw its region.
            </p>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-neutral-800"
          >
            Reset
          </button>
        </div>
      )}

      {/* SELECTED CLUE */}

      {selectedClue && !completed && !gameOver && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
              Selected Region
            </p>

            <p className="mt-1 text-sm text-white">
              Draw exactly <strong>{selectedClue.size}</strong> cells.
            </p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg font-black text-black shadow-lg">
            {selectedClue.size}
          </div>
        </div>
      )}

      {/* BOARD */}

      <div
        ref={boardRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={[
          "grid touch-none overflow-hidden rounded-2xl border bg-neutral-900 transition-all",
          gameOver
            ? "cursor-not-allowed border-red-800 opacity-50"
            : completed
              ? "border-emerald-500"
              : "border-neutral-700",
        ].join(" ")}
        style={{
          gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({
          length: puzzle.rows * puzzle.cols,
        }).map((_, index) => {
          const row = Math.floor(index / puzzle.cols);

          const col = index % puzzle.cols;

          const clue = getClueAt(row, col);

          const region = getRegionForCell(row, col);

          const preview = isPreviewCell(row, col);

          const isSelected = clue?.id === selectedClue?.id;

          const justScored = clue?.id === lastScoredClue;

          const regionColor = region
            ? (REGION_COLORS[region.clueId] ?? "bg-neutral-700")
            : "";

          let previewColor = "";

          if (preview) {
            previewColor = previewValidation?.valid
              ? "bg-emerald-400/35"
              : "bg-white/15";
          }

          return (
            <div
              key={`${row}-${col}`}
              className={[
                "relative aspect-square",
                "select-none",
                "border-b border-r border-neutral-700",
                "transition-all duration-200",
                regionColor,
                previewColor,
                !region && !preview ? "bg-neutral-900" : "",
                justScored ? "brightness-125" : "",
              ].join(" ")}
            >
              {clue && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <div
                    className={[
                      "flex h-12 w-12 items-center justify-center rounded-xl",
                      "text-xl font-black shadow-lg transition-all duration-200",
                      CLUE_COLORS[clue.id] ?? "bg-white text-black",
                      isSelected
                        ? "scale-110 ring-4 ring-white ring-offset-2 ring-offset-neutral-900"
                        : "",
                      justScored ? "scale-110" : "",
                    ].join(" ")}
                  >
                    {clue.size}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DRAW PREVIEW */}

      {selectedClue && draw && previewDimensions && !completed && !gameOver && (
        <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-white">
                Region {selectedClue.size}
              </p>

              <p className="mt-1 text-sm text-neutral-400">
                {previewDimensions.width}×{previewDimensions.height}
                {" = "}
                {previewDimensions.area} cells
              </p>
            </div>

            <div
              className={[
                "rounded-full px-3 py-1 text-sm font-black",
                previewValidation?.valid
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-white/10 text-white",
              ].join(" ")}
            >
              {previewDimensions.area}/{selectedClue.size}
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-800">
            <div
              className={[
                "h-full rounded-full transition-all duration-150",
                previewValidation?.valid
                  ? "bg-emerald-400"
                  : previewDimensions.area > selectedClue.size
                    ? "bg-red-400"
                    : "bg-blue-400",
              ].join(" ")}
              style={{
                width: `${Math.min(
                  100,
                  (previewDimensions.area / selectedClue.size) * 100,
                )}%`,
              }}
            />
          </div>

          <p
            className={[
              "mt-3 text-sm font-semibold",
              previewValidation?.valid
                ? "text-emerald-300"
                : "text-neutral-400",
            ].join(" ")}
          >
            {previewValidation?.valid
              ? "Perfect fit — release to lock it in! ✓"
              : previewDimensions.area < selectedClue.size
                ? `${
                    selectedClue.size - previewDimensions.area
                  } more cells needed.`
                : previewDimensions.area > selectedClue.size
                  ? `${
                      previewDimensions.area - selectedClue.size
                    } too many cells.`
                  : "Correct size — check the placement."}
          </p>
        </div>
      )}

      {/* FEEDBACK */}

      {feedback && !completed && !gameOver && (
        <FeedbackCard feedback={feedback} />
      )}

      {/* TOOLBAR */}

      {!completed && !gameOver && (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <ToolButton
            icon="↶"
            label="Undo"
            disabled={history.length === 0}
            onClick={handleUndo}
          />

          <ToolButton
            icon="✕"
            label="Clear"
            disabled={!selectedClue}
            onClick={handleClear}
          />

          <ToolButton
            icon="💡"
            label="Hint"
            sublabel={`-${HINT_PENALTY}`}
            disabled={!solution}
            onClick={handleHint}
          />
        </div>
      )}

      {/* GAME OVER */}

      {gameOver && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-red-500/30 bg-red-950/30">
          <div className="p-7 text-center">
            <div className="text-5xl">💥</div>

            <p className="mt-4 text-xs font-black uppercase tracking-[0.25em] text-red-400">
              KleinLogic
            </p>

            <h2 className="mt-2 text-3xl font-black text-white">Game Over</h2>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-neutral-400">
              No lives remaining. Study the board and give it another shot.
            </p>

            <div className="mt-7 grid grid-cols-3 gap-3">
              <ResultStat label="Time" value={formatTime(elapsedSeconds)} />

              <ResultStat
                label="Regions"
                value={`${completedCount}/${puzzle.clues.length}`}
              />

              <ResultStat label="Score" value={score.toLocaleString()} />
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="mt-6 w-full rounded-xl bg-red-500 px-5 py-3 font-black text-white transition hover:bg-red-400"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* VICTORY */}

      {completed && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-950/30">
          <div className="p-7 text-center">
            <div className="text-5xl">🏆</div>

            <p className="mt-4 text-xs font-black uppercase tracking-[0.25em] text-emerald-400">
              KleinLogic
            </p>

            <h2 className="mt-2 text-3xl font-black text-white">
              Puzzle Complete!
            </h2>

            <p className="mt-2 text-sm text-neutral-400">
              Every cell found its place.
            </p>

            {lives === MAX_LIVES && hintsUsed === 0 && (
              <div className="mx-auto mt-5 inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-300">
                ✨ PERFECT RUN
              </div>
            )}

            <div className="mt-7 grid grid-cols-3 gap-3">
              <ResultStat label="Time" value={formatTime(elapsedSeconds)} />

              <ResultStat label="Lives" value={`${lives}/${MAX_LIVES}`} />

              <ResultStat label="Score" value={score.toLocaleString()} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <ResultStat label="Hints" value={hintsUsed.toString()} />

              <ResultStat
                label="Regions"
                value={`${completedCount}/${puzzle.clues.length}`}
              />
            </div>

            {lives === MAX_LIVES && (
              <p className="mt-5 text-sm font-bold text-amber-300">
                +{PERFECT_GAME_BONUS} Perfect Run Bonus
              </p>
            )}

            {hintsUsed === 0 && (
              <p className="mt-2 text-sm font-bold text-emerald-300">
                +{NO_HINT_BONUS} No-Hint Bonus
              </p>
            )}

            <button
              type="button"
              onClick={handleReset}
              className="mt-6 w-full rounded-xl bg-emerald-400 px-5 py-3 font-black text-black transition hover:bg-emerald-300"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback: NonNullable<Feedback> }) {
  const style =
    feedback.type === "success"
      ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-200"
      : feedback.type === "danger"
        ? "border-red-500/30 bg-red-950/30 text-red-200"
        : feedback.type === "warning"
          ? "border-amber-500/30 bg-amber-950/30 text-amber-200"
          : "border-blue-500/30 bg-blue-950/30 text-blue-200";

  const icon =
    feedback.type === "success"
      ? "✓"
      : feedback.type === "danger"
        ? "♥"
        : feedback.type === "warning"
          ? "!"
          : "i";

  return (
    <div
      role="status"
      className={`mt-4 flex items-center gap-3 rounded-xl border p-4 ${style}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 font-black">
        {icon}
      </div>

      <p className="text-sm font-semibold">{feedback.text}</p>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/20 px-3 py-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        {label}
      </p>

      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function ToolButton({
  icon,
  label,
  sublabel,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 font-bold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
    >
      <span className="block text-xl">{icon}</span>

      <span className="mt-1 block text-xs">{label}</span>

      {sublabel && (
        <span className="mt-1 block text-[10px] text-neutral-500">
          {sublabel} pts
        </span>
      )}
    </button>
  );
}
