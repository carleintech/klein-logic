import type { TournamentState } from "@/arena/types";

export default function ArenaRound({
  tournament,
  countdown,
  onContinue,
}: {
  tournament: TournamentState;
  countdown: number;
  onContinue: () => void;
}) {
  const round = tournament.preset.rounds[tournament.roundIndex];
  const activePlayers = tournament.players.filter(
    (player) => player.status === "active",
  );

  if (tournament.status === "countdown") {
    const isFinal = round.advancingPlayers === 1;

    return (
      <RoundShell tournament={tournament}>
        <div className="flex min-h-[430px] flex-col items-center justify-center text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-300">
            {isFinal ? "PIN³ Championship Final" : round.label}
          </p>
          <p className="mt-3 font-mono text-sm uppercase tracking-[0.2em] text-neutral-500">
            {activePlayers.length} players remain
          </p>
          {isFinal && (
            <div className="mt-7 flex items-center justify-center gap-5 text-xl font-black text-white sm:text-3xl">
              <span>{activePlayers[0]?.displayName}</span>
              <span className="font-mono text-sm text-cyan-300">VS</span>
              <span>{activePlayers[1]?.displayName}</span>
            </div>
          )}
          <p className={`font-mono font-black text-white drop-shadow-[0_0_30px_rgba(103,232,249,0.25)] ${isFinal ? "mt-7 text-7xl" : "mt-10 text-9xl"}`}>
            {countdown === 0 ? "BEGIN" : countdown}
          </p>
          <p className="mt-8 font-mono text-lg font-black uppercase tracking-[0.28em] text-cyan-300">
            {round.challengeType}
          </p>
        </div>
      </RoundShell>
    );
  }

  if (tournament.status === "round") {
    const challenge = tournament.currentChallenge;

    return (
      <RoundShell tournament={tournament}>
        <div className="flex min-h-[430px] flex-col items-center justify-center text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-orange-300">
            Live simulation
          </p>
          <p className="mt-8 font-mono text-sm uppercase tracking-[0.24em] text-neutral-500">
            SumRoll
          </p>
          <h2 className="mt-2 text-5xl font-black uppercase tracking-tight text-white">
            {round.challengeType}
          </h2>
          <div className="mt-8 border border-cyan-300/20 bg-cyan-300/[0.04] px-10 py-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-500">
              Challenge target
            </p>
            <p className="mt-2 font-mono text-6xl font-black text-cyan-200">
              {challenge?.target ?? "—"}
            </p>
          </div>
          <p className="mt-8 animate-pulse font-mono text-xs uppercase tracking-[0.26em] text-orange-300">
            Answers locking…
          </p>
        </div>
      </RoundShell>
    );
  }

  const result = tournament.roundHistory.at(-1);

  if (!result) {
    return null;
  }

  const playerById = new Map(
    tournament.players.map((player) => [player.id, player]),
  );

  return (
    <RoundShell tournament={tournament}>
      <div className="py-7 text-center">
        <p className="font-mono text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
          Answers locked
        </p>
        <h2 className="mt-3 text-4xl font-black text-white">Round Complete</h2>

        <div className="mx-auto mt-7 grid max-w-2xl grid-cols-3 gap-px bg-white/10">
          <ResultMetric label="Competed" value={result.startingPlayers} />
          <ResultMetric label="Correct" value={result.correctPlayers} positive />
          <ResultMetric label="Incorrect" value={result.incorrectPlayers} />
        </div>

        <div className="my-8 flex items-center justify-center gap-6 font-mono">
          <span className="text-5xl font-black text-neutral-500">
            {result.startingPlayers}
          </span>
          <span className="text-2xl text-cyan-300">→</span>
          <span className="text-7xl font-black text-white">
            {result.advancingPlayers}
          </span>
        </div>

        <p className="font-mono text-sm uppercase tracking-[0.2em] text-red-300">
          {result.eliminatedPlayerIds.length} eliminated
        </p>

        <div className="mx-auto mt-7 max-w-2xl border border-white/10 text-left">
          {result.rankings.slice(0, 5).map((response) => (
            <div
              key={response.playerId}
              className="grid grid-cols-[2.5rem_1fr_auto_auto] gap-3 border-b border-white/5 px-4 py-3 font-mono text-xs last:border-0"
            >
              <span className="text-neutral-600">#{response.rank}</span>
              <span className="text-white">
                {playerById.get(response.playerId)?.displayName}
              </span>
              <span className={response.correct ? "text-emerald-300" : "text-red-300"}>
                {response.correct ? "CORRECT" : "WRONG"}
              </span>
              <span className="w-14 text-right text-neutral-400">
                {formatResponseTime(response.responseMs)}
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-7 w-full max-w-2xl border border-cyan-300 bg-cyan-300 px-6 py-4 font-mono text-sm font-black uppercase tracking-[0.2em] text-black transition hover:bg-white"
        >
          {tournament.roundIndex === tournament.preset.rounds.length - 1
            ? "Reveal Champion"
            : "Continue Tournament"}
        </button>
      </div>
    </RoundShell>
  );
}

function RoundShell({
  tournament,
  children,
}: {
  tournament: TournamentState;
  children: React.ReactNode;
}) {
  const round = tournament.preset.rounds[tournament.roundIndex];

  return (
    <section className="mx-auto w-full max-w-4xl border border-white/10 bg-[#080d13] shadow-2xl shadow-cyan-950/20">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 font-mono text-[10px] uppercase tracking-[0.2em]">
        <span className="text-cyan-300">{round.label}</span>
        <span className="text-neutral-500">
          {tournament.roundIndex + 1} / {tournament.preset.rounds.length}
        </span>
      </div>
      <div className="px-5 sm:px-8">{children}</div>
    </section>
  );
}

function ResultMetric({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
}) {
  return (
    <div className="bg-[#0a1017] px-3 py-5">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-black ${positive ? "text-emerald-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function formatResponseTime(responseMs: number | null): string {
  return responseMs === null ? "—" : `${(responseMs / 1_000).toFixed(2)}s`;
}
