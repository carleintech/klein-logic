import type { TournamentState } from "@/arena/types";

export default function ArenaLobby({
  tournament,
  onStart,
}: {
  tournament: TournamentState;
  onStart: () => void;
}) {
  const activePlayers = tournament.players.filter(
    (player) => player.status === "active",
  );
  const progression = [
    tournament.preset.playerCount,
    ...tournament.preset.rounds.map((round) => round.advancingPlayers),
  ];
  const humanPlayer = activePlayers.find(
    (player) => player.participantType === "human",
  );
  const simulatedPlayers = activePlayers.filter(
    (player) => player.participantType === "simulated",
  );

  return (
    <section className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 border-b border-cyan-300/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-300">
            {tournament.preset.name}
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-white">
            Tournament Lobby
          </h2>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-mono text-2xl font-black text-emerald-300">
            {activePlayers.length} / {tournament.preset.playerCount} READY
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            Seed {tournament.seed}
          </p>
        </div>
      </div>

      <div className="h-1.5 overflow-hidden bg-cyan-950">
        <div className="h-full w-full bg-cyan-300" />
      </div>

      {humanPlayer && (
        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 border border-cyan-300/20 bg-cyan-300/[0.04] px-5 py-4 text-center font-mono text-xs uppercase tracking-[0.18em]">
          <span className="text-right text-neutral-400">
            {simulatedPlayers.length} simulated players
          </span>
          <span className="text-cyan-300">+</span>
          <span className="text-left font-black text-white">You</span>
        </div>
      )}

      <div className="mt-6 grid max-h-72 grid-cols-2 gap-px overflow-y-auto border border-white/10 bg-white/10 sm:grid-cols-5">
        {activePlayers.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between bg-[#080d13] px-3 py-3 font-mono text-xs"
          >
            <span
              className={
                player.participantType === "human"
                  ? "font-black text-cyan-300"
                  : "text-neutral-300"
              }
            >
              {player.displayName}
            </span>
            <span className="ml-2 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]" />
          </div>
        ))}
      </div>

      <div className="mt-6 border border-white/10 bg-white/[0.025] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-500">
          Tournament format
        </p>
        <p className="mt-3 overflow-x-auto whitespace-nowrap font-mono text-lg font-black tracking-wider text-white sm:text-2xl">
          {progression.join(" → ")}
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-6 w-full border border-cyan-300 bg-cyan-300 px-6 py-4 font-mono text-sm font-black uppercase tracking-[0.22em] text-black transition hover:bg-white"
      >
        Start Tournament
      </button>
    </section>
  );
}
