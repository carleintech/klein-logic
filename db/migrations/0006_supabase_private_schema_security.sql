alter table arena.tournaments enable row level security;
alter table arena.tournament_participants enable row level security;
alter table arena.tournament_rounds enable row level security;
alter table arena.round_responses enable row level security;
alter table arena.tournament_events enable row level security;

alter table app.players enable row level security;
alter table app.regions_results enable row level security;
alter table app.regions_competitive_attempts enable row level security;
alter table app.regions_competitive_submissions enable row level security;
alter table app.regions_competitive_results enable row level security;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on schema arena from %I', role_name);
      execute format('revoke all on all tables in schema arena from %I', role_name);
      execute format('revoke all on all sequences in schema arena from %I', role_name);
      execute format('revoke all on all functions in schema arena from %I', role_name);

      execute format('revoke all on schema app from %I', role_name);
      execute format('revoke all on all tables in schema app from %I', role_name);
      execute format('revoke all on all sequences in schema app from %I', role_name);
      execute format('revoke all on all functions in schema app from %I', role_name);

      execute format('alter default privileges in schema arena revoke all on tables from %I', role_name);
      execute format('alter default privileges in schema arena revoke all on sequences from %I', role_name);
      execute format('alter default privileges in schema arena revoke all on functions from %I', role_name);

      execute format('alter default privileges in schema app revoke all on tables from %I', role_name);
      execute format('alter default privileges in schema app revoke all on sequences from %I', role_name);
      execute format('alter default privileges in schema app revoke all on functions from %I', role_name);
    end if;
  end loop;
end
$$;
