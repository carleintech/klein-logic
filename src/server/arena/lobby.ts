import "server-only";

import { randomBytes } from "node:crypto";

import type { ArenaPlayerStatus, TournamentStatus } from "../../arena/types";
import { PIN3_DEMO_PRESET } from "../../arena/presets/pin3-demo";

export const LOBBY_JOIN_CODE_LENGTH = 6;
export const LOBBY_JOIN_CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const LOBBY_JOIN_CODE_PATTERN =
  /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export const MULTIPLAYER_LOBBY_PRESET = PIN3_DEMO_PRESET;

export type LobbyJoinOutcome = "joined" | "rejoined_existing";
export type LobbyTransition = "start" | "cancel";

export type PublicLobbyParticipant = Readonly<{
  displayName: string;
  status: ArenaPlayerStatus | "disqualified";
}>;

export type PublicOwnLobbyParticipant = PublicLobbyParticipant &
  Readonly<{
    joinedAt: string;
  }>;

export type PublicLobbyView = Readonly<{
  joinCode: string;
  stateVersion: number;
  presetId: string;
  presetName: string;
  status: TournamentStatus;
  capacity: number;
  participantCount: number;
  participants: PublicLobbyParticipant[];
  isHost: boolean;
  ownParticipant: PublicOwnLobbyParticipant | null;
}>;

export type JoinLobbyResult = Readonly<{
  outcome: LobbyJoinOutcome;
  lobby: PublicLobbyView;
}>;

export function normalizeLobbyJoinCode(value: string): string {
  const normalized = value.trim().toUpperCase();

  if (!LOBBY_JOIN_CODE_PATTERN.test(normalized)) {
    throw new Error("Join code must be a valid six-character lobby code.");
  }

  return normalized;
}

export function generateLobbyJoinCode(): string {
  const bytes = randomBytes(LOBBY_JOIN_CODE_LENGTH);

  return Array.from(
    bytes,
    (byte) => LOBBY_JOIN_CODE_ALPHABET[byte & 31],
  ).join("");
}

export function generateLobbyPrivateSeed(): string {
  return randomBytes(32).toString("hex");
}

export function normalizeLobbyDisplayName(value: string): string {
  if (/[\p{Cc}\p{Cf}]/u.test(value)) {
    throw new Error("Display name cannot contain control characters.");
  }

  const normalized = value.trim().replace(/\s+/gu, " ");
  const visibleCharacters = Array.from(normalized).length;

  if (visibleCharacters < 2 || visibleCharacters > 24) {
    throw new Error("Display name must contain between 2 and 24 characters.");
  }

  return normalized;
}
