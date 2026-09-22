import "server-only";

import type { LobbyActionResult } from "../../arena/lobby-ui";
import {
  createLobbyRealtimeNotification,
  type LobbyRealtimePublisher,
} from "../../arena/lobby-realtime";
import type { PublicLobbyView } from "./lobby";
import { supabaseLobbyRealtimePublisher } from "./supabase-lobby-realtime";

export async function notifyCommittedLobbyMutation<T>(
  result: LobbyActionResult<T>,
  selectLobby: (data: T) => PublicLobbyView,
  publisher: LobbyRealtimePublisher = supabaseLobbyRealtimePublisher,
): Promise<LobbyActionResult<T>> {
  if (!result.ok) {
    return result;
  }

  const lobby = selectLobby(result.data);

  try {
    await publisher.publish(
      createLobbyRealtimeNotification(lobby.joinCode, lobby.stateVersion),
    );
  } catch (error) {
    // PostgreSQL has already committed. Realtime is a best-effort signal;
    // clients recover through subscribe/reconnect/visibility reconciliation.
    console.error("Arena lobby notification failed after commit.", error);
  }

  return result;
}
