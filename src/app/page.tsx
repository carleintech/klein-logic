import Link from "next/link";

import LandingIntro from "@/components/landing/LandingIntro";
import KleinLogicShell from "@/components/logic/KleinLogicShell";
import { LogicPulse } from "@/components/feedback/FeedbackPrimitives";
import { LogicPanel, LogicStatus, logicButtonClass } from "@/components/logic/LogicPrimitives";

const experiences = [
  { name: "Regions", code: "R01", label: "Spatial reasoning", description: "Divide the grid into exact regions. Every clue and every cell matters.", href: "/play", signal: "logic" },
  { name: "SumRoll", code: "S02", label: "Visual arithmetic", description: "Read the field, reach the target, and hold accuracy under time pressure.", href: "/games/sumroll", signal: "logic" },
  { name: "PIN³", code: "P03", label: "Competitive intelligence", description: "Enter a live elimination Arena where fast, correct decisions determine who remains.", href: "/arena", signal: "arena" },
] as const;

export default function Home() {
  return (
    <KleinLogicShell context="Challenge Your Mind" status="Systems online">
      <LandingIntro />
      <section className="grid min-h-[calc(100vh-5rem)] items-center gap-14 py-[var(--section-space)] lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="logic-kicker">KleinLogic · Living Logic</p>
          <h1 className="mt-6 max-w-4xl text-5xl font-black uppercase leading-[0.92] tracking-[-0.055em] sm:text-7xl lg:text-[4.75rem] xl:text-[5.25rem]">
            Think deeper.<br /><span className="text-logic-primary">Decide faster.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-text-secondary sm:text-lg sm:leading-8">Original logic experiences built for precision, composure, and the moment uncertainty resolves into structure.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link id="landing-primary-action" href="/games" className={logicButtonClass({ size: "large" })}>Explore games</Link>
            <Link href="/arena" className={logicButtonClass({ variant: "secondary", size: "large" })}>Enter PIN³</Link>
          </div>
        </div>
        <LogicField />
      </section>

      <section id="experiences" className="border-t border-border-subtle py-[var(--section-space)]">
        <div className="max-w-2xl">
          <p className="logic-kicker">Current experiences</p>
          <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] sm:text-4xl">Choose how you want to think.</h2>
          <p className="mt-4 leading-7 text-text-secondary">Practice alone, sharpen a specific skill, or perform under competitive pressure.</p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {experiences.map((experience) => (
            <Link key={experience.name} href={experience.href} className="group rounded-[var(--radius-panel)] border border-border-default bg-surface-panel p-[var(--panel-padding)] transition-[border-color,background-color] hover:border-border-strong hover:bg-surface-panel-hover">
              <div className="flex items-start justify-between gap-4">
                <span className={`font-mono text-xs font-black tracking-[0.18em] ${experience.signal === "arena" ? "text-logic-secondary" : "text-logic-primary"}`}>{experience.code}</span>
                <LogicStatus status={experience.signal === "arena" ? "active" : "ready"} label="Available" />
              </div>
              <p className="mt-14 font-mono text-[0.625rem] font-bold uppercase tracking-[0.2em] text-text-muted">{experience.label}</p>
              <h3 className="mt-2 text-2xl font-black">{experience.name}</h3>
              <p className="mt-4 min-h-20 leading-7 text-text-secondary">{experience.description}</p>
              <span className="mt-7 inline-flex font-mono text-xs font-black uppercase tracking-[0.16em] text-text-primary group-hover:text-logic-primary">Open experience →</span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="flex flex-col gap-3 border-t border-border-subtle py-8 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 KleinLogic. All rights reserved.</p><p>A TechKlein experience.</p>
      </footer>
    </KleinLogicShell>
  );
}

function LogicField() {
  const nodes = [
    "left-[10%] top-[34%]", "left-[50%] top-[34%]", "right-[10%] top-[34%]",
    "left-[28%] bottom-[28%]", "left-[50%] bottom-[28%]", "right-[10%] bottom-[28%]",
  ];
  return (
    <LogicPanel className="relative mx-auto w-full max-w-lg overflow-hidden p-6 sm:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(120,240,165,0.08),transparent_58%)]" />
      <div className="relative flex items-center justify-between border-b border-border-subtle pb-5">
        <div><p className="logic-kicker">Logic field</p><p className="mt-2 text-sm text-text-secondary">Signal → relation → resolution</p></div>
        <LogicStatus status="active" label="Stable" />
      </div>
      <div className="relative mx-auto my-10 aspect-square max-w-[21rem]">
        <span className="absolute left-[10%] right-[10%] top-[34%] h-px bg-gradient-to-r from-transparent via-logic-primary/60 to-transparent" />
        <span className="absolute bottom-[28%] left-[28%] right-[10%] h-px bg-logic-secondary/30" />
        <span className="absolute bottom-[28%] left-1/2 top-[34%] w-px bg-gradient-to-b from-logic-primary/70 to-logic-secondary/25" />
        {nodes.map((position, index) => <LogicPulse key={position} className={`absolute ${position} h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border ${index === 1 || index === 4 ? "border-logic-primary bg-logic-primary shadow-[0_0_20px_rgba(120,240,165,0.45)]" : "border-border-strong bg-surface-panel"}`} />)}
      </div>
      <div className="relative grid grid-cols-3 gap-px bg-border-subtle text-center font-mono text-[0.625rem] uppercase tracking-[0.16em] text-text-muted">
        <span className="bg-surface-elevated px-2 py-4">Observe</span><span className="bg-surface-elevated px-2 py-4">Resolve</span><span className="bg-surface-elevated px-2 py-4">Advance</span>
      </div>
    </LogicPanel>
  );
}
