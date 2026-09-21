create schema if not exists arena;

create table arena.tournaments (
  id uuid primary key default gen_random_uuid(),
  join_code_digest text not null unique,
  host_user_id uuid,
  preset_id text not null,
  preset_snapshot jsonb not null,
  status text not null,
  current_round_number smallint,
  state_version bigint not null default 0,
  capacity smallint not null,
  private_seed text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint tournaments_preset_snapshot_object
    check (jsonb_typeof(preset_snapshot) = 'object'),
  constraint tournaments_status_valid
    check (status in ('landing', 'lobby', 'countdown', 'round', 'round-results', 'completed', 'cancelled')),
  constraint tournaments_current_round_valid
    check (current_round_number is null or current_round_number > 0),
  constraint tournaments_state_version_valid
    check (state_version >= 0),
  constraint tournaments_capacity_valid
    check (capacity >= 2)
);

create table arena.tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references arena.tournaments(id) on delete cascade,
  engine_player_id text not null,
  auth_user_id uuid,
  display_name text not null,
  role text not null default 'player',
  participant_type text not null,
  status text not null,
  joined_at timestamptz not null default clock_timestamp(),
  eliminated_round smallint,
  final_placement smallint,
  tie_break_value bigint not null,
  constraint tournament_participants_engine_identity_unique
    unique (tournament_id, engine_player_id),
  constraint tournament_participants_id_tournament_unique
    unique (id, tournament_id),
  constraint tournament_participants_role_valid
    check (role in ('host', 'player')),
  constraint tournament_participants_type_valid
    check (participant_type in ('human', 'simulated')),
  constraint tournament_participants_status_valid
    check (status in ('active', 'eliminated', 'champion', 'disqualified')),
  constraint tournament_participants_eliminated_round_valid
    check (eliminated_round is null or eliminated_round > 0),
  constraint tournament_participants_final_placement_valid
    check (final_placement is null or final_placement > 0),
  constraint tournament_participants_tie_break_valid
    check (tie_break_value >= 0)
);

create unique index tournament_participants_auth_identity_unique
  on arena.tournament_participants (tournament_id, auth_user_id)
  where auth_user_id is not null;

create index tournament_participants_tournament_id_idx
  on arena.tournament_participants (tournament_id);

create table arena.tournament_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references arena.tournaments(id) on delete cascade,
  round_number smallint not null,
  challenge_type text not null,
  status text not null,
  public_challenge jsonb not null,
  server_challenge jsonb not null,
  result_snapshot jsonb,
  opens_at timestamptz,
  deadline_at timestamptz,
  advancing_count smallint not null,
  results_published_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint tournament_rounds_number_unique
    unique (tournament_id, round_number),
  constraint tournament_rounds_id_tournament_unique
    unique (id, tournament_id),
  constraint tournament_rounds_number_valid
    check (round_number > 0),
  constraint tournament_rounds_type_valid
    check (challenge_type in ('match', 'build', 'exact', 'memory')),
  constraint tournament_rounds_status_valid
    check (status in ('scheduled', 'open', 'closed', 'results-published')),
  constraint tournament_rounds_public_challenge_object
    check (jsonb_typeof(public_challenge) = 'object'),
  constraint tournament_rounds_server_challenge_object
    check (jsonb_typeof(server_challenge) = 'object'),
  constraint tournament_rounds_result_snapshot_object
    check (result_snapshot is null or jsonb_typeof(result_snapshot) = 'object'),
  constraint tournament_rounds_deadline_order
    check (deadline_at is null or opens_at is null or deadline_at > opens_at),
  constraint tournament_rounds_advancing_count_valid
    check (advancing_count > 0)
);

create index tournament_rounds_tournament_id_idx
  on arena.tournament_rounds (tournament_id);

create table arena.round_responses (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  round_id uuid not null,
  participant_id uuid not null,
  answer_payload jsonb not null,
  received_at timestamptz not null default clock_timestamp(),
  response_ms integer,
  correct boolean not null,
  disposition text not null,
  constraint round_responses_round_participant_unique
    unique (round_id, participant_id),
  constraint round_responses_round_tournament_fkey
    foreign key (round_id, tournament_id)
    references arena.tournament_rounds(id, tournament_id) on delete cascade,
  constraint round_responses_participant_tournament_fkey
    foreign key (participant_id, tournament_id)
    references arena.tournament_participants(id, tournament_id) on delete cascade,
  constraint round_responses_answer_payload_object
    check (jsonb_typeof(answer_payload) = 'object'),
  constraint round_responses_response_ms_valid
    check (response_ms is null or response_ms >= 0),
  constraint round_responses_disposition_valid
    check (disposition in ('accepted', 'late', 'forfeited'))
);

create index round_responses_tournament_id_idx
  on arena.round_responses (tournament_id);

create index round_responses_round_id_idx
  on arena.round_responses (round_id);

create index round_responses_participant_id_idx
  on arena.round_responses (participant_id);

create table arena.tournament_events (
  id bigint generated always as identity primary key,
  tournament_id uuid not null references arena.tournaments(id),
  round_id uuid,
  participant_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  constraint tournament_events_round_tournament_fkey
    foreign key (round_id, tournament_id)
    references arena.tournament_rounds(id, tournament_id),
  constraint tournament_events_participant_tournament_fkey
    foreign key (participant_id, tournament_id)
    references arena.tournament_participants(id, tournament_id),
  constraint tournament_events_payload_object
    check (jsonb_typeof(payload) = 'object')
);

create index tournament_events_tournament_id_id_idx
  on arena.tournament_events (tournament_id, id);

create index tournament_events_round_id_idx
  on arena.tournament_events (round_id)
  where round_id is not null;

create index tournament_events_participant_id_idx
  on arena.tournament_events (participant_id)
  where participant_id is not null;

create function arena.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger tournaments_set_updated_at
before update on arena.tournaments
for each row execute function arena.set_updated_at();

create function arena.reject_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'tournament events are append-only';
end;
$$;

create trigger tournament_events_append_only
before update or delete on arena.tournament_events
for each row execute function arena.reject_event_mutation();
