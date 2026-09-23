"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useFeedback } from "@/components/feedback/FeedbackProvider";
import GameBoard, { type GameBoardCompletion } from "@/components/game/GameBoard";
import RegionsLeaderboard from "@/components/game/RegionsLeaderboard";
import RegionsRankedExperience from "@/components/game/RegionsRankedExperience";
import PlayerProfileGate from "@/components/player/PlayerProfileGate";
import { recordRegionsResultAction } from "@/app/play/actions";
import { LogicPanel, LogicStatus } from "@/components/logic/LogicPrimitives";
import { getRegionsPuzzle, regionsPuzzles } from "@/game/puzzles";
import type { RegionDifficulty } from "@/game/types/puzzle";
import type { RegionsCompetitiveMode } from "@/game/competitive/types";

export type RegionsMode = "classic" | "journey" | "time-attack";
type SessionStatus = "idle" | "running" | "complete";

const TIME_ATTACK_SECONDS = 180;
const MODES: Array<{ id: RegionsMode; name: string; description: string; detail: string }> = [
  { id: "classic", name: "Classic", description: "Solve individual Regions puzzles at your own pace.", detail: "Count-up timer" },
  { id: "journey", name: "Journey", description: "Progress through increasingly difficult Regions.", detail: "001 → 020" },
  { id: "time-attack", name: "Time Attack", description: "Solve as many Regions as possible before time expires.", detail: "03:00 shared clock" },
];

