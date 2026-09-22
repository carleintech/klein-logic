import type { PublicLobbyView } from "../server/arena/lobby";

export type LobbyUiErrorCode =
  | "arena-not-found"
  | "arena-not-joinable"
  | "arena-full"
  | "display-name-taken"
  | "invalid-display-name"
  | "invalid-join-code"
  | "lobby-not-ready"
  | "session-error"
  | "unauthorized"
  | "server-error";

export type LobbyUiError = Readonly<{
  code: LobbyUiErrorCode;
  message: string;
}>;

export type LobbyActionResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: LobbyUiError }>;

export type JoinLobbyActionInput = Readonly<{
  joinCode: string;
  displayName: string;
}>;

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeJoinCodeForUi(value: string): string {
  return Array.from(value.trim().toUpperCase())
    .filter((character) => JOIN_CODE_ALPHABET.includes(character))
    .slice(0, 6)
    .join("");
}

export function validateDisplayNameForUi(value: string): string | null {
  if (/[\p{Cc}\p{Cf}]/u.test(value)) {
    return "Display name cannot contain control characters.";
  }

  const normalized = value.trim().replace(/\s+/gu, " ");
  const visibleCharacters = Array.from(normalized).length;

  if (visibleCharacters < 2 || visibleCharacters > 24) {
    return "Display name must contain between 2 and 24 characters.";
  }

  return null;
}

export function lobbyErrorMessage(code: LobbyUiErrorCode): string {
  const messages: Record<LobbyUiErrorCode, string> = {
    "arena-not-found": "Arena not found. Check the join code and try again.",
    "arena-not-joinable": "This Arena has already started or was cancelled.",
    "arena-full": "This Arena is full.",
    "display-name-taken": "That display name is already taken in this Arena.",
    "invalid-display-name": "Enter a valid display name between 2 and 24 characters.",
    "invalid-join-code": "Enter a valid six-character Arena code.",
    "lobby-not-ready": "This Arena needs all required players before it can start.",
    "session-error": "Your Arena session could not be verified. Please try again.",
    unauthorized: "You are not authorized to perform this action.",
    "server-error": "KleinLogic could not complete that request. Please try again.",
  };

  return messages[code];
}

export function canManageLobby(
  lobby: Pick<PublicLobbyView, "isHost">,
): boolean {
  return lobby.isHost;
}

export function lobbyStatusLabel(
  status: PublicLobbyView["status"],
): string {
  switch (status) {
    case "lobby":
      return "Waiting for players";
    case "countdown":
      return "Tournament starting";
    case "round":
    case "round-results":
      return "Tournament in progress";
    case "completed":
      return "Tournament complete";
    case "cancelled":
      return "Arena cancelled";
    default:
      return "Preparing Arena";
  }
}
