alter table arena.tournaments
add column if not exists public_join_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournaments_public_join_code_valid'
      and conrelid = 'arena.tournaments'::regclass
  ) then
    alter table arena.tournaments
    add constraint tournaments_public_join_code_valid
    check (
      public_join_code is null
      or public_join_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
    );
  end if;
end $$;

create unique index if not exists tournaments_public_join_code_unique
  on arena.tournaments (public_join_code)
  where public_join_code is not null;

create unique index if not exists tournament_participants_display_name_unique
  on arena.tournament_participants (tournament_id, lower(display_name));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournament_participants_display_name_valid'
      and conrelid = 'arena.tournament_participants'::regclass
  ) then
    alter table arena.tournament_participants
    add constraint tournament_participants_display_name_valid
    check (
      display_name = btrim(display_name)
      and char_length(display_name) between 2 and 24
      and display_name !~ '[[:cntrl:]]'
      and display_name !~ '[[:space:]]{2,}'
    );
  end if;
end $$;

comment on column arena.tournaments.public_join_code is
  'Public human-friendly lobby locator. It grants no authority.';
