import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  LOBBY_REALTIME_EVENT_NAME,
  lobbyRealtimeChannel,
  type LobbyRealtimePublisher,
} from "../../arena/lobby-realtime";

export const supabaseLobbyRealtimePublisher: LobbyRealtimePublisher = {
  async publish(notification) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
    const channel = supabase.channel(
      lobbyRealtimeChannel(notification.joinCode),
      { config: { private: false } },
    );

    try {
      const result = await channel.httpSend(
        LOBBY_REALTIME_EVENT_NAME,
        notification,
      );

      if (!result.success) {
        throw new Error("Supabase did not accept the lobby notification.");
      }
    } finally {
      await supabase.removeChannel(channel);
    }
  },
};
