import type { ReactNode } from "react";

import KleinLogicShell from "../logic/KleinLogicShell";

export default function ArenaShell({ children, context }: { children: ReactNode; context: string }) {
  return <KleinLogicShell context={context} arena>{children}</KleinLogicShell>;
}
