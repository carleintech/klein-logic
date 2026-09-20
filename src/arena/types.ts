import type {
  ChallengeType,
  SumRollChallenge,
} from "../game/sumroll/types";

export type TournamentStatus =
  | "landing"
  | "lobby"
  | "countdown"
  | "round"
  | "round-results"
  | "completed";

export type ArenaPlayerStatus = "active" | "eliminated" | "champion";
export type ArenaParticipantType = "simulated" | "human";
export type ArenaParticipationMode = "simulation" | "player";

export type ArenaPlayer = {
  id: string;
  displayName: string;
  participantType: ArenaParticipantType;
  status: ArenaPlayerStatus;
  eliminatedRound: number | null;
  finalPlacement: number | null;
  tieBreak: number;
};

export type ArenaResponse = {
  playerId: string;
  roundNumber: number;
  correct: boolean;
  responseMs: number | null;
};

export type ArenaRoundConfig = {
  number: number;
  label: string;
  challengeType: ChallengeType;
  startingPlayers: number;
  advancingPlayers: number;
  difficultyRound: number;
  responseWindowMs: number;
};

export type TournamentPreset = {
  id: string;
  name: string;
  playerCount: number;
  rounds: ArenaRoundConfig[];
};

export type RankedArenaResponse = ArenaResponse & {
  rank: number;
  advanced: boolean;
  tieBreak: number;
};

export type ArenaRoundResult = {
  roundNumber: number;
  challengeId: string;
  startingPlayers: number;
  advancingPlayers: number;
  correctPlayers: number;
  incorrectPlayers: number;
  eliminatedPlayerIds: string[];
  rankings: RankedArenaResponse[];
};

export type TournamentState = {
  tournamentId: string;
  seed: string;
  participationMode: ArenaParticipationMode;
  preset: TournamentPreset;
  status: TournamentStatus;
  roundIndex: number;
  players: ArenaPlayer[];
  responses: ArenaResponse[];
  currentChallenge: SumRollChallenge | null;
  roundHistory: ArenaRoundResult[];
};

export type SimulatedPlayerProfile = {
  playerId: string;
  accuracy: number;
  speed: number;
};

export type TournamentAudit = {
  seed: string;
  tournamentId: string;
  championId: string;
  championName: string;
  rounds: ArenaRoundResult[];
  finalState: TournamentState;
};

export type CreateTournamentOptions = {
  participationMode?: ArenaParticipationMode;
  humanPlayer?: {
    id: string;
    displayName: string;
  };
};
