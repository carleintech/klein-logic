import GameBoard from "@/components/game/GameBoard";
import { puzzle001 } from "@/game/puzzles/puzzle-001";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-neutral-400">
            Daily Logic Puzzle
          </p>

          <h1 className="text-4xl font-black tracking-tight">GridForge</h1>

          <p className="mt-3 text-neutral-400">
            Divide the board into perfect regions.
          </p>
        </header>

        <GameBoard puzzle={puzzle001} />
      </div>
    </main>
  );
}
