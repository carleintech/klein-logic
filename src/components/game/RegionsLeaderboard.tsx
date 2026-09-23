"use client";

import { useEffect, useState } from "react";

import type {
  ClassicLeaderboardEntry,
  JourneyLeaderboardEntry,
  RegionsCompetitiveMode,
  TimeAttackLeaderboardEntry,
} from "@/game/competitive/types";
import { regionsPuzzles } from "@/game/puzzles";
import { LogicPanel, LogicStatus } from "@/components/logic/LogicPrimitives";

type Entry = ClassicLeaderboardEntry | JourneyLeaderboardEntry | TimeAttackLeaderboardEntry;

function formatMilliseconds(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1_000);
  const remainder = milliseconds % 1_000;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${remainder.toString().padStart(3, "0")}`;
}

function metric(entry: Entry): string {
  if ("completionMs" in entry) return formatMilliseconds(entry.completionMs);
  if ("puzzlesCompleted" in entry) return `${entry.puzzlesCompleted} solved · ${formatMilliseconds(entry.trustedElapsedMs)}`;
  return `${entry.boardsSolved} solved · ${formatMilliseconds(entry.timeToLastSolveMs)}`;
}

export default function RegionsLeaderboard({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<RegionsCompetitiveMode>("classic");
  const [puzzleId, setPuzzleId] = useState(regionsPuzzles[0].id);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ mode });
    if (mode === "classic") query.set("puzzleId", puzzleId);
    void fetch(`/api/regions/leaderboards?${query}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("leaderboard-unavailable");
        return response.json() as Promise<{ entries: Entry[] }>;
      })
      .then((payload) => {
        setEntries(payload.entries);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      });
    return () => controller.abort();
  }, [mode, puzzleId]);

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="logic-kicker">Verified competition</p><h2 className="mt-2 text-3xl font-black">Regions Leaderboards</h2></div>
        <button type="button" onClick={onBack} className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-text-muted hover:text-text-primary">← Back to modes</button>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2" role="tablist" aria-label="Regions leaderboard mode">
        {(["classic", "journey", "time-attack"] as const).map((candidate) => (
          <button key={candidate} type="button" role="tab" aria-selected={mode === candidate} onClick={() => { setState("loading"); setMode(candidate); }} className={`min-h-11 border px-2 font-mono text-[0.625rem] font-black uppercase tracking-[0.12em] ${mode === candidate ? "border-logic-primary bg-logic-primary/10 text-logic-primary" : "border-border-default text-text-muted"}`}>{candidate === "time-attack" ? "Time Attack" : candidate}</button>
        ))}
      </div>
      {mode === "classic" && (
        <label className="mt-5 block text-sm font-semibold text-text-secondary">Puzzle
          <select value={puzzleId} onChange={(event) => { setState("loading"); setPuzzleId(event.target.value); }} className="logic-input mt-2 w-full px-3">
            {regionsPuzzles.map((puzzle) => <option key={puzzle.id} value={puzzle.id}>{puzzle.id} — {puzzle.title}</option>)}
          </select>
        </label>
      )}
      <LogicPanel className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3"><p className="font-mono text-xs font-black uppercase tracking-[0.16em]">Top 50 · Best per player</p><LogicStatus status={state === "error" ? "error" : state === "loading" ? "connecting" : "active"} label={state} /></div>
        {state === "loading" && <p className="px-4 py-10 text-center text-sm text-text-muted">Loading verified records…</p>}
        {state === "error" && <p role="alert" className="px-4 py-10 text-center text-sm text-state-danger">Leaderboard data is temporarily unavailable.</p>}
        {state === "ready" && entries.length === 0 && <p className="px-4 py-10 text-center text-sm text-text-muted">No qualifying ranked runs yet.</p>}
        {state === "ready" && entries.map((entry) => (
          <div key={`${entry.rank}-${entry.nickname}`} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 border-b border-border-subtle px-4 py-4 last:border-b-0">
            <span className="font-mono text-lg font-black text-logic-primary">{entry.rank}</span>
            <span className="min-w-0 truncate font-bold text-text-primary">{entry.nickname}</span>
            <span className="text-right font-mono text-xs font-bold text-text-secondary">{metric(entry)}</span>
          </div>
        ))}
      </LogicPanel>
      <p className="mt-4 text-xs leading-5 text-text-muted">Times are measured from the trusted server start until the server receives a valid completion. Network latency is included.</p>
    </section>
  );
}
