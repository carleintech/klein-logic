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
import { notifyCommittedLobbyMutation } from "../../server/arena/lobby-realtime-boundary";

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
  const result = await runLobbyOperation((service, identity) =>
    service.createLobby(identity),
  );

  return notifyCommittedLobbyMutation(result, (lobby) => lobby);
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

  const result = await runLobbyOperation((service, identity) =>
    service.joinLobby(identity, {
      joinCode: input.joinCode,
      displayName: input.displayName,
    }),
  );

  return notifyCommittedLobbyMutation(result, ({ lobby }) => lobby);
}

export async function startArenaLobbyAction(
  joinCode: string,
): Promise<LobbyActionResult<PublicLobbyView>> {
  if (typeof joinCode !== "string") {
    return invalidInput("invalid-join-code");
  }

  const result = await runLobbyOperation((service, identity) =>
    service.startLobby(identity, joinCode),
  );

  return notifyCommittedLobbyMutation(result, (lobby) => lobby);
}

export async function cancelArenaLobbyAction(
  joinCode: string,
): Promise<LobbyActionResult<PublicLobbyView>> {
  if (typeof joinCode !== "string") {
    return invalidInput("invalid-join-code");
  }

  const result = await runLobbyOperation((service, identity) =>
    service.cancelLobby(identity, joinCode),
  );

  return notifyCommittedLobbyMutation(result, (lobby) => lobby);
}
