import type { Metadata } from "next";

import ArenaExperience from "../../../components/arena/ArenaExperience";
import ArenaShell from "../../../components/arena/ArenaShell";

export const metadata: Metadata = {
  title: "PIN³ Local Demo",
  description: "Run the deterministic KleinLogic PIN³ local tournament demo.",
};

export default function ArenaDemoPage() {
  return (
    <ArenaShell context="PIN³ // Local Simulation">
      <ArenaExperience />
    </ArenaShell>
  );
}
