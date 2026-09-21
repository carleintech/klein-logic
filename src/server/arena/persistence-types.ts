import type {
  ArenaParticipantType,
  ArenaPlayerStatus,
  ArenaRoundResult,
  TournamentPreset,
  TournamentStatus,
} from "../../arena/types";
import type {
  ChallengeAnswer,
  ChallengeType,
  SumRollChallenge,
} from "../../game/sumroll/types";
import type { PublicArenaChallenge } from "../../arena/challenges/types";

export type ParticipantRole = "host" | "player";
export type PersistedRoundStatus =
  | "scheduled"
  | "open"
  | "closed"
  | "results-published";
export type ResponseDisposition = "accepted" | "late" | "forfeited";

export type CreateParticipantRecord = {
  enginePlayerId: string;
  authUserId?: string | null;
  displayName: string;
  role: ParticipantRole;
  participantType: ArenaParticipantType;
  status: ArenaPlayerStatus | "disqualified";
  eliminatedRound: number | null;
  finalPlacement: number | null;
  tieBreakValue: number;
};

export type CreateTournamentRecord = {
  id?: string;
  joinCodeDigest: string;
  hostUserId?: string | null;
  preset: TournamentPreset;
  status: TournamentStatus;
  currentRoundNumber: number | null;
  privateSeed: string;
  participants: CreateParticipantRecord[];
};

export type CreateRoundRecord = {
  tournamentId: string;
  roundNumber: number;
  challengeType: ChallengeType;
  status: PersistedRoundStatus;
  publicChallenge: PublicArenaChallenge;
  serverChallenge: SumRollChallenge;
  opensAt: Date | null;
  deadlineAt: Date | null;
  advancingCount: number;
};

export type CreateResponseRecord = {
  tournamentId: string;
  roundId: string;
  participantId: string;
  answerPayload: ChallengeAnswer | { simulated: true } | { timeout: true };
  responseMs: number | null;
  correct: boolean;
  disposition: ResponseDisposition;
};

export type CreateIdentityResponseRecord = {
  tournamentId: string;
  roundId: string;
  subjectId: string;
  answerPayload: ChallengeAnswer;
  correct: boolean;
};

export type JoinIdentityParticipantRecord = {
  tournamentId: string;
  subjectId: string;
  enginePlayerId: string;
  displayName: string;
  tieBreakValue: number;
};

export type PersistRoundResultRecord = {
  tournamentId: string;
  roundId: string;
  result: ArenaRoundResult;
  nextTournamentStatus: TournamentStatus;
  nextRoundNumber: number;
  players: CreateParticipantRecord[];
};

export type StoredTournament = {
  id: string;
  joinCodeDigest: string;
  hostUserId: string | null;
  presetId: string;
  presetSnapshot: TournamentPreset;
  status: TournamentStatus;
  currentRoundNumber: number | null;
  stateVersion: number;
  capacity: number;
  privateSeed: string;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredParticipant = CreateParticipantRecord & {
  id: string;
  tournamentId: string;
  joinedAt: Date;
};

export type StoredRound = {
  id: string;
  tournamentId: string;
  roundNumber: number;
  challengeType: ChallengeType;
  status: PersistedRoundStatus;
  publicChallenge: PublicArenaChallenge;
  serverChallenge: SumRollChallenge;
  resultSnapshot: ArenaRoundResult | null;
  opensAt: Date | null;
  deadlineAt: Date | null;
  advancingCount: number;
  resultsPublishedAt: Date | null;
};

export type StoredResponse = {
  id: string;
  tournamentId: string;
  roundId: string;
  participantId: string;
  answerPayload: Record<string, unknown>;
  receivedAt: Date;
  responseMs: number | null;
  correct: boolean;
  disposition: ResponseDisposition;
};

export type StoredTournamentEvent = {
  id: number;
  tournamentId: string;
  roundId: string | null;
  participantId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export type StoredTournamentAggregate = {
  tournament: StoredTournament;
  participants: StoredParticipant[];
  rounds: StoredRound[];
  responses: StoredResponse[];
  events: StoredTournamentEvent[];
};

export type StoredResponseContext = {
  participant: StoredParticipant;
  round: StoredRound;
};
