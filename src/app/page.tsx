import Link from "next/link";

const games = [
  {
    name: "Regions",
    description:
      "Divide the grid into perfectly sized regions using logic and spatial reasoning.",
    icon: "▦",
    status: "PLAY NOW",
    href: "/play",
    available: true,
  },
  {
    name: "Numbers",
    description:
      "A daily number challenge built around patterns, deduction, and strategy.",
    icon: "123",
    status: "COMING SOON",
    href: "#",
    available: false,
  },
  {
    name: "Words",
    description:
      "Test your vocabulary and uncover hidden relationships between words.",
    icon: "Aa",
    status: "COMING SOON",
    href: "#",
    available: false,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#080a0f] text-white">
      {/* Navigation */}
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <LogoMark />

            <div>
              <p className="text-lg font-black tracking-tight">
                KLEIN
                <span className="text-emerald-400">LOGIC</span>
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-neutral-500 sm:block">
              Daily puzzles for curious minds
            </span>

            <Link
              href="/play"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:bg-neutral-200"
            >
              Play
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[140px]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />A new
              puzzle every day
            </div>

            <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Think deeper.
              <br />
              Play smarter.
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-8 text-neutral-400">
              Short daily logic games designed to challenge your reasoning,
              sharpen your mind, and give you that satisfying moment when
              everything clicks.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/play"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-400 px-7 font-black text-black transition hover:bg-emerald-300"
              >
                Play today&apos;s puzzle →
              </Link>

              <a
                href="#games"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-7 font-bold text-neutral-200 transition hover:bg-white/5"
              >
                Explore games
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-neutral-500">
              <span>✓ Free to play</span>
              <span>✓ New puzzles daily</span>
              <span>✓ No download required</span>
            </div>
          </div>

          <HeroPuzzle />
        </div>
      </section>

      {/* Games */}
      <section id="games" className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="mb-10">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
              KleinLogic Games
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Your daily mental workout.
            </h2>

            <p className="mt-3 max-w-2xl text-neutral-400">
              Start with Regions. More original KleinLogic challenges are on the
              way.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {games.map((game) => {
              const content = (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-black">
                      {game.icon}
                    </div>

                    <span
                      className={[
                        "rounded-full px-3 py-1 text-[10px] font-black tracking-[0.15em]",
                        game.available
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-white/5 text-neutral-500",
                      ].join(" ")}
                    >
                      {game.status}
                    </span>
                  </div>

                  <h3 className="mt-8 text-2xl font-black">{game.name}</h3>

                  <p className="mt-3 min-h-20 leading-7 text-neutral-400">
                    {game.description}
                  </p>

                  <div className="mt-7 text-sm font-bold">
                    {game.available ? (
                      <span className="text-emerald-300">
                        Start challenge →
                      </span>
                    ) : (
                      <span className="text-neutral-600">In development</span>
                    )}
                  </div>
                </>
              );

              if (game.available) {
                return (
                  <Link
                    key={game.name}
                    href={game.href}
                    className="group rounded-3xl border border-white/10 bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-emerald-400/30 hover:bg-white/[0.04]"
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <div
                  key={game.name}
                  className="rounded-3xl border border-white/10 bg-white/[0.015] p-6 opacity-60"
                >
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <LogoMark large />

          <p className="mt-7 text-xs font-bold uppercase tracking-[0.35em] text-neutral-500">
            KleinLogic™
          </p>

          <h2 className="mt-4 text-4xl font-black tracking-tight">
            Challenge Your Mind.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl leading-7 text-neutral-400">
            Built around simple rules and meaningful challenges. Every
            KleinLogic game should be easy to understand, difficult to master,
            and satisfying to solve.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© 2026 KleinLogic. All rights reserved.</p>

          <p>A TechKlein experience.</p>
        </div>
      </footer>
    </main>
  );
}

function LogoMark({ large = false }: { large?: boolean }) {
  return (
    <div
      className={[
        "grid grid-cols-2 gap-1",
        large ? "mx-auto h-16 w-16" : "h-9 w-9",
      ].join(" ")}
      aria-hidden="true"
    >
      <span className="rounded-sm bg-emerald-400" />
      <span className="rounded-sm bg-white" />
      <span className="rounded-sm bg-white" />
      <span className="rounded-sm bg-emerald-400" />
    </div>
  );
}

function HeroPuzzle() {
  const cells = [
    { value: "3", className: "bg-rose-500" },
    { value: "", className: "bg-rose-500/25" },
    { value: "", className: "bg-rose-500/25" },
    { value: "4", className: "bg-amber-400" },

    { value: "", className: "bg-emerald-500/25" },
    { value: "", className: "bg-emerald-500/25" },
    { value: "", className: "bg-emerald-500/25" },
    { value: "", className: "bg-cyan-500/25" },

    { value: "", className: "bg-emerald-500/25" },
    { value: "8", className: "bg-emerald-500" },
    { value: "", className: "bg-emerald-500/25" },
    { value: "", className: "bg-cyan-500/25" },

    { value: "4", className: "bg-violet-500" },
    { value: "", className: "bg-violet-500/25" },
    { value: "", className: "bg-cyan-500/25" },
    { value: "6", className: "bg-cyan-500" },
  ];

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
              Today
            </p>

            <p className="mt-1 font-bold">Daily Challenge</p>
          </div>

          <div className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
            #001
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-black/40 p-2">
          {cells.map((cell, index) => (
            <div
              key={index}
              className={[
                "flex aspect-square items-center justify-center rounded-lg",
                cell.className,
              ].join(" ")}
            >
              {cell.value && (
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-lg font-black text-black shadow-lg">
                  {cell.value}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between text-xs text-neutral-500">
          <span>Logic • Spatial</span>
          <span>~3 min</span>
        </div>
      </div>
    </div>
  );
}
