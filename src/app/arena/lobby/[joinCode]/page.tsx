import type { Metadata } from "next";

import ArenaShell from "../../../../components/arena/ArenaShell";
import MultiplayerLobby from "../../../../components/arena/MultiplayerLobby";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PIN³ Waiting Room",
  description: "KleinLogic PIN³ multiplayer tournament waiting room.",
};

export default async function ArenaLobbyPage({
  params,
}: {
  params: Promise<{ joinCode: string }>;
}) {
  const { joinCode } = await params;

  return (
    <ArenaShell context="PIN³ // Waiting Room">
      <MultiplayerLobby joinCode={joinCode} />
    </ArenaShell>
  );
}
