"use server";

import { requireArenaIdentity, ArenaAuthenticationRequiredError } from "@/server/identity/supabase-identity";
import { PlayerProfileError, PlayerService } from "@/server/services/player-service";
import { RegionsCompetitiveError, RegionsCompetitiveService } from "@/server/services/regions-competitive-service";
import type { PlayerProfile, RegionsResultInput, RegionsStats } from "@/server/player/types";
import type { ActiveRegionsAttempt, PreparedRegionsAttempt, RegionsCompetitiveSubmission } from "@/game/competitive/types";

export type PlayerActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "auth-required" | "database-unavailable" | "invalid-nickname" | "nickname-taken" | "invalid-result"; message: string };

function safeError(error: unknown): PlayerActionResult<never> {
  if (error instanceof ArenaAuthenticationRequiredError) return { ok: false, code: "auth-required", message: "A player session is required to save your name." };
  if (error instanceof PlayerProfileError) return { ok: false, code: error.code, message: error.message };
  return { ok: false, code: "database-unavailable", message: "Player profile services are temporarily unavailable." };
}

export type CompetitiveActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: RegionsCompetitiveError["code"] | "auth-required" | "database-unavailable"; message: string };

function safeCompetitiveError(error: unknown): CompetitiveActionResult<never> {
  if (error instanceof ArenaAuthenticationRequiredError) return { ok: false, code: "auth-required", message: "A player session is required for ranked play." };
  if (error instanceof RegionsCompetitiveError) return { ok: false, code: error.code, message: error.message };
  return { ok: false, code: "database-unavailable", message: "Ranked Regions is temporarily unavailable." };
}

export async function getPlayerProfileAction(): Promise<PlayerActionResult<{ profile: PlayerProfile | null; stats: RegionsStats | null }>> {
  try {
    const identity = await requireArenaIdentity();
    const service = new PlayerService();
    const profile = await service.getProfile(identity);
    return { ok: true, data: { profile, stats: profile ? await service.getStats(identity) : null } };
  } catch (error) {
    return safeError(error);
  }
}

export async function savePlayerNicknameAction(nickname: string): Promise<PlayerActionResult<PlayerProfile>> {
  try {
    const identity = await requireArenaIdentity();
    return { ok: true, data: await new PlayerService().saveNickname(identity, nickname) };
  } catch (error) {
    return safeError(error);
  }
}

export async function recordRegionsResultAction(input: RegionsResultInput): Promise<PlayerActionResult<null>> {
  try {
    const identity = await requireArenaIdentity();
    await new PlayerService().recordRegionsResult(identity, input);
    return { ok: true, data: null };
  } catch (error) {
    return safeError(error);
  }
}

export async function prepareRegionsRankedAttemptAction(input: { mode: string; puzzleId?: string }): Promise<CompetitiveActionResult<PreparedRegionsAttempt>> {
  try {
    const identity = await requireArenaIdentity();
    return { ok: true, data: await new RegionsCompetitiveService().prepare(identity, input) };
  } catch (error) {
    return safeCompetitiveError(error);
  }
}

export async function startRegionsRankedAttemptAction(attemptId: string): Promise<CompetitiveActionResult<ActiveRegionsAttempt>> {
  try {
    const identity = await requireArenaIdentity();
    return { ok: true, data: await new RegionsCompetitiveService().start(identity, attemptId) };
  } catch (error) {
    return safeCompetitiveError(error);
  }
}

export async function submitRegionsRankedCompletionAction(input: RegionsCompetitiveSubmission): Promise<CompetitiveActionResult<ActiveRegionsAttempt>> {
  try {
    const identity = await requireArenaIdentity();
    return { ok: true, data: await new RegionsCompetitiveService().submit(identity, input) };
  } catch (error) {
    return safeCompetitiveError(error);
  }
}

export async function finalizeRegionsRankedAttemptAction(attemptId: string): Promise<CompetitiveActionResult<ActiveRegionsAttempt>> {
  try {
    const identity = await requireArenaIdentity();
    return { ok: true, data: await new RegionsCompetitiveService().finalizeExpired(identity, attemptId) };
  } catch (error) {
    return safeCompetitiveError(error);
  }
}
