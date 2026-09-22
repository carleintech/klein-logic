import type { Metadata } from "next";
import Link from "next/link";

import KleinLogicShell from "@/components/logic/KleinLogicShell";
import { LogicStatus } from "@/components/logic/LogicPrimitives";

export const metadata: Metadata = { title: "Games", description: "Choose a KleinLogic challenge and put your mind to work." };

const games = [
  { name: "Regions", code: "R01", label: "Spatial logic", description: "Divide the grid into perfectly sized rectangles. Every clue and every cell matters.", href: "/play", status: "ready" as const },
  { name: "SumRoll", code: "S02", label: "Visual arithmetic", description: "Scan the dice, hit the target, and build a streak before the clock runs out.", href: "/games/sumroll", status: "ready" as const },
  { name: "PIN³ Arena", code: "P03", label: "Live competition", description: "Bring KleinLogic skills into a server-authoritative elimination tournament.", href: "/arena", status: "active" as const },
];

export default function GamesPage() {
  return (
    <KleinLogicShell context="Experience Index" backHref="/" backLabel="Home">
      <section className="py-[var(--section-space)]">
        <div className="max-w-3xl">
          <p className="logic-kicker">KleinLogic Games</p>
          <h1 className="mt-5 text-5xl font-black tracking-[-0.045em] sm:text-6xl">Choose your challenge.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-text-secondary">Build accuracy, speed, and calm thinking—one original experience at a time.</p>
        </div>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {games.map((game) => (
            <Link key={game.name} href={game.href} className="group rounded-[var(--radius-panel)] border border-border-default bg-surface-panel p-[var(--panel-padding)] transition-colors hover:border-border-strong hover:bg-surface-panel-hover">
              <div className="flex items-start justify-between gap-4"><span className="font-mono text-xs font-black tracking-[0.2em] text-logic-primary">{game.code}</span><LogicStatus status={game.status} label="Available" /></div>
              <p className="mt-14 font-mono text-[0.625rem] font-black uppercase tracking-[0.2em] text-text-muted">{game.label}</p>
              <h2 className="mt-2 text-3xl font-black">{game.name}</h2>
              <p className="mt-4 min-h-24 leading-7 text-text-secondary">{game.description}</p>
              <span className="mt-6 inline-flex font-mono text-xs font-black uppercase tracking-[0.16em] group-hover:text-logic-primary">Start →</span>
            </Link>
          ))}
        </div>
        <div className="mt-12 border-l-2 border-logic-primary/50 bg-surface-elevated px-6 py-5">
          <p className="font-mono text-[0.625rem] font-black uppercase tracking-[0.2em] text-text-muted">The KleinLogic path</p>
          <p className="mt-2 text-lg font-black">Learn → Practice → Master → Compete</p>
        </div>
      </section>
    </KleinLogicShell>
  );
}
