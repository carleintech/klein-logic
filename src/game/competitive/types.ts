import type { RegionsCompletionProof } from "@/game/engine/verify-completion";

export type RegionsCompetitiveMode = "classic" | "journey" | "time-attack";
export type RegionsCompetitiveAttemptStatus = "prepared" | "active" | "completed" | "expired" | "abandoned" | "invalid";

export type PreparedRegionsAttempt = Readonly<{
  attemptId: string;
  mode: RegionsCompetitiveMode;
  puzzleId: string | null;
  nickname: string;
  status: "prepared";
  preparedExpiresAt: string;
}>;

export type ActiveRegionsAttempt = Readonly<{
  attemptId: string;
  mode: RegionsCompetitiveMode;
  puzzleId: string | null;
  nextPuzzleId: string | null;
  nickname: string;
  status: RegionsCompetitiveAttemptStatus;
  acceptedBoards: number;
  startedAt: string | null;
  deadlineAt: string | null;
  trustedElapsedMs: number | null;
}>;

export type RegionsCompetitiveSubmission = Readonly<{
  attemptId: string;
  submissionKey: string;
  puzzleId: string;
  proof: RegionsCompletionProof;
  elapsedMs?: number;
  boardsSolved?: number;
  remainingSeconds?: number;
}>;

export type ClassicLeaderboardEntry = Readonly<{
  rank: number;
  nickname: string;
  completionMs: number;
  completedAt: string;
}>;

export type JourneyLeaderboardEntry = Readonly<{
  rank: number;
  nickname: string;
  catalogCleared: boolean;
  puzzlesCompleted: number;
  trustedElapsedMs: number;
}>;

export type TimeAttackLeaderboardEntry = Readonly<{
  rank: number;
  nickname: string;
  boardsSolved: number;
  timeToLastSolveMs: number;
}>;
