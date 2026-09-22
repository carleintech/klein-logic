"use server";

import type {
  JoinLobbyActionInput,
  LobbyActionResult,
} from "../../arena/lobby-ui";
import type {
  JoinLobbyResult,
  PublicLobbyView,
} from "../../server/arena/lobby";
import {
  runLobbyOperation,
  safeLobbyErrorMessage,
} from "../../server/arena/lobby-boundary";

function invalidInput<T>(
  code: "invalid-display-name" | "invalid-join-code",
): LobbyActionResult<T> {
  return {
    ok: false,
    error: { code, message: safeLobbyErrorMessage(code) },
  };
}

export async function createArenaLobbyAction(): Promise<
  LobbyActionResult<PublicLobbyView>
> {
  return runLobbyOperation((service, identity) =>
    service.createLobby(identity),
  );
}

export async function joinArenaLobbyAction(
  input: JoinLobbyActionInput,
): Promise<LobbyActionResult<JoinLobbyResult>> {
  if (!input || typeof input.joinCode !== "string") {
    return invalidInput("invalid-join-code");
  }

  if (typeof input.displayName !== "string") {
    return invalidInput("invalid-display-name");
  }

  return runLobbyOperation((service, identity) =>
    service.joinLobby(identity, {
      joinCode: input.joinCode,
      displayName: input.displayName,
    }),
  );
}

export async function startArenaLobbyAction(
  joinCode: string,
): Promise<LobbyActionResult<PublicLobbyView>> {
  if (typeof joinCode !== "string") {
    return invalidInput("invalid-join-code");
  }

  return runLobbyOperation((service, identity) =>
    service.startLobby(identity, joinCode),
  );
}

export async function cancelArenaLobbyAction(
  joinCode: string,
): Promise<LobbyActionResult<PublicLobbyView>> {
  if (typeof joinCode !== "string") {
    return invalidInput("invalid-join-code");
  }

  return runLobbyOperation((service, identity) =>
    service.cancelLobby(identity, joinCode),
  );
}
