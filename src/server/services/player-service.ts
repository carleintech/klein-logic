import "server-only";

import { randomUUID } from "node:crypto";

import type { ArenaIdentity } from "../arena/identity";
import { regionsPuzzles } from "../../game/puzzles";
import { getDatabasePool } from "../db/pool";
import { PlayerRepository } from "../repositories/player-repository";
import { normalizeNicknameKey, normalizePlayerNickname } from "../player/nickname";
import type { PlayerProfile, RegionsResultInput, RegionsStats } from "../player/types";

export class PlayerProfileError extends Error {
  constructor(message: string, public readonly code: "invalid-nickname" | "nickname-taken" | "invalid-result") {
    super(message);
    this.name = "PlayerProfileError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export class PlayerService {
  constructor(private readonly repository = new PlayerRepository(getDatabasePool())) {}

  getProfile(identity: ArenaIdentity): Promise<PlayerProfile | null> {
    return this.repository.getBySubject(identity.subjectId);
  }

  async saveNickname(identity: ArenaIdentity, value: string): Promise<PlayerProfile> {
    let nickname: string;
    try {
      nickname = normalizePlayerNickname(value);
    } catch (error) {
      throw new PlayerProfileError(error instanceof Error ? error.message : "Invalid player name.", "invalid-nickname");
    }
    const normalized = normalizeNicknameKey(nickname);
    try {
      const existing = await this.repository.getBySubject(identity.subjectId);
      return existing
        ? await this.repository.updateNickname(identity.subjectId, nickname, normalized)
        : await this.repository.create(identity.subjectId, nickname, normalized);
    } catch (error) {
      if (isUniqueViolation(error)) throw new PlayerProfileError("That player name is already in use.", "nickname-taken");
      throw error;
    }
  }

  async recordRegionsResult(identity: ArenaIdentity, input: RegionsResultInput): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(input.resultKey) || !regionsPuzzles.some((puzzle) => puzzle.id === input.puzzleId || puzzle.id === input.finalPuzzleId)) {
      throw new PlayerProfileError("The Regions result is invalid.", "invalid-result");
    }
    await this.repository.insertRegionsResult(identity.subjectId, input);
  }

  getStats(identity: ArenaIdentity): Promise<RegionsStats> {
    return this.repository.getStats(identity.subjectId);
  }
}

export function createRegionsResultKey(): string {
  return randomUUID();
}
