import type { Metadata } from "next";
import Link from "next/link";

import ArenaShell from "../../components/arena/ArenaShell";
import CreateArenaButton from "../../components/arena/CreateArenaButton";
import { LogicDivider, LogicPanel, logicButtonClass } from "../../components/logic/LogicPrimitives";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PIN³ Arena",
  description:
    "Create or join a KleinLogic PIN³ competitive tournament lobby.",
};

export default function ArenaPage() {
  return (
    <ArenaShell context="PIN³ // Multiplayer Lobby">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center py-[var(--section-space)]">
        <div className="grid items-end gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="logic-kicker !text-logic-secondary">
              Pressure Intelligence Network
            </p>
            <h1 className="mt-5 text-7xl font-black tracking-[-0.07em] text-text-primary sm:text-8xl lg:text-9xl">
              PIN<sup className="text-2xl text-logic-secondary sm:text-3xl lg:text-4xl">3</sup>
            </h1>
            <p className="mt-6 max-w-xl text-xl font-bold leading-8 text-text-primary sm:text-2xl">
              50 enter. One remains.
            </p>
            <p className="mt-3 max-w-xl leading-7 text-text-secondary">
              Create an Arena for your group or join a live waiting room with a
              six-character code.
            </p>

            <div className="mt-9 flex items-center gap-4" aria-hidden="true">
              <span className="h-2 w-2 rotate-45 bg-logic-secondary shadow-[0_0_16px_rgba(113,219,232,0.55)]" />
              <span className="h-px w-24 bg-gradient-to-r from-logic-secondary/70 to-transparent" />
              <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-text-muted">
                Challenge Your Mind.
              </span>
            </div>
          </div>

          <LogicPanel className="p-5 sm:p-8">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.28em] text-text-muted">
              Choose your path
            </p>
            <div className="mt-6">
              <CreateArenaButton />
            </div>
            <div className="my-5"><LogicDivider label="or" /></div>
            <Link
              href="/arena/join"
              className={logicButtonClass({ variant: "secondary", size: "large", className: "w-full" })}
            >
              Join Arena
            </Link>
            <Link
              href="/arena/demo"
              className={logicButtonClass({ variant: "ghost", size: "compact", className: "mt-3 w-full" })}
            >
              Open local tournament demo →
            </Link>
          </LogicPanel>
        </div>
      </section>
    </ArenaShell>
  );
}
