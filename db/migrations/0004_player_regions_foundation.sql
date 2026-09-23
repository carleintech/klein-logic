create schema if not exists app;

create table app.players (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null unique,
  nickname text not null,
  normalized_nickname text not null unique,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint players_nickname_length check (char_length(nickname) between 2 and 24),
  constraint players_nickname_trimmed check (nickname = btrim(nickname)),
  constraint players_nickname_spacing check (nickname !~ '[[:space:]]{2,}'),
  constraint players_nickname_controls check (nickname !~ '[[:cntrl:]]')
);

create index players_normalized_nickname_idx on app.players (normalized_nickname);

create table app.regions_results (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references app.players(id) on delete cascade,
  result_key uuid not null unique,
  mode text not null,
  puzzle_id text,
  completion_ms integer,
  score integer,
  hints_used smallint,
  boards_solved smallint,
  final_puzzle_id text,
  total_elapsed_ms integer,
  configured_duration_seconds integer,
  remaining_seconds integer,
  catalog_cleared boolean not null default false,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint regions_results_mode_valid check (mode in ('classic', 'journey', 'time-attack')),
  constraint regions_results_completion_valid check (completion_ms is null or completion_ms >= 0),
  constraint regions_results_score_valid check (score is null or score >= 0),
  constraint regions_results_hints_valid check (hints_used is null or hints_used >= 0),
  constraint regions_results_boards_valid check (boards_solved is null or boards_solved >= 0),
  constraint regions_results_total_time_valid check (total_elapsed_ms is null or total_elapsed_ms >= 0),
  constraint regions_results_duration_valid check (configured_duration_seconds is null or configured_duration_seconds > 0),
  constraint regions_results_remaining_valid check (remaining_seconds is null or remaining_seconds >= 0)
);

create index regions_results_player_mode_idx on app.regions_results (player_id, mode);
create index regions_results_classic_puzzle_idx on app.regions_results (puzzle_id) where mode = 'classic';

create function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger players_set_updated_at
before update on app.players
for each row execute function app.set_updated_at();
