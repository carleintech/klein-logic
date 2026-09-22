export const LOBBY_REALTIME_EVENT_NAME = "lobby-updated";
export const LOBBY_REALTIME_EVENT_TYPE = "LOBBY_UPDATED";

export type LobbyRealtimeNotification = Readonly<{
  type: typeof LOBBY_REALTIME_EVENT_TYPE;
  joinCode: string;
  stateVersion: number;
}>;

export type LobbyRealtimeConnectionStatus =
  | "connecting"
  | "connected"
  | "interrupted";

export type LobbyRealtimePublisher = Readonly<{
  publish(notification: LobbyRealtimeNotification): Promise<void>;
}>;

export type LobbyRealtimeSubscription = Readonly<{
  unsubscribe(): Promise<void>;
}>;

export function lobbyRealtimeChannel(joinCode: string): string {
  return `arena:lobby:${joinCode}`;
}

export function createLobbyRealtimeNotification(
  joinCode: string,
  stateVersion: number,
): LobbyRealtimeNotification {
  return {
    type: LOBBY_REALTIME_EVENT_TYPE,
    joinCode,
    stateVersion,
  };
}

export function parseLobbyRealtimeNotification(
  value: unknown,
): LobbyRealtimeNotification | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<LobbyRealtimeNotification>;

  if (
    candidate.type !== LOBBY_REALTIME_EVENT_TYPE ||
    typeof candidate.joinCode !== "string" ||
    !Number.isSafeInteger(candidate.stateVersion) ||
    (candidate.stateVersion ?? 0) < 1
  ) {
    return null;
  }

  return {
    type: LOBBY_REALTIME_EVENT_TYPE,
    joinCode: candidate.joinCode,
    stateVersion: candidate.stateVersion as number,
  };
}

export function shouldReconcileLobbyNotification(
  notification: LobbyRealtimeNotification,
  joinCode: string,
  latestStateVersion: number,
): boolean {
  return (
    notification.joinCode === joinCode &&
    notification.stateVersion > latestStateVersion
  );
}

export function shouldApplyLobbyProjection(
  nextStateVersion: number,
  latestStateVersion: number,
): boolean {
  return nextStateVersion >= latestStateVersion;
}