function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(safeSeconds / 60)}:${(safeSeconds % 60).toString().padStart(2, "0")}`;
}

function difficultyLabel(difficulty: RegionDifficulty | undefined): string {
  return difficulty ?? "logic";
}

export default function RegionsExperience() {
  return <PlayerProfileGate><RegionsModeController /></PlayerProfileGate>;
}

function RegionsModeController() {
  const feedbackApi = useFeedback();
  const [mode, setMode] = useState<RegionsMode | null>(null);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [boardsSolved, setBoardsSolved] = useState(0);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(TIME_ATTACK_SECONDS);
  const [runId, setRunId] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [rankedMode, setRankedMode] = useState<RegionsCompetitiveMode | null>(null);
  const [showLeaderboards, setShowLeaderboards] = useState(false);
  const startedAt = useRef<number | null>(null);
  const deadline = useRef<number | null>(null);
  const warningPlayed = useRef(false);

  const recordResult = useCallback((input: Omit<Parameters<typeof recordRegionsResultAction>[0], "resultKey">) => {
    void recordRegionsResultAction({ ...input, resultKey: crypto.randomUUID() });
  }, []);

  const puzzle = getRegionsPuzzle(puzzleIndex);
  const isFinalPuzzle = puzzleIndex === regionsPuzzles.length - 1;

  useEffect(() => {
    if (status !== "running" || !mode || mode === "classic") return;
    const now = Date.now();
    startedAt.current = now;
    deadline.current = mode === "time-attack" ? now + TIME_ATTACK_SECONDS * 1000 : null;
  }, [mode, runId, status]);

  useEffect(() => {
    if (status !== "running" || !mode || mode === "classic") return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const started = startedAt.current ?? now;
      setSessionElapsed(Math.floor((now - started) / 1000));
      if (mode !== "time-attack" || deadline.current === null) return;
      const nextRemaining = Math.max(0, (deadline.current - now) / 1000);
      setRemainingSeconds(nextRemaining);
      if (nextRemaining <= 10 && !warningPlayed.current) {
        warningPlayed.current = true;
        feedbackApi.warning();
      }
      if (nextRemaining <= 0) {
        setStatus("complete");
        feedbackApi.failure();
        recordResult({ mode: "time-attack", boardsSolved, finalPuzzleId: puzzle.id, configuredDurationSeconds: TIME_ATTACK_SECONDS, remainingSeconds: 0, catalogCleared: false });
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [feedbackApi, mode, puzzle.id, recordResult, status, boardsSolved]);

  function startMode(nextMode: RegionsMode) {
    setMode(nextMode);
    setStatus("running");
    setPuzzleIndex(0);
    setBoardsSolved(0);
    setSessionElapsed(0);
    setRemainingSeconds(TIME_ATTACK_SECONDS);
    setTransitioning(false);
    setRunId((current) => current + 1);
    startedAt.current = null;
    deadline.current = null;
    warningPlayed.current = false;
  }

  function exitToModes() {
    setMode(null);
    setStatus("idle");
    setTransitioning(false);
    deadline.current = null;
    setRankedMode(null);
    setShowLeaderboards(false);
  }

  function handleComplete(result: GameBoardCompletion) {
    if (mode === "classic") {
      recordResult({ mode: "classic", puzzleId: result.puzzleId, completionMs: result.elapsedSeconds * 1000, score: result.score, hintsUsed: result.hintsUsed });
      return;
    }
    if (!mode || status !== "running" || transitioning) return;
    const solved = boardsSolved + 1;
    setBoardsSolved(solved);
    if (isFinalPuzzle) {
      setStatus("complete");
      feedbackApi.qualify();
      recordResult({ mode, finalPuzzleId: result.puzzleId, boardsSolved: solved, totalElapsedMs: sessionElapsed * 1000, configuredDurationSeconds: mode === "time-attack" ? TIME_ATTACK_SECONDS : undefined, remainingSeconds: mode === "time-attack" ? Math.ceil(remainingSeconds) : undefined, catalogCleared: true });
      return;
    }
    setTransitioning(true);
    window.setTimeout(() => {
      setPuzzleIndex((current) => current + 1);
      setTransitioning(false);
      feedbackApi.roundChange();
    }, mode === "journey" ? 450 : 300);
  }

  if (showLeaderboards) return <RegionsLeaderboard onBack={exitToModes} />;
  if (rankedMode) return <RegionsRankedExperience mode={rankedMode} onExit={exitToModes} />;

  if (!mode) {
    return (
      <div>
        <header className="mb-8 text-center">
          <p className="logic-kicker">Spatial challenge</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight">Regions</h2>
          <p className="mt-3 text-text-secondary">Every cell matters.</p>
        </header>
        <div className="mb-5 flex justify-center"><button type="button" onClick={() => setShowLeaderboards(true)} className="min-h-11 border border-logic-primary/60 px-5 font-mono text-xs font-black uppercase tracking-[0.16em] text-logic-primary hover:bg-logic-primary/10">View Leaderboards</button></div>
        <div className="grid gap-4 lg:grid-cols-3">
          {MODES.map((candidate) => (
            <LogicPanel key={candidate.id} className="flex h-full flex-col p-6 transition-[border-color,background-color,transform] hover:-translate-y-1 hover:border-border-strong hover:bg-surface-panel-hover">
                <div className="flex items-start justify-between gap-3"><span className="font-mono text-xs font-black uppercase tracking-[0.2em] text-logic-primary">{candidate.name}</span><LogicStatus status="ready" label="Start" /></div>
                <p className="mt-12 text-lg font-black">{candidate.description}</p>
                <p className="mt-4 font-mono text-[0.625rem] font-bold uppercase tracking-[0.16em] text-text-muted">{candidate.detail}</p>
                <div className="mt-6 grid grid-cols-2 gap-2"><button type="button" onClick={() => startMode(candidate.id)} className="min-h-11 bg-logic-primary px-3 font-mono text-[0.625rem] font-black uppercase tracking-[0.12em] text-black">Local play</button><button type="button" onClick={() => setRankedMode(candidate.id)} className="min-h-11 border border-border-default px-3 font-mono text-[0.625rem] font-black uppercase tracking-[0.12em] text-text-primary">Ranked run</button></div>
            </LogicPanel>
          ))}
        </div>
      </div>
    );
  }

  if (status === "complete") {
    return (
      <section className="mx-auto max-w-2xl text-center">
        <p className="logic-kicker">{mode === "time-attack" ? "Time Attack Complete" : "Journey Complete"}</p>
        <h2 className="mt-4 text-4xl font-black">{mode === "time-attack" ? "Time is up." : "The catalog is solved."}</h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3"><SessionStat label="Boards solved" value={boardsSolved.toString()} /><SessionStat label="Final puzzle" value={`${puzzleIndex + 1} / ${regionsPuzzles.length}`} /><SessionStat label={mode === "time-attack" ? "Remaining" : "Session"} value={mode === "time-attack" ? "00:00" : formatClock(sessionElapsed)} /></div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => startMode(mode)} className="min-h-12 bg-logic-primary px-5 font-mono text-xs font-black uppercase tracking-[0.16em] text-black">Restart {mode === "time-attack" ? "Session" : "Journey"}</button><button type="button" onClick={exitToModes} className="min-h-12 border border-border-default px-5 font-mono text-xs font-black uppercase tracking-[0.16em] text-text-primary">Back to Modes</button></div>
      </section>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="logic-kicker">{mode === "classic" ? "Classic" : mode === "journey" ? "Journey" : "Time Attack"} · Puzzle {puzzleIndex + 1} / {regionsPuzzles.length}</p><h2 className="mt-2 text-2xl font-black">{puzzle.title}</h2></div>
        <div className="text-right"><p className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.16em] text-text-muted">{difficultyLabel(puzzle.difficulty)}</p><p className="mt-1 font-mono text-sm font-black text-text-primary">{mode === "time-attack" ? `${formatClock(remainingSeconds)} remain` : mode === "journey" ? `Total ${formatClock(sessionElapsed)}` : "Count-up"}</p></div>
      </div>
      {transitioning && <p className="mb-3 text-center font-mono text-[0.625rem] font-bold uppercase tracking-[0.18em] text-logic-primary">Next Region →</p>}
      <GameBoard key={`${mode}-${runId}-${puzzle.id}`} puzzle={puzzle} onComplete={handleComplete} suppressBoardTimer={mode === "time-attack"} timerDisplay={mode === "time-attack" ? formatClock(remainingSeconds) : undefined} timerCaption={mode === "time-attack" ? "Session" : "Time"} catalogComplete={mode === "classic" && isFinalPuzzle} onNextPuzzle={mode === "classic" && !isFinalPuzzle ? () => setPuzzleIndex((current) => current + 1) : undefined} />
      <button type="button" onClick={exitToModes} className="mx-auto mt-6 block font-mono text-[0.625rem] font-bold uppercase tracking-[0.16em] text-text-muted hover:text-text-primary">← Back to Modes</button>
    </div>
  );
}

function SessionStat({ label, value }: { label: string; value: string }) {
  return <div className="bg-surface-elevated px-3 py-5"><p className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.16em] text-text-muted">{label}</p><p className="mt-2 font-mono text-2xl font-black text-text-primary">{value}</p></div>;
}
