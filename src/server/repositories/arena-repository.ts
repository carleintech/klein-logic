import "server-only";

import type { Pool, PoolClient, QueryResult } from "pg";

import { withTransaction } from "../db/transaction";
import type {
  CreateParticipantRecord,
  CreateLobbyRecord,
  CreateIdentityResponseRecord,
  CreateResponseRecord,
  CreateRoundRecord,
  CreateTournamentRecord,
  JoinIdentityParticipantRecord,
  JoinLobbyParticipantRecord,
  JoinLobbyPersistenceResult,
  PersistRoundResultRecord,
  StoredParticipant,
  StoredResponse,
  StoredRound,
  StoredTournament,
  StoredTournamentAggregate,
  StoredTournamentEvent,
  TransitionLobbyRecord,
} from "../arena/persistence-types";
import { ArenaAuthorizationError } from "../arena/authorization";

type TournamentRow = {
  id: string;
  join_code_digest: string;
  public_join_code: string | null;
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
    publicJoinCode: row.public_join_code,
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

  async createLobby(input: CreateLobbyRecord): Promise<StoredTournamentAggregate> {
    const tournamentId = await withTransaction(this.pool, async (client) => {
      const tournament = await client.query<{ id: string }>(
        `insert into arena.tournaments (
           id, join_code_digest, public_join_code, host_user_id, preset_id,
           preset_snapshot, status, current_round_number, state_version,
           capacity, private_seed
         ) values (
           coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5,
           $6::jsonb, 'lobby', null, 1, $7, $8
         ) returning id`,
        [
          input.id ?? null,
          input.joinCodeDigest,
          input.publicJoinCode,
          input.hostSubjectId,
          input.preset.id,
          JSON.stringify(input.preset),
          input.preset.playerCount,
          input.privateSeed,
        ],
      );
      const id = tournament.rows[0].id;

      await client.query(
        `insert into arena.tournament_events (
           tournament_id, event_type, payload
         ) values ($1, 'lobby-created', $2::jsonb)`,
        [
          id,
          JSON.stringify({
            presetId: input.preset.id,
            capacity: input.preset.playerCount,
          }),
        ],
      );

      return id;
    });

    return this.getTournamentAggregate(tournamentId);
  }

  async joinLobbyForIdentity(
    input: JoinLobbyParticipantRecord,
  ): Promise<JoinLobbyPersistenceResult> {
    return withTransaction(this.pool, async (client) => {
      const tournamentResult = await client.query<TournamentRow>(
        `select * from arena.tournaments
         where public_join_code = $1
         for update`,
        [input.publicJoinCode],
      );

      if (tournamentResult.rowCount !== 1) {
        throw new ArenaAuthorizationError(
          "tournament-not-found",
          "The requested lobby was not found.",
        );
      }

      const tournament = tournamentResult.rows[0];
      const existing = await client.query<ParticipantRow>(
        `select * from arena.tournament_participants
         where tournament_id = $1 and auth_user_id = $2`,
        [tournament.id, input.subjectId],
      );

      if (existing.rowCount === 1) {
        return {
          tournamentId: tournament.id,
          participant: mapParticipant(existing.rows[0]),
          outcome: "rejoined_existing",
          stateVersion: Number(tournament.state_version),
        };
      }

      if (tournament.status !== "lobby") {
        throw new ArenaAuthorizationError(
          "tournament-not-joinable",
          "Participants may only join a tournament in its lobby.",
        );
      }

      const participantCount = await client.query<{ count: string }>(
        `select count(*) from arena.tournament_participants
         where tournament_id = $1`,
        [tournament.id],
      );

      if (Number(participantCount.rows[0].count) >= tournament.capacity) {
        throw new ArenaAuthorizationError(
          "tournament-full",
          "The tournament has reached its participant capacity.",
        );
      }

      let result: QueryResult<ParticipantRow>;

      try {
        result = await client.query<ParticipantRow>(
          `insert into arena.tournament_participants (
             tournament_id, engine_player_id, auth_user_id, display_name, role,
             participant_type, status, eliminated_round, final_placement,
             tie_break_value
           ) values ($1, $2, $3, $4, 'player', 'human', 'active', null, null, $5)
           returning *`,
          [
            tournament.id,
            input.enginePlayerId,
            input.subjectId,
            input.displayName,
            input.tieBreakValue,
          ],
        );
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "constraint" in error &&
          error.constraint === "tournament_participants_display_name_unique"
        ) {
          throw new ArenaAuthorizationError(
            "display-name-taken",
            "That display name is already used in this tournament.",
          );
        }

        throw error;
      }

      const stateVersion = await incrementStateVersion(client, tournament.id);

      await client.query(
        `insert into arena.tournament_events (
           tournament_id, participant_id, event_type, payload
         ) values ($1, $2, 'participant-joined', '{}'::jsonb)`,
        [tournament.id, result.rows[0].id],
      );

      return {
        tournamentId: tournament.id,
        participant: mapParticipant(result.rows[0]),
        outcome: "joined",
        stateVersion,
      };
    });
  }

  async transitionLobby(input: TransitionLobbyRecord): Promise<string> {
    return withTransaction(this.pool, async (client) => {
      const tournamentResult = await client.query<TournamentRow>(
        `select * from arena.tournaments
         where public_join_code = $1
         for update`,
        [input.publicJoinCode],
      );

      if (tournamentResult.rowCount !== 1) {
        throw new ArenaAuthorizationError(
          "tournament-not-found",
          "The requested lobby was not found.",
        );
      }

      const tournament = tournamentResult.rows[0];

      if (tournament.host_user_id !== input.hostSubjectId) {
        throw new ArenaAuthorizationError(
          "host-required",
          "Only the persisted tournament host may perform this operation.",
        );
      }

      if (tournament.status !== "lobby") {
        throw new ArenaAuthorizationError(
          "invalid-lobby-transition",
          "Only a lobby tournament can be started or cancelled.",
        );
      }

      const participantCount = await client.query<{ count: string }>(
        `select count(*) from arena.tournament_participants
         where tournament_id = $1`,
        [tournament.id],
      );
      const count = Number(participantCount.rows[0].count);

      if (input.transition === "start" && count !== tournament.capacity) {
        throw new ArenaAuthorizationError(
          "lobby-not-ready",
          `This preset requires exactly ${tournament.capacity} participants to start.`,
        );
      }

      const nextStatus = input.transition === "start" ? "countdown" : "cancelled";
      const eventType = input.transition === "start" ? "lobby-started" : "lobby-cancelled";

      await client.query(
        `update arena.tournaments
         set status = $2, state_version = state_version + 1
         where id = $1`,
        [tournament.id, nextStatus],
      );
      await client.query(
        `insert into arena.tournament_events (
           tournament_id, event_type, payload
         ) values ($1, $2, $3::jsonb)`,
        [
          tournament.id,
          eventType,
          JSON.stringify({ participantCount: count }),
        ],
      );

      return tournament.id;
    });
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

  async addParticipantForIdentity(
    input: JoinIdentityParticipantRecord,
  ): Promise<{ participant: StoredParticipant; stateVersion: number }> {
    return withTransaction(this.pool, async (client) => {
      await lockTournament(client, input.tournamentId);
      const tournament = await client.query<{
        status: StoredTournament["status"];
        capacity: number;
      }>(
        "select status, capacity from arena.tournaments where id = $1",
        [input.tournamentId],
      );

      if (tournament.rows[0].status !== "lobby") {
        throw new ArenaAuthorizationError(
          "tournament-not-joinable",
          "Participants may only join a tournament in its lobby.",
        );
      }

      const participantCount = await client.query<{ count: string }>(
        `select count(*) from arena.tournament_participants
         where tournament_id = $1`,
        [input.tournamentId],
      );

      if (Number(participantCount.rows[0].count) >= tournament.rows[0].capacity) {
        throw new ArenaAuthorizationError(
          "tournament-full",
          "The tournament has reached its participant capacity.",
        );
      }

      const result = await client.query<ParticipantRow>(
        `insert into arena.tournament_participants (
           tournament_id, engine_player_id, auth_user_id, display_name, role,
           participant_type, status, eliminated_round, final_placement,
           tie_break_value
         ) values ($1, $2, $3, $4, 'player', 'human', 'active', null, null, $5)
         returning *`,
        [
          input.tournamentId,
          input.enginePlayerId,
          input.subjectId,
          input.displayName,
          input.tieBreakValue,
        ],
      );
      const stateVersion = await incrementStateVersion(client, input.tournamentId);

      await client.query(
        `insert into arena.tournament_events (
           tournament_id, participant_id, event_type, payload
         ) values ($1, $2, 'identity-participant-joined', '{}'::jsonb)`,
        [input.tournamentId, result.rows[0].id],
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

  async insertResponseForIdentity(
    input: CreateIdentityResponseRecord,
  ): Promise<{ response: StoredResponse; stateVersion: number }> {
    return withTransaction(this.pool, async (client) => {
      await lockTournament(client, input.tournamentId);
      const participantResult = await client.query<ParticipantRow>(
        `select * from arena.tournament_participants
         where tournament_id = $1 and auth_user_id = $2
         for update`,
        [input.tournamentId, input.subjectId],
      );

      if (participantResult.rowCount !== 1) {
        throw new ArenaAuthorizationError(
          "participant-required",
          "The authenticated identity does not own a tournament participant.",
        );
      }

      const participant = participantResult.rows[0];

      if (participant.status !== "active") {
        throw new ArenaAuthorizationError(
          "participant-inactive",
          "Only an active participant may submit an Arena response.",
        );
      }

      const roundResult = await client.query<RoundRow>(
        `select * from arena.tournament_rounds
         where id = $1 and tournament_id = $2
         for update`,
        [input.roundId, input.tournamentId],
      );

      if (roundResult.rowCount !== 1 || roundResult.rows[0].status !== "open") {
        throw new ArenaAuthorizationError(
          "round-not-open",
          "The requested tournament round is not open.",
        );
      }

      const result = await client.query<ResponseRow>(
        `insert into arena.round_responses (
           tournament_id, round_id, participant_id, answer_payload,
           received_at, response_ms, correct, disposition
         )
         select
           $1, $2, $3, $4::jsonb, timing.received_at,
           case
             when timing.opens_at is null then null
             else greatest(
               0,
               floor(extract(epoch from (timing.received_at - timing.opens_at)) * 1000)
             )::integer
           end,
           $5,
           case
             when timing.deadline_at is not null
               and timing.received_at > timing.deadline_at then 'late'
             else 'accepted'
           end
         from (
           select opens_at, deadline_at, clock_timestamp() as received_at
           from arena.tournament_rounds
           where id = $2 and tournament_id = $1
         ) as timing
         returning *`,
        [
          input.tournamentId,
          input.roundId,
          participant.id,
          JSON.stringify(input.answerPayload),
          input.correct,
        ],
      );
      const stateVersion = await incrementStateVersion(client, input.tournamentId);

      await client.query(
        `insert into arena.tournament_events (
           tournament_id, round_id, participant_id, event_type, payload
         ) values ($1, $2, $3, 'identity-response-recorded', $4::jsonb)`,
        [
          input.tournamentId,
          input.roundId,
          participant.id,
          JSON.stringify({ disposition: result.rows[0].disposition }),
        ],
      );

      return { response: mapResponse(result.rows[0]), stateVersion };
    });
  }

  async getTournament(tournamentId: string): Promise<StoredTournament | null> {
    const result = await this.pool.query<TournamentRow>(
      "select * from arena.tournaments where id = $1",
      [tournamentId],
    );

    return result.rowCount === 1 ? mapTournament(result.rows[0]) : null;
  }

  async getLobbyAggregateByCode(
    publicJoinCode: string,
  ): Promise<StoredTournamentAggregate | null> {
    const tournament = await this.pool.query<TournamentRow>(
      `select * from arena.tournaments
       where public_join_code = $1`,
      [publicJoinCode],
    );

    if (tournament.rowCount !== 1) {
      return null;
    }

    return this.getTournamentAggregate(tournament.rows[0].id);
  }

  async getParticipantBySubject(
    tournamentId: string,
    subjectId: string,
  ): Promise<StoredParticipant | null> {
    const result = await this.pool.query<ParticipantRow>(
      `select * from arena.tournament_participants
       where tournament_id = $1 and auth_user_id = $2`,
      [tournamentId, subjectId],
    );

    return result.rowCount === 1 ? mapParticipant(result.rows[0]) : null;
  }

  async getRound(
    tournamentId: string,
    roundId: string,
  ): Promise<StoredRound | null> {
    const result = await this.pool.query<RoundRow>(
      `select * from arena.tournament_rounds
       where tournament_id = $1 and id = $2`,
      [tournamentId, roundId],
    );

    return result.rowCount === 1 ? mapRound(result.rows[0]) : null;
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
