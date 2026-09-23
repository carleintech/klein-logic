create table app.regions_competitive_attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references app.players(id) on delete cascade,
  mode text not null,
  puzzle_id text,
  status text not null default 'prepared',
  current_puzzle_index smallint not null default 0,
  accepted_boards smallint not null default 0,
  session_duration_seconds integer,
  prepared_at timestamptz not null default clock_timestamp(),
  prepared_expires_at timestamptz not null default (clock_timestamp() + interval '5 minutes'),
  started_at timestamptz,
  deadline_at timestamptz,
  last_accepted_at timestamptz,
  completed_at timestamptz,
  constraint regions_competitive_attempts_mode_valid check (mode in ('classic', 'journey', 'time-attack')),
  constraint regions_competitive_attempts_status_valid check (status in ('prepared', 'active', 'completed', 'expired', 'abandoned', 'invalid')),
  constraint regions_competitive_attempts_progress_valid check (current_puzzle_index >= 0 and accepted_boards >= 0),
  constraint regions_competitive_attempts_classic_puzzle check ((mode = 'classic' and puzzle_id is not null) or (mode <> 'classic' and puzzle_id is null)),
  constraint regions_competitive_attempts_duration check (
    (mode = 'time-attack' and session_duration_seconds = 180)
    or (mode <> 'time-attack' and session_duration_seconds is null)
  )
);

create unique index regions_competitive_attempts_one_open_per_player
  on app.regions_competitive_attempts (player_id)
  where status in ('prepared', 'active');

create index regions_competitive_attempts_player_history_idx
  on app.regions_competitive_attempts (player_id, prepared_at desc);

create table app.regions_competitive_submissions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references app.regions_competitive_attempts(id) on delete cascade,
  submission_key uuid not null,
  puzzle_id text not null,
  puzzle_index smallint not null,
  received_at timestamptz not null default clock_timestamp(),
  constraint regions_competitive_submissions_index_valid check (puzzle_index >= 0),
  unique (attempt_id, submission_key),
  unique (attempt_id, puzzle_index)
);

create index regions_competitive_submissions_attempt_idx
  on app.regions_competitive_submissions (attempt_id, puzzle_index);

create table app.regions_competitive_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references app.regions_competitive_attempts(id) on delete cascade,
  player_id uuid not null references app.players(id) on delete cascade,
  mode text not null,
  puzzle_id text,
  boards_solved smallint not null,
  catalog_cleared boolean not null default false,
  trusted_elapsed_ms integer not null,
  completed_at timestamptz not null,
  constraint regions_competitive_results_mode_valid check (mode in ('classic', 'journey', 'time-attack')),
  constraint regions_competitive_results_boards_valid check (boards_solved >= 0),
  constraint regions_competitive_results_elapsed_valid check (trusted_elapsed_ms >= 0),
  constraint regions_competitive_results_classic_puzzle check ((mode = 'classic' and puzzle_id is not null) or (mode <> 'classic' and puzzle_id is null))
);

create index regions_competitive_results_player_mode_idx
  on app.regions_competitive_results (player_id, mode);

create index regions_competitive_results_classic_rank_idx
  on app.regions_competitive_results (puzzle_id, trusted_elapsed_ms, completed_at)
  where mode = 'classic';

create index regions_competitive_results_journey_rank_idx
  on app.regions_competitive_results (catalog_cleared desc, boards_solved desc, trusted_elapsed_ms, completed_at)
  where mode = 'journey';

create index regions_competitive_results_time_attack_rank_idx
  on app.regions_competitive_results (boards_solved desc, trusted_elapsed_ms, completed_at)
  where mode = 'time-attack';
