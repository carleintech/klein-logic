import type { Metadata } from "next";
import Link from "next/link";

import ArenaExperience from "@/components/arena/ArenaExperience";

export const metadata: Metadata = {
  title: "PIN³ Arena",
  description:
    "Enter the Pressure Intelligence Network, KleinLogic's competitive tournament arena.",
};

export default function ArenaPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#04070b] px-4 py-7 text-white sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-[44rem] -translate-x-1/2 bg-cyan-400/[0.055] blur-[150px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(103,232,249,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,0.025)_1px,transparent_1px)] bg-[size:42px_42px]" />

      <div className="relative mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between border-b border-white/5 pb-5">
          <Link
            href="/"
            className="font-mono text-xs font-black uppercase tracking-[0.22em] text-white"
          >
            KleinLogic
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-cyan-300">
            Arena // Local Simulation
          </p>
        </header>

        <ArenaExperience />
      </div>
    </main>
  );
}
