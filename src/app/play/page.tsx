import Link from "next/link";

import GameBoard from "@/components/game/GameBoard";
import { puzzle001 } from "@/game/puzzles/puzzle-001";

export default function PlayPage() {
  return (
    <main className="min-h-screen bg-[#090b10] px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <Link
            href="/"
            className="mb-5 inline-block text-sm font-semibold text-neutral-400 transition hover:text-white"
          >
            ← KleinLogic
          </Link>

          <p className="mb-2 text-xs font-bold uppercase tracking-[0.32em] text-emerald-400">
            Daily Challenge
          </p>

          <h1 className="text-4xl font-black tracking-tight">Regions</h1>

          <p className="mt-3 text-neutral-400">
            Divide the board into perfect regions.
          </p>
        </header>

        <GameBoard puzzle={puzzle001} />
      </div>
    </main>
  );
}
