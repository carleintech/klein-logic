import "server-only";

import type {
  LobbyActionResult,
  LobbyUiError,
  LobbyUiErrorCode,
} from "../../arena/lobby-ui";
import { ArenaAuthorizationError } from "./authorization";
import type { ArenaIdentity } from "./identity";
import { getDatabasePool } from "../db/pool";
import {
  ArenaAuthenticationRequiredError,
  requireArenaIdentity,
} from "../identity/supabase-identity";
import { ArenaRepository } from "../repositories/arena-repository";
import { ArenaService } from "../services/arena-service";

function createLobbyService(): ArenaService {
  return new ArenaService(new ArenaRepository(getDatabasePool()));
}

function mapAuthorizationError(
  error: ArenaAuthorizationError,
): LobbyUiError {
  const codeMap: Partial<
    Record<ArenaAuthorizationError["code"], LobbyUiErrorCode>
  > = {
    "tournament-not-found": "arena-not-found",
    "tournament-not-joinable": "arena-not-joinable",
    "tournament-full": "arena-full",
    "display-name-taken": "display-name-taken",
    "invalid-display-name": "invalid-display-name",
    "invalid-join-code": "invalid-join-code",
    "lobby-not-ready": "lobby-not-ready",
    "host-required": "unauthorized",
    "invalid-lobby-transition": "arena-not-joinable",
  };
  const code = codeMap[error.code] ?? "server-error";

  return { code, message: safeLobbyErrorMessage(code) };
}

export function safeLobbyErrorMessage(code: LobbyUiErrorCode): string {
  switch (code) {
    case "arena-not-found":
      return "Arena not found.";
    case "arena-not-joinable":
      return "This Arena is no longer accepting players.";
    case "arena-full":
      return "This Arena is full.";
    case "display-name-taken":
      return "That display name is already taken.";
    case "invalid-display-name":
      return "The display name is invalid.";
    case "invalid-join-code":
      return "The Arena code is invalid.";
    case "lobby-not-ready":
      return "The Arena is not ready to start.";
    case "session-error":
      return "An authenticated Arena session is required.";
    case "unauthorized":
      return "You are not authorized to perform this action.";
    default:
      return "The Arena request could not be completed.";
  }
}

export function lobbyErrorHttpStatus(code: LobbyUiErrorCode): number {
  switch (code) {
    case "session-error":
      return 401;
    case "unauthorized":
      return 403;
    case "arena-not-found":
      return 404;
    case "arena-full":
    case "arena-not-joinable":
    case "display-name-taken":
    case "lobby-not-ready":
      return 409;
    case "invalid-display-name":
    case "invalid-join-code":
      return 400;
    default:
      return 500;
  }
}

export async function runLobbyOperation<T>(
  operation: (
    service: ArenaService,
    identity: ArenaIdentity,
  ) => Promise<T>,
): Promise<LobbyActionResult<T>> {
  try {
    const identity = await requireArenaIdentity();
    const data = await operation(createLobbyService(), identity);

    return { ok: true, data };
  } catch (error) {
    if (error instanceof ArenaAuthenticationRequiredError) {
      return {
        ok: false,
        error: {
          code: "session-error",
          message: safeLobbyErrorMessage("session-error"),
        },
      };
    }

    if (error instanceof ArenaAuthorizationError) {
      return { ok: false, error: mapAuthorizationError(error) };
    }

    console.error("Arena lobby operation failed.", error);

    return {
      ok: false,
      error: {
        code: "server-error",
        message: safeLobbyErrorMessage("server-error"),
      },
    };
  }
}
