"use client";

import { useEffect } from "react";

import { LogicPulse } from "@/components/feedback/FeedbackPrimitives";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import type { TournamentState } from "@/arena/types";

export default function ArenaResults({
  tournament,
  onReplay,
  onDifferentSeed,
}: {
  tournament: TournamentState;
  onReplay: () => void;
  onDifferentSeed: () => void;
}) {
  const feedbackApi = useFeedback();
  const champion = tournament.players.find(
    (player) => player.status === "champion",
  );
  useEffect(() => {
    if (!champion) {
      return;
    }
    feedbackApi.qualify();
  }, [champion, feedbackApi]);

  if (!champion) {
    return null;
  }

  const championResponses = tournament.responses.filter(
    (response) => response.playerId === champion.id,
  );
  const correctResponses = championResponses.filter(
    (response) => response.correct,
  );
  const accuracy = Math.round(
    (correctResponses.length / championResponses.length) * 100,
  );
  const finalResponse = championResponses.at(-1);
  const timedResponses = championResponses.filter(
    (response) => response.responseMs !== null,
  );
  const averageResponseMs =
    timedResponses.length === 0
      ? null
      : Math.round(
          timedResponses.reduce(
            (total, response) => total + (response.responseMs ?? 0),
            0,
          ) / timedResponses.length,
        );

  return (
    <section className="mx-auto w-full max-w-4xl text-center">
      <p className="font-mono text-xs uppercase tracking-[0.34em] text-cyan-300">
        PIN³ Championship Final
      </p>
      <LogicPulse className="mt-9 text-7xl">🏆</LogicPulse>
      <p className="mt-7 font-mono text-xs font-black uppercase tracking-[0.3em] text-amber-300">
        Champion
      </p>
      <h2 className="mt-3 text-5xl font-black tracking-tight text-white sm:text-7xl">
        {champion.displayName}
      </h2>

      <div className="mx-auto mt-9 grid max-w-3xl grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
        <FinalMetric
          label="Final response"
          value={
            finalResponse?.responseMs === null || finalResponse?.responseMs === undefined
              ? "—"
              : `${(finalResponse.responseMs / 1_000).toFixed(2)}s`
          }
        />
        <FinalMetric label="Accuracy" value={`${accuracy}%`} />
        <FinalMetric
          label="Average response"
          value={
            averageResponseMs === null
              ? "—"
              : `${(averageResponseMs / 1_000).toFixed(2)}s`
          }
        />
        <FinalMetric label="Rounds survived" value={championResponses.length.toString()} />
      </div>

      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-600">
        Auditable seed · {tournament.seed}
      </p>

      <details className="mx-auto mt-7 max-w-2xl border border-white/10 bg-white/[0.025] text-left">
        <summary className="cursor-pointer px-5 py-4 font-mono text-xs font-black uppercase tracking-[0.2em] text-neutral-300">
          View audited results
        </summary>
        <div className="border-t border-white/10">
          {tournament.roundHistory.map((result) => {
            const round = tournament.preset.rounds[result.roundNumber - 1];
            return (
              <div
                key={result.roundNumber}
                className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/5 px-5 py-4 font-mono text-xs last:border-0"
              >
                <div>
                  <p className="font-bold text-white">{round.label}</p>
                  <p className="mt-1 text-neutral-600">{result.challengeId}</p>
                </div>
                <p className="text-right text-neutral-400">
                  {result.startingPlayers} → {result.advancingPlayers}
                  <span className="mt-1 block text-emerald-300">
                    {result.correctPlayers} correct
                  </span>
                </p>
              </div>
            );
          })}
        </div>
      </details>

      <div className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onReplay}
          className="border border-cyan-300 bg-cyan-300 px-6 py-4 font-mono text-xs font-black uppercase tracking-[0.2em] text-black transition hover:bg-white"
        >
          Replay Same Seed
        </button>
        <button
          type="button"
          onClick={onDifferentSeed}
          className="border border-white/20 px-6 py-4 font-mono text-xs font-black uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white hover:text-black"
        >
          Run Different Seed
        </button>
      </div>
    </section>
  );
}

function FinalMetric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="flex min-h-28 flex-col justify-center bg-[#080d13] px-3 py-5">
      <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-neutral-500">
        {label}
      </p>
      <p className={`mt-2 font-mono font-black text-white ${compact ? "break-all text-xs" : "text-2xl"}`}>
        {value}
      </p>
    </div>
  );
}
