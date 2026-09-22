import type { RealtimeChannel } from "@supabase/supabase-js";

import {
  LOBBY_REALTIME_EVENT_NAME,
  lobbyRealtimeChannel,
  parseLobbyRealtimeNotification,
  type LobbyRealtimeConnectionStatus,
  type LobbyRealtimeNotification,
  type LobbyRealtimeSubscription,
} from "../../arena/lobby-realtime";
import { createSupabaseBrowserClient } from "./client";

type SubscribeToLobbyRealtimeOptions = Readonly<{
  joinCode: string;
  onNotification(notification: LobbyRealtimeNotification): void;
  onStatus(status: LobbyRealtimeConnectionStatus): void;
}>;

function connectionStatus(status: string): LobbyRealtimeConnectionStatus {
  return status === "SUBSCRIBED" ? "connected" : "interrupted";
}

export function subscribeToLobbyRealtime({
  joinCode,
  onNotification,
  onStatus,
}: SubscribeToLobbyRealtimeOptions): LobbyRealtimeSubscription {
  const supabase = createSupabaseBrowserClient();
  const channel: RealtimeChannel = supabase.channel(
    lobbyRealtimeChannel(joinCode),
    { config: { private: false } },
  );
  let unsubscribed = false;

  onStatus("connecting");
  channel
    .on(
      "broadcast",
      { event: LOBBY_REALTIME_EVENT_NAME },
      ({ payload }) => {
        const notification = parseLobbyRealtimeNotification(payload);

        if (notification?.joinCode === joinCode) {
          onNotification(notification);
        }
      },
    )
    .subscribe((status) => {
      onStatus(connectionStatus(status));
    });

  return {
    async unsubscribe() {
      if (unsubscribed) {
        return;
      }

      unsubscribed = true;
      await supabase.removeChannel(channel);
    },
  };
}
