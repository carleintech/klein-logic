import {
  validateChallenge,
  type ChallengeAnswer,
  type ChallengeValidation,
} from "../../game/sumroll/engine";
import { serializeArenaChallenge } from "./serialize";
import type {
  PublicArenaChallenge,
  ServerArenaChallenge,
} from "./types";

export type LocalOnlyArenaChallengeBoundary = {
  serverChallenge: ServerArenaChallenge;
  publicChallenge: PublicArenaChallenge;
};

export function createLocalOnlyArenaChallengeBoundary(
  serverChallenge: ServerArenaChallenge,
): LocalOnlyArenaChallengeBoundary {
  return {
    serverChallenge,
    publicChallenge: serializeArenaChallenge(
      serverChallenge,
      `local-${serverChallenge.type}-round-${serverChallenge.round}`,
    ),
  };
}

export function validateLocalOnlyArenaAnswer(
  serverChallenge: ServerArenaChallenge,
  answer: ChallengeAnswer,
): ChallengeValidation {
  return validateChallenge(serverChallenge, answer);
}
