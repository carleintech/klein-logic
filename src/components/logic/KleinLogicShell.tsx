import Link from "next/link";
import type { ReactNode } from "react";

import { LogicMark, LogicStatus } from "./LogicPrimitives";
import { FeedbackPreferences } from "../feedback/FeedbackProvider";

export default function KleinLogicShell({ children, context, backHref, backLabel = "Back", arena = false, status }: {
  children: ReactNode;
  context?: string;
  backHref?: string;
  backLabel?: string;
  arena?: boolean;
  status?: string;
}) {
  return (
    <main className="logic-grid relative min-h-screen overflow-hidden bg-background px-[var(--page-gutter)] text-text-primary">
      <div className="relative mx-auto w-full max-w-[var(--layout-content)]">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-border-subtle py-4">
          <Link href="/" className="flex min-h-11 items-center gap-3 rounded-sm outline-none" aria-label="KleinLogic home">
            <LogicMark />
            <span className="text-sm font-black tracking-[0.08em] sm:text-base">KLEIN<span className="text-logic-primary">LOGIC</span></span>
          </Link>
          <div className="flex items-center gap-3 text-right">
            <FeedbackPreferences />
            {status ? <LogicStatus status="active" label={status} /> : null}
            {context ? <span className={`hidden font-mono text-[0.625rem] font-bold uppercase tracking-[0.2em] sm:block ${arena ? "text-logic-secondary" : "text-text-muted"}`}>{context}</span> : null}
            {backHref ? <Link href={backHref} className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary">← {backLabel}</Link> : null}
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
