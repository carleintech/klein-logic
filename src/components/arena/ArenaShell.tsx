import Link from "next/link";
import type { ReactNode } from "react";

export default function ArenaShell({
  children,
  context,
}: {
  children: ReactNode;
  context: string;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#04070b] px-4 py-6 text-white sm:px-6 sm:py-9">
      <div className="pointer-events-none absolute left-1/2 top-[-12rem] h-[32rem] w-[46rem] -translate-x-1/2 rounded-full bg-cyan-300/[0.07] blur-[150px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(103,232,249,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,0.025)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="pointer-events-none absolute left-[8%] top-40 h-2 w-2 rounded-full bg-cyan-200/60 shadow-[0_0_20px_rgba(103,232,249,0.85)] motion-safe:animate-pulse" />
      <div className="pointer-events-none absolute bottom-28 right-[10%] h-1.5 w-1.5 rounded-full bg-emerald-200/60 shadow-[0_0_18px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" />

      <div className="relative mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-white/8 pb-5">
          <Link
            href="/"
            className="rounded-sm font-mono text-xs font-black uppercase tracking-[0.22em] text-white outline-none transition hover:text-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            KleinLogic™
          </Link>
          <p className="text-right font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300 sm:text-[10px] sm:tracking-[0.26em]">
            {context}
          </p>
        </header>
        {children}
      </div>
    </main>
  );
}
