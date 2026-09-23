"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  finalizeRegionsRankedAttemptAction,
  prepareRegionsRankedAttemptAction,
  startRegionsRankedAttemptAction,
  submitRegionsRankedCompletionAction,
} from "@/app/play/actions";
import GameBoard, { type GameBoardCompletion } from "@/components/game/GameBoard";
import { LogicPanel, LogicStatus } from "@/components/logic/LogicPrimitives";
import { usePlayerProfile } from "@/components/player/PlayerProfileGate";
import type { ActiveRegionsAttempt, PreparedRegionsAttempt, RegionsCompetitiveMode } from "@/game/competitive/types";
import { regionsPuzzles } from "@/game/puzzles";

function formatMilliseconds(milliseconds: number): string {
  const safe = Math.max(0, milliseconds);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const remainder = safe % 1_000;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${remainder.toString().padStart(3, "0")}`;
}

export default function RegionsRankedExperience({ mode, onExit }: { mode: RegionsCompetitiveMode; onExit: () => void }) {
  const { profile, profileAvailable } = usePlayerProfile();
  const [classicPuzzleId, setClassicPuzzleId] = useState(regionsPuzzles[0].id);
  const [prepared, setPrepared] = useState<PreparedRegionsAttempt | null>(null);
  const [attempt, setAttempt] = useState<ActiveRegionsAttempt | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const finalizing = useRef(false);

  const finishExpired = useCallback(async (activeAttempt: ActiveRegionsAttempt) => {
    if (finalizing.current) return;
    finalizing.current = true;
    const result = await finalizeRegionsRankedAttemptAction(activeAttempt.attemptId);
    if (result.ok) setAttempt(result.data);
    else setError(result.message);
    finalizing.current = false;
  }, []);

  useEffect(() => {
    if (!attempt?.deadlineAt || attempt.status !== "active") return;
    const deadline = new Date(attempt.deadlineAt).getTime();
    const update = () => {
      const next = Math.max(0, deadline - Date.now());
      setRemainingMs(next);
      if (next === 0 && mode === "time-attack") void finishExpired(attempt);
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [attempt, finishExpired, mode]);

  async function prepare() {
    setPending(true);
    setError(null);
    const result = await prepareRegionsRankedAttemptAction({ mode, puzzleId: mode === "classic" ? classicPuzzleId : undefined });
    if (result.ok) setPrepared(result.data);
    else setError(result.message);
    setPending(false);
  }

  async function start() {
    if (!prepared) return;
    setPending(true);
    setError(null);
    const result = await startRegionsRankedAttemptAction(prepared.attemptId);
    if (result.ok) setAttempt(result.data);
    else setError(result.message);
    setPending(false);
  }

  async function submit(result: GameBoardCompletion) {
    if (!attempt || pending) return;
    setPending(true);
    setError(null);
    const response = await submitRegionsRankedCompletionAction({
      attemptId: attempt.attemptId,
      submissionKey: crypto.randomUUID(),
      puzzleId: result.puzzleId,
      proof: result.proof,
      elapsedMs: result.elapsedSeconds * 1000,
      boardsSolved: attempt.acceptedBoards + 1,
      remainingSeconds: remainingMs === null ? undefined : Math.ceil(remainingMs / 1000),
    });
    if (response.ok) setAttempt(response.data);
    else setError(response.message);
    setPending(false);
  }

  if (!profileAvailable || !profile) {
    return <LogicPanel className="mx-auto max-w-lg p-7 text-center"><p className="logic-kicker">Ranked play</p><h2 className="mt-3 text-2xl font-black">A player name is required</h2><p className="mt-3 text-sm leading-6 text-text-secondary">Return to the profile step and choose a name. Local play remains available without one.</p><button type="button" onClick={onExit} className="mt-6 min-h-11 border border-border-default px-5 font-mono text-xs font-black uppercase tracking-[0.14em]">Back to local play</button></LogicPanel>;
  }

  if (attempt && attempt.status !== "active") {
    return (
      <section className="mx-auto max-w-xl text-center">
        <p className="logic-kicker">Ranked {mode === "time-attack" ? "Time Attack" : mode}</p>
        <h2 className="mt-3 text-3xl font-black">{attempt.status === "completed" ? "Verified run complete" : "Ranked run closed"}</h2>
        <div className="mt-7 grid grid-cols-2 gap-3"><LogicPanel className="p-5"><p className="logic-kicker">Accepted</p><p className="mt-2 text-3xl font-black">{attempt.acceptedBoards}</p></LogicPanel><LogicPanel className="p-5"><p className="logic-kicker">Trusted time</p><p className="mt-2 font-mono text-xl font-black">{attempt.trustedElapsedMs === null ? "—" : formatMilliseconds(attempt.trustedElapsedMs)}</p></LogicPanel></div>
        <p className="mt-4 text-xs text-text-muted">Measured by server receipt time. Network latency is included.</p>
        <button type="button" onClick={onExit} className="mt-7 min-h-12 bg-logic-primary px-6 font-mono text-xs font-black uppercase tracking-[0.16em] text-black">View modes</button>
      </section>
    );
  }

  if (attempt?.status === "active") {
    const puzzle = regionsPuzzles.find((candidate) => candidate.id === attempt.nextPuzzleId);
    if (!puzzle) return <p role="alert" className="text-state-danger">The next ranked puzzle is unavailable.</p>;
    return (
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="logic-kicker">Ranked {mode === "time-attack" ? "Time Attack" : mode} · Playing as {attempt.nickname}</p><h2 className="mt-2 text-2xl font-black">Puzzle {puzzle.id} · {puzzle.title}</h2></div><div className="text-right"><LogicStatus status="active" label="Leaderboard eligible" />{remainingMs !== null && <p className="mt-2 font-mono text-sm font-black">{formatMilliseconds(remainingMs)}</p>}</div></div>
        {error && <p role="alert" className="mb-4 border border-state-danger/40 p-3 text-sm text-state-danger">{error}</p>}
        {pending && <p className="mb-3 text-center font-mono text-xs uppercase tracking-[0.16em] text-logic-primary">Server verifying geometry…</p>}
        <GameBoard key={`${attempt.attemptId}-${attempt.acceptedBoards}-${puzzle.id}`} puzzle={puzzle} onComplete={(result) => void submit(result)} suppressBoardTimer={mode === "time-attack"} timerDisplay={mode === "time-attack" && remainingMs !== null ? formatMilliseconds(remainingMs) : undefined} timerCaption={mode === "time-attack" ? "Server deadline" : "Display time"} />
      </section>
    );
  }

  if (prepared) {
    return (
      <LogicPanel className="mx-auto max-w-xl p-7 text-center"><p className="logic-kicker">Ranked run prepared</p><h2 className="mt-3 text-3xl font-black">Ready, {prepared.nickname}?</h2><p className="mt-4 text-sm leading-6 text-text-secondary">The trusted clock starts only when you press the button below. Start the board immediately after the server responds.</p><div className="mt-6 border border-border-subtle bg-surface-elevated p-4 font-mono text-xs uppercase tracking-[0.14em] text-text-secondary">{mode === "classic" ? `Classic · Puzzle ${prepared.puzzleId}` : mode === "journey" ? "Journey · Ordered catalog" : "Time Attack · 03:00"}</div>{error && <p role="alert" className="mt-4 text-sm text-state-danger">{error}</p>}<button type="button" onClick={() => void start()} disabled={pending} className="mt-6 min-h-12 w-full bg-logic-primary px-5 font-mono text-xs font-black uppercase tracking-[0.16em] text-black disabled:opacity-50">{pending ? "Starting…" : "Start ranked run"}</button><button type="button" onClick={onExit} className="mt-3 px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Cancel</button></LogicPanel>
    );
  }

  return (
    <section className="mx-auto max-w-xl"><button type="button" onClick={onExit} className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-text-muted">← Back to modes</button><LogicPanel className="mt-5 p-7"><div className="flex items-start justify-between gap-3"><div><p className="logic-kicker">Ranked {mode === "time-attack" ? "Time Attack" : mode}</p><h2 className="mt-3 text-2xl font-black">Playing as {profile.nickname}</h2></div><LogicStatus status="ready" label="Verified" /></div>{mode === "classic" && <label className="mt-6 block text-sm font-semibold text-text-secondary">Puzzle<select value={classicPuzzleId} onChange={(event) => setClassicPuzzleId(event.target.value)} className="logic-input mt-2 w-full px-3">{regionsPuzzles.map((puzzle) => <option key={puzzle.id} value={puzzle.id}>{puzzle.id} — {puzzle.title}</option>)}</select></label>}<p className="mt-5 text-sm leading-6 text-text-secondary">Your geometry is validated on the server. The official time runs from the server start until it receives a valid completion, so network latency is included.</p>{error && <p role="alert" className="mt-4 text-sm text-state-danger">{error}</p>}<button type="button" onClick={() => void prepare()} disabled={pending} className="mt-6 min-h-12 w-full bg-logic-primary px-5 font-mono text-xs font-black uppercase tracking-[0.16em] text-black disabled:opacity-50">{pending ? "Preparing…" : "Prepare ranked run"}</button></LogicPanel></section>
  );
}
