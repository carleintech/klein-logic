import type { Metadata } from "next";

import KleinLogicShell from "@/components/logic/KleinLogicShell";
import SumRollExperience from "@/components/sumroll/SumRollExperience";

export const metadata: Metadata = { title: "SumRoll", description: "Train visual arithmetic, exact sums, and numeric memory." };

export default function SumRollPage() {
  return (
    <KleinLogicShell context="SumRoll // Visual Arithmetic" backHref="/games" backLabel="Games">
      <section className="mx-auto max-w-3xl py-10 sm:py-14">
        <header className="mb-8 text-center">
          <p className="logic-kicker">Visual arithmetic</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">SumRoll</h1>
          <p className="mt-3 text-text-secondary">Master Match, Build, Exact, and Memory—then face a 60-second Rush.</p>
        </header>
        <SumRollExperience />
      </section>
    </KleinLogicShell>
  );
}
