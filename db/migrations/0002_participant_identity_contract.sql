alter table arena.tournament_participants
add constraint tournament_participants_human_identity_required
check (participant_type <> 'human' or auth_user_id is not null);

comment on column arena.tournaments.host_user_id is
  'Application-owned authenticated subject UUID for the tournament host.';

comment on column arena.tournament_participants.auth_user_id is
  'Application-owned authenticated subject UUID resolved by the server identity adapter.';
