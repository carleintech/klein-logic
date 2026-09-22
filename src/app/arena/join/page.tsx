import type { Metadata } from "next";

import ArenaShell from "../../../components/arena/ArenaShell";
import JoinArenaForm from "../../../components/arena/JoinArenaForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join PIN³ Arena",
  description: "Enter a KleinLogic PIN³ Arena code and join the waiting room.",
};

export default async function JoinArenaPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const { code } = await searchParams;
  const initialJoinCode = Array.isArray(code) ? code[0] : code;

  return (
    <ArenaShell context="PIN³ // Join Arena">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-10 py-[var(--section-space)] lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="logic-kicker !text-logic-secondary">
            Player access
          </p>
          <h1 className="mt-5 text-5xl font-black tracking-tight sm:text-6xl">
            Join Arena
          </h1>
          <p className="mt-5 max-w-md text-lg leading-8 text-text-secondary">
            One code. One identity. Your place in the tournament remains yours
            if you reconnect.
          </p>
          <div className="mt-8 border-l border-logic-secondary/40 pl-5">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-text-primary">
              3 seconds. One choice.
            </p>
            <p className="mt-2 text-sm text-text-muted">Stay sharp.</p>
          </div>
        </div>
        <JoinArenaForm initialJoinCode={initialJoinCode} />
      </section>
    </ArenaShell>
  );
}
