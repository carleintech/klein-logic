import "server-only";

export type PlayerProfile = Readonly<{
  id: string;
  nickname: string;
  createdAt: string;
  updatedAt: string;
}>;

export type RegionsResultInput = Readonly<{
  resultKey: string;
  mode: "classic" | "journey" | "time-attack";
  puzzleId?: string;
  completionMs?: number;
  score?: number;
  hintsUsed?: number;
  boardsSolved?: number;
  finalPuzzleId?: string;
  totalElapsedMs?: number;
  configuredDurationSeconds?: number;
  remainingSeconds?: number;
  catalogCleared?: boolean;
}>;

export type RegionsStats = Readonly<{
  classicPuzzlesCompleted: number;
  bestClassicCompletionMs: number | null;
  totalRegionsSolves: number;
  journeySessionsCompleted: number;
  highestJourneyPuzzle: string | null;
  journeyCatalogCompletions: number;
  bestJourneyTotalElapsedMs: number | null;
  timeAttackSessions: number;
  bestTimeAttackBoards: number;
  bestTimeAttackRemainingSeconds: number | null;
}>;
