import type { Metadata } from "next";
import Link from "next/link";

import SumRollExperience from "@/components/sumroll/SumRollExperience";

export const metadata: Metadata = {
  title: "SumRoll",
  description: "Find the dice set that hits the target before time runs out.",
};

export default function SumRollPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090b10] px-4 py-8 text-white sm:py-10">
      <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-500/10 blur-[140px]" />

      <div className="relative mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <Link
            href="/games"
            className="mb-5 inline-block text-sm font-semibold text-neutral-400 transition hover:text-white"
          >
            ← All games
          </Link>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.32em] text-violet-400">
            Visual arithmetic
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            SumRoll
          </h1>
          <p className="mt-3 text-neutral-400">
            Master each challenge, then take all three into a 60-second Rush.
          </p>
        </header>

        <SumRollExperience />
      </div>
    </main>
  );
}
