import type { Metadata } from "next";
import Link from "next/link";

import ArenaShell from "../../components/arena/ArenaShell";
import CreateArenaButton from "../../components/arena/CreateArenaButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PIN³ Arena",
  description:
    "Create or join a KleinLogic PIN³ competitive tournament lobby.",
};

export default function ArenaPage() {
  return (
    <ArenaShell context="PIN³ // Multiplayer Lobby">
      <section className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-5xl flex-col justify-center py-12">
        <div className="grid items-end gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.34em] text-cyan-300">
              Pressure Intelligence Network
            </p>
            <h1 className="mt-5 text-7xl font-black tracking-[-0.07em] text-white sm:text-8xl lg:text-9xl">
              PIN<sup className="text-2xl text-cyan-300 sm:text-3xl lg:text-4xl">3</sup>
            </h1>
            <p className="mt-6 max-w-xl text-xl font-bold leading-8 text-neutral-200 sm:text-2xl">
              50 enter. One remains.
            </p>
            <p className="mt-3 max-w-xl leading-7 text-neutral-500">
              Create an Arena for your group or join a live waiting room with a
              six-character code.
            </p>

            <div className="mt-9 flex items-center gap-4" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(103,232,249,0.9)]" />
              <span className="h-px w-24 bg-gradient-to-r from-cyan-300/70 to-transparent" />
              <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-neutral-600">
                Challenge Your Mind.
              </span>
            </div>
          </div>

          <div className="border border-white/10 bg-[#071019]/90 p-5 shadow-2xl shadow-black/30 sm:p-8">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.28em] text-neutral-500">
              Choose your path
            </p>
            <div className="mt-6">
              <CreateArenaButton />
            </div>
            <div className="my-5 flex items-center gap-4" aria-hidden="true">
              <span className="h-px flex-1 bg-white/10" />
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-600">
                or
              </span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <Link
              href="/arena/join"
              className="flex min-h-14 w-full items-center justify-center border border-white/20 px-6 py-4 font-mono text-xs font-black uppercase tracking-[0.2em] text-white outline-none transition hover:border-white hover:bg-white hover:text-black focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Join Arena
            </Link>
            <Link
              href="/arena/demo"
              className="mt-4 flex min-h-11 items-center justify-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500 outline-none transition hover:text-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Open local tournament demo →
            </Link>
          </div>
        </div>
      </section>
    </ArenaShell>
  );
}
