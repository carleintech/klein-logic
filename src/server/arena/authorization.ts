import "server-only";

export type ArenaAuthorizationRole = "host" | "player" | "spectator";

export type ArenaOperation =
  | "start-tournament"
  | "cancel-tournament"
  | "administer-tournament"
  | "submit-own-answer"
  | "read-own-participant"
  | "read-public-tournament";

const ROLE_OPERATIONS: Record<ArenaAuthorizationRole, ReadonlySet<ArenaOperation>> = {
  host: new Set([
    "start-tournament",
    "cancel-tournament",
    "administer-tournament",
    "read-public-tournament",
  ]),
  player: new Set([
    "submit-own-answer",
    "read-own-participant",
    "read-public-tournament",
  ]),
  spectator: new Set(["read-public-tournament"]),
};

export function canPerformArenaOperation(
  role: ArenaAuthorizationRole,
  operation: ArenaOperation,
): boolean {
  return ROLE_OPERATIONS[role].has(operation);
}

export class ArenaAuthorizationError extends Error {
  constructor(
    readonly code:
      | "tournament-not-found"
      | "host-required"
      | "participant-required"
      | "participant-inactive"
      | "invalid-answer"
      | "tournament-not-joinable"
      | "tournament-full"
      | "round-not-open"
      | "response-already-submitted",
    message: string,
  ) {
    super(message);
    this.name = "ArenaAuthorizationError";
  }
}
