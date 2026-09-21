import "server-only";

import type { Pool, PoolClient } from "pg";

import { withTransaction } from "../db/transaction";
import type {
  CreateParticipantRecord,
  CreateResponseRecord,
  CreateRoundRecord,
  CreateTournamentRecord,
  PersistRoundResultRecord,
  StoredParticipant,
  StoredResponse,
  StoredRound,
  StoredTournament,
  StoredTournamentAggregate,
  StoredTournamentEvent,
} from "../arena/persistence-types";

type TournamentRow = {
  id: string;
  join_code_digest: string;
  host_user_id: string | null;
  preset_id: string;
  preset_snapshot: StoredTournament["presetSnapshot"];
  status: StoredTournament["status"];
  current_round_number: number | null;
  state_version: string;
  capacity: number;
  private_seed: string;
  created_at: Date;
  updated_at: Date;
};

type ParticipantRow = {
  id: string;
  tournament_id: string;
  engine_player_id: string;
  auth_user_id: string | null;
  display_name: string;
  role: StoredParticipant["role"];
  participant_type: StoredParticipant["participantType"];
  status: StoredParticipant["status"];
  joined_at: Date;
  eliminated_round: number | null;
  final_placement: number | null;
  tie_break_value: string;
};

type RoundRow = {
  id: string;
  tournament_id: string;
  round_number: number;
  challenge_type: StoredRound["challengeType"];
  status: StoredRound["status"];
  public_challenge: StoredRound["publicChallenge"];
  server_challenge: StoredRound["serverChallenge"];
  result_snapshot: StoredRound["resultSnapshot"];
  opens_at: Date | null;
  deadline_at: Date | null;
  advancing_count: number;
  results_published_at: Date | null;
};

type ResponseRow = {
  id: string;
  tournament_id: string;
  round_id: string;
  participant_id: string;
  answer_payload: Record<string, unknown>;
  received_at: Date;
  response_ms: number | null;
  correct: boolean;
  disposition: StoredResponse["disposition"];
};

type EventRow = {
  id: string;
  tournament_id: string;
  round_id: string | null;
  participant_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: Date;
};

function mapTournament(row: TournamentRow): StoredTournament {
  return {
    id: row.id,
    joinCodeDigest: row.join_code_digest,
    hostUserId: row.host_user_id,
    presetId: row.preset_id,
    presetSnapshot: row.preset_snapshot,
    status: row.status,
    currentRoundNumber: row.current_round_number,
    stateVersion: Number(row.state_version),
    capacity: row.capacity,
    privateSeed: row.private_seed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapParticipant(row: ParticipantRow): StoredParticipant {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    enginePlayerId: row.engine_player_id,
    authUserId: row.auth_user_id,
    displayName: row.display_name,
    role: row.role,
    participantType: row.participant_type,
    status: row.status,
    joinedAt: row.joined_at,
    eliminatedRound: row.eliminated_round,
    finalPlacement: row.final_placement,
    tieBreakValue: Number(row.tie_break_value),
  };
}

function mapRound(row: RoundRow): StoredRound {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    roundNumber: row.round_number,
    challengeType: row.challenge_type,
    status: row.status,
    publicChallenge: row.public_challenge,
    serverChallenge: row.server_challenge,
    resultSnapshot: row.result_snapshot,
    opensAt: row.opens_at,
    deadlineAt: row.deadline_at,
    advancingCount: row.advancing_count,
    resultsPublishedAt: row.results_published_at,
  };
}

function mapResponse(row: ResponseRow): StoredResponse {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    roundId: row.round_id,
    participantId: row.participant_id,
    answerPayload: row.answer_payload,
    receivedAt: row.received_at,
    responseMs: row.response_ms,
    correct: row.correct,
    disposition: row.disposition,
  };
}

