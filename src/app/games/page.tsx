import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Games",
  description: "Choose a KleinLogic challenge and put your mind to work.",
};

const games = [
  {
    name: "Regions",
    label: "Spatial logic",
    description:
      "Divide the grid into perfectly sized rectangles. Every clue and every cell matters.",
    icon: "▦",
    href: "/play",
    accent: "emerald",
    meta: "Logic · ~3 min",
    available: true,
  },
  {
    name: "SumRoll",
    label: "Visual arithmetic",
    description:
      "Scan the dice, hit the target, and build a streak before the clock runs out.",
    icon: "⚄",
    href: "/games/sumroll",
    accent: "violet",
    meta: "Speed · 10 rounds",
    available: true,
  },
  {
    name: "PIN³ Arena",
    label: "Live competition",
    description:
      "KleinLogic skills under pressure in a fast, live elimination tournament.",
    icon: "P³",
    href: "#",
    accent: "amber",
    meta: "Coming next",
    available: false,
  },
] as const;

const accentStyles = {
  emerald: {
    icon: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    label: "text-emerald-400",
    hover: "hover:border-emerald-400/35",
  },
  violet: {
    icon: "border-violet-400/20 bg-violet-400/10 text-violet-300",
    label: "text-violet-400",
    hover: "hover:border-violet-400/35",
  },
  amber: {
    icon: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    label: "text-amber-400",
    hover: "",
  },
};

export default function GamesPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#080a0f] text-white">
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <LogoMark />
            <p className="text-lg font-black tracking-tight">
              KLEIN<span className="text-emerald-400">LOGIC</span>
            </p>
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-neutral-400 transition hover:text-white"
          >
            ← Home
          </Link>
        </div>
      </nav>

      <section className="relative">
        <div className="pointer-events-none absolute left-1/3 top-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-[140px]" />
        <div className="pointer-events-none absolute right-1/4 top-24 h-80 w-80 rounded-full bg-violet-500/10 blur-[140px]" />

        <div className="relative mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400">
              KleinLogic Games
            </p>
            <h1 className="mt-4 text-5xl font-black tracking-[-0.045em] sm:text-6xl">
              Choose your challenge.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-400">
              Build accuracy, speed, and calm thinking—one original game at a
              time.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {games.map((game) => {
              const styles = accentStyles[game.accent];
              const card = (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-2xl font-black ${styles.icon}`}
                    >
                      {game.icon}
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
                      {game.available ? "Play now" : "In development"}
                    </span>
                  </div>

                  <p className={`mt-8 text-xs font-black uppercase tracking-[0.2em] ${styles.label}`}>
                    {game.label}
                  </p>
                  <h2 className="mt-2 text-3xl font-black">{game.name}</h2>
                  <p className="mt-4 min-h-24 leading-7 text-neutral-400">
                    {game.description}
                  </p>
                  <div className="mt-7 flex items-center justify-between text-sm">
                    <span className="text-neutral-500">{game.meta}</span>
                    <span className="font-black text-white">
                      {game.available ? "Start →" : "Soon"}
                    </span>
                  </div>
                </>
              );

              return game.available ? (
                <Link
                  key={game.name}
                  href={game.href}
                  className={`rounded-3xl border border-white/10 bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:bg-white/[0.045] ${styles.hover}`}
                >
                  {card}
                </Link>
              ) : (
                <div
                  key={game.name}
                  className="rounded-3xl border border-white/10 bg-white/[0.015] p-6 opacity-60"
                >
                  {card}
                </div>
              );
            })}
          </div>

          <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.025] px-6 py-7 sm:flex sm:items-center sm:justify-between sm:gap-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-500">
                The path to Arena
              </p>
              <p className="mt-2 text-xl font-black">
                Learn. Practice. Master. Compete.
              </p>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400 sm:mt-0 sm:text-right">
              PIN³ will bring KleinLogic games together in a live pressure-based
              competition—without becoming a separate platform.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function LogoMark() {
  return (
    <div className="grid h-9 w-9 grid-cols-2 gap-1" aria-hidden="true">
      <span className="rounded-sm bg-emerald-400" />
      <span className="rounded-sm bg-white" />
      <span className="rounded-sm bg-white" />
      <span className="rounded-sm bg-emerald-400" />
    </div>
  );
}
