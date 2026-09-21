import { runTournamentAudit } from "../engine/audit";
import { PIN3_DEMO_PRESET } from "../presets/pin3-demo";
import {
  generateChallenge,
  validateChallenge,
  type ChallengeAnswer,
  type ChallengeType,
} from "../../game/sumroll/engine";
import { serializeArenaChallenge } from "./serialize";
import type { PublicArenaChallenge, ServerArenaChallenge } from "./types";

const FORBIDDEN_KEYS = new Set([
  "correctSetId",
  "solutionIds",
  "seed",
  "runSeed",
  "tieBreak",
  "futureChallenge",
  "futureChallenges",
]);

const EXPECTED_PUBLIC_KEYS: Record<ChallengeType, string[]> = {
  match: ["id", "round", "seconds", "sets", "target", "type"],
  build: ["dice", "id", "round", "seconds", "target", "type"],
  exact: ["dice", "exactCount", "id", "round", "seconds", "target", "type"],
  memory: [
    "dice",
    "exposureDurationMs",
    "hiddenDurationMs",
    "id",
    "options",
    "readyDurationMs",
    "responseDurationMs",
    "round",
    "seconds",
    "type",
  ],
};

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoForbiddenKeys(value: unknown, path = "challenge"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoForbiddenKeys(entry, `${path}[${index}]`),
    );
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  Object.entries(value).forEach(([key, entry]) => {
    assert(!FORBIDDEN_KEYS.has(key), `Forbidden public key ${path}.${key}`);
    assertNoForbiddenKeys(entry, `${path}.${key}`);
  });
}

function correctAnswer(challenge: ServerArenaChallenge): ChallengeAnswer {
  if (challenge.type === "match") {
    return { type: "match", setId: challenge.correctSetId };
  }

  if (challenge.type === "build") {
    return { type: "build", selectedIds: challenge.solutionIds };
  }

  if (challenge.type === "exact") {
    return {
      type: "exact",
      selectedIds: challenge.solutionIds,
      deselections: 0,
    };
  }

  return { type: "memory", total: challenge.target };
}

function assertPublicShape(
  challenge: ServerArenaChallenge,
  publicChallenge: PublicArenaChallenge,
  publicId: string,
): void {
  assertNoForbiddenKeys(publicChallenge);
  assert(publicChallenge.id === publicId, "Public challenge must use its opaque ID.");
  assert(
    JSON.stringify(Object.keys(publicChallenge).sort()) ===
      JSON.stringify(EXPECTED_PUBLIC_KEYS[challenge.type]),
    `Unexpected public ${challenge.type} challenge fields.`,
  );

  if (publicChallenge.type === "memory") {
    assert(
      !("target" in publicChallenge),
      "Memory public challenge exposed the correct total.",
    );
  }
}

export type ArenaChallengeBoundaryAudit = {
  challengeTypes: ChallengeType[];
  publicSerializationSafe: true;
  validationPreserved: true;
  deterministicGenerationPreserved: true;
  deterministicTournamentPreserved: true;
};

export function runArenaChallengeBoundaryAudit(): ArenaChallengeBoundaryAudit {
  const challengeTypes: ChallengeType[] = ["match", "build", "exact", "memory"];

  challengeTypes.forEach((type, index) => {
    const options = { round: index + 3, runSeed: 9_876_543 + index };
    const challenge = generateChallenge(type, options);
    const regenerated = generateChallenge(type, options);
    const publicId = `public-${type}-${index + 1}`;
    const publicChallenge = serializeArenaChallenge(challenge, publicId);

    assertPublicShape(challenge, publicChallenge, publicId);
    assert(
      validateChallenge(challenge, correctAnswer(challenge)).correct,
      `${type} validation changed.`,
    );
    assert(
      JSON.stringify(challenge) === JSON.stringify(regenerated),
      `${type} deterministic generation changed.`,
    );
  });

  const firstAudit = runTournamentAudit(PIN3_DEMO_PRESET, "PIN3-V2-BOUNDARY");
  const secondAudit = runTournamentAudit(PIN3_DEMO_PRESET, "PIN3-V2-BOUNDARY");

  assert(
    JSON.stringify(firstAudit) === JSON.stringify(secondAudit),
    "Deterministic tournament behavior changed.",
  );

  return {
    challengeTypes,
    publicSerializationSafe: true,
    validationPreserved: true,
    deterministicGenerationPreserved: true,
    deterministicTournamentPreserved: true,
  };
}