function mapEvent(row: EventRow): StoredTournamentEvent {
  return {
    id: Number(row.id),
    tournamentId: row.tournament_id,
    roundId: row.round_id,
    participantId: row.participant_id,
    eventType: row.event_type,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

async function lockTournament(
  client: PoolClient,
  tournamentId: string,
): Promise<number> {
  const result = await client.query<{ state_version: string }>(
    "select state_version from arena.tournaments where id = $1 for update",
    [tournamentId],
  );

  if (result.rowCount !== 1) {
    throw new Error(`Tournament ${tournamentId} was not found.`);
  }

  return Number(result.rows[0].state_version);
}

async function incrementStateVersion(
  client: PoolClient,
  tournamentId: string,
): Promise<number> {
  const result = await client.query<{ state_version: string }>(
    `update arena.tournaments
     set state_version = state_version + 1
     where id = $1
     returning state_version`,
    [tournamentId],
  );

  return Number(result.rows[0].state_version);
}

export class ArenaRepository {
  constructor(private readonly pool: Pool) {}

  async createTournament(input: CreateTournamentRecord): Promise<StoredTournamentAggregate> {
    const tournamentId = await withTransaction(this.pool, async (client) => {
      const tournament = await client.query<{ id: string }>(
        `insert into arena.tournaments (
           id, join_code_digest, host_user_id, preset_id, preset_snapshot,
           status, current_round_number, state_version, capacity, private_seed
         ) values (
           coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5::jsonb,
           $6, $7, 1, $8, $9
         ) returning id`,
        [
          input.id ?? null,
          input.joinCodeDigest,
          input.hostUserId ?? null,
          input.preset.id,
          JSON.stringify(input.preset),
          input.status,
          input.currentRoundNumber,
          input.preset.playerCount,
          input.privateSeed,
        ],
      );
      const id = tournament.rows[0].id;

      if (input.participants.length > 0) {
        await client.query(
          `insert into arena.tournament_participants (
             tournament_id, engine_player_id, auth_user_id, display_name, role,
             participant_type, status, eliminated_round, final_placement,
             tie_break_value
           )
           select
             $1, participant.engine_player_id, participant.auth_user_id,
             participant.display_name, participant.role,
             participant.participant_type, participant.status,
             participant.eliminated_round, participant.final_placement,
             participant.tie_break_value
           from jsonb_to_recordset($2::jsonb) as participant(
             engine_player_id text,
             auth_user_id uuid,
             display_name text,
             role text,
             participant_type text,
             status text,
             eliminated_round smallint,
             final_placement smallint,
             tie_break_value bigint
           )`,
          [id, JSON.stringify(input.participants.map(toParticipantJson))],
        );
      }

      await client.query(
        `insert into arena.tournament_events (
           tournament_id, event_type, payload
         ) values ($1, 'tournament-created', $2::jsonb)`,
        [id, JSON.stringify({ participantCount: input.participants.length })],
      );

      return id;
    });

    return this.getTournamentAggregate(tournamentId);
  }

  async addParticipant(
    tournamentId: string,
    participant: CreateParticipantRecord,
  ): Promise<{ participant: StoredParticipant; stateVersion: number }> {
    return withTransaction(this.pool, async (client) => {
      await lockTournament(client, tournamentId);
      const result = await client.query<ParticipantRow>(
        `insert into arena.tournament_participants (
           tournament_id, engine_player_id, auth_user_id, display_name, role,
           participant_type, status, eliminated_round, final_placement,
           tie_break_value
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         returning *`,
        [
          tournamentId,
          participant.enginePlayerId,
          participant.authUserId ?? null,
          participant.displayName,
          participant.role,
          participant.participantType,
          participant.status,
          participant.eliminatedRound,
          participant.finalPlacement,
          participant.tieBreakValue,
        ],
      );
      const stateVersion = await incrementStateVersion(client, tournamentId);

      await client.query(
        `insert into arena.tournament_events (
           tournament_id, participant_id, event_type, payload
         ) values ($1, $2, 'participant-added', '{}'::jsonb)`,
        [tournamentId, result.rows[0].id],
      );

      return { participant: mapParticipant(result.rows[0]), stateVersion };
    });
  }

  async createRound(
    input: CreateRoundRecord,
  ): Promise<{ round: StoredRound; stateVersion: number }> {
    return withTransaction(this.pool, async (client) => {
      await lockTournament(client, input.tournamentId);
      const result = await client.query<RoundRow>(
        `insert into arena.tournament_rounds (
           tournament_id, round_number, challenge_type, status,
           public_challenge, server_challenge, opens_at, deadline_at,
           advancing_count
         ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)
         returning *`,
        [
          input.tournamentId,
          input.roundNumber,
          input.challengeType,
          input.status,
          JSON.stringify(input.publicChallenge),
          JSON.stringify(input.serverChallenge),
          input.opensAt,
          input.deadlineAt,
          input.advancingCount,
        ],
      );

      await client.query(
        `update arena.tournaments
         set status = 'round', current_round_number = $2
         where id = $1`,
        [input.tournamentId, input.roundNumber],
      );
      const stateVersion = await incrementStateVersion(client, input.tournamentId);

      await client.query(
        `insert into arena.tournament_events (
           tournament_id, round_id, event_type, payload
         ) values ($1, $2, 'round-created', $3::jsonb)`,
        [
          input.tournamentId,
          result.rows[0].id,
          JSON.stringify({ roundNumber: input.roundNumber }),
        ],
      );

      return { round: mapRound(result.rows[0]), stateVersion };
    });
  }

  async insertResponse(
    input: CreateResponseRecord,
  ): Promise<{ response: StoredResponse; stateVersion: number }> {
    return withTransaction(this.pool, async (client) => {
      await lockTournament(client, input.tournamentId);
      const result = await client.query<ResponseRow>(
        `insert into arena.round_responses (
           tournament_id, round_id, participant_id, answer_payload,
           response_ms, correct, disposition
         ) values ($1, $2, $3, $4::jsonb, $5, $6, $7)
         returning *`,
        [
          input.tournamentId,
          input.roundId,
          input.participantId,
          JSON.stringify(input.answerPayload),
          input.responseMs,
          input.correct,
          input.disposition,
        ],
      );
      const stateVersion = await incrementStateVersion(client, input.tournamentId);

      await client.query(
        `insert into arena.tournament_events (
           tournament_id, round_id, participant_id, event_type, payload
         ) values ($1, $2, $3, 'response-recorded', $4::jsonb)`,
        [
          input.tournamentId,
          input.roundId,
          input.participantId,
          JSON.stringify({ disposition: input.disposition }),
        ],
      );

      return { response: mapResponse(result.rows[0]), stateVersion };
    });
  }

  async persistRoundResult(input: PersistRoundResultRecord): Promise<number> {
    return withTransaction(this.pool, async (client) => {
      await lockTournament(client, input.tournamentId);
      await client.query(
        `update arena.tournament_rounds
         set status = 'results-published',
             result_snapshot = $3::jsonb,
             results_published_at = clock_timestamp()
         where id = $1 and tournament_id = $2`,
        [input.roundId, input.tournamentId, JSON.stringify(input.result)],
      );

      const participantUpdate = await client.query(
        `update arena.tournament_participants as stored
         set status = player.status,
             eliminated_round = player.eliminated_round,
             final_placement = player.final_placement
         from jsonb_to_recordset($2::jsonb) as player(
           engine_player_id text,
           status text,
           eliminated_round smallint,
           final_placement smallint
         )
         where stored.tournament_id = $1
           and stored.engine_player_id = player.engine_player_id`,
        [
          input.tournamentId,
          JSON.stringify(input.players.map(toParticipantResultJson)),
        ],
      );

      if (participantUpdate.rowCount !== input.players.length) {
        throw new Error("Not every tournament participant was updated.");
      }

      await client.query(
        `update arena.tournaments
         set status = $2, current_round_number = $3
         where id = $1`,
        [
          input.tournamentId,
          input.nextTournamentStatus,
          input.nextRoundNumber,
        ],
      );
      const stateVersion = await incrementStateVersion(client, input.tournamentId);

      await client.query(
        `insert into arena.tournament_events (
           tournament_id, round_id, event_type, payload
         ) values ($1, $2, 'round-results-persisted', $3::jsonb)`,
        [
          input.tournamentId,
          input.roundId,
          JSON.stringify({
            roundNumber: input.result.roundNumber,
            advancingPlayers: input.result.advancingPlayers,
          }),
        ],
      );

      return stateVersion;
    });
  }

  async getTournamentAggregate(
    tournamentId: string,
  ): Promise<StoredTournamentAggregate> {
    return withTransaction(this.pool, async (client) => {
      const tournamentResult = await client.query<TournamentRow>(
        "select * from arena.tournaments where id = $1",
        [tournamentId],
      );

      if (tournamentResult.rowCount !== 1) {
        throw new Error(`Tournament ${tournamentId} was not found.`);
      }

      const participants = await client.query<ParticipantRow>(
        `select * from arena.tournament_participants
         where tournament_id = $1 order by engine_player_id`,
        [tournamentId],
      );
      const rounds = await client.query<RoundRow>(
        `select * from arena.tournament_rounds
         where tournament_id = $1 order by round_number`,
        [tournamentId],
      );
      const responses = await client.query<ResponseRow>(
        `select * from arena.round_responses
         where tournament_id = $1 order by received_at, id`,
        [tournamentId],
      );
      const events = await client.query<EventRow>(
        `select * from arena.tournament_events
         where tournament_id = $1 order by id`,
        [tournamentId],
      );

      return {
        tournament: mapTournament(tournamentResult.rows[0]),
        participants: participants.rows.map(mapParticipant),
        rounds: rounds.rows.map(mapRound),
        responses: responses.rows.map(mapResponse),
        events: events.rows.map(mapEvent),
      };
    });
  }
}

function toParticipantJson(participant: CreateParticipantRecord) {
  return {
    engine_player_id: participant.enginePlayerId,
    auth_user_id: participant.authUserId ?? null,
    display_name: participant.displayName,
    role: participant.role,
    participant_type: participant.participantType,
    status: participant.status,
    eliminated_round: participant.eliminatedRound,
    final_placement: participant.finalPlacement,
    tie_break_value: participant.tieBreakValue,
  };
}

function toParticipantResultJson(participant: CreateParticipantRecord) {
  return {
    engine_player_id: participant.enginePlayerId,
    status: participant.status,
    eliminated_round: participant.eliminatedRound,
    final_placement: participant.finalPlacement,
  };
}
