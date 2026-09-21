import "server-only";

export type ArenaAuthenticationType =
  | "anonymous"
  | "email"
  | "phone"
  | "other";

export type ArenaIdentity = Readonly<{
  subjectId: string;
  authenticationType: ArenaAuthenticationType;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createArenaIdentity(
  subjectId: string,
  authenticationType: ArenaAuthenticationType,
): ArenaIdentity {
  if (!UUID_PATTERN.test(subjectId)) {
    throw new Error("Arena identity subjectId must be a UUID.");
  }

  return Object.freeze({ subjectId, authenticationType });
}
