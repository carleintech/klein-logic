"use client";

import {
  createLocalOnlyArenaChallengeBoundary,
  validateLocalOnlyArenaAnswer,
} from "@/arena/challenges/sumroll-adapter";
import type { ArenaResponse, TournamentState } from "@/arena/types";

import {
  ArenaHumanChallenge,
  type ArenaPublicSubmission,
} from "./ArenaPlayerRound";

export default function ArenaLocalPlayerRound({
  tournament,
  onResponse,
}: {
  tournament: TournamentState;
  onResponse: (response: ArenaResponse) => void;
}) {
  const serverChallenge = tournament.currentChallenge;
  const round = tournament.preset.rounds[tournament.roundIndex];
  const human = tournament.players.find(
    (player) => player.participantType === "human" && player.status === "active",
  );

  if (!serverChallenge || !human) {
    return null;
  }

  const boundary = createLocalOnlyArenaChallengeBoundary(serverChallenge);
  const humanPlayerId = human.id;

  function handleLocalOnlySubmission(submission: ArenaPublicSubmission) {
    const correct = submission.answer
      ? validateLocalOnlyArenaAnswer(
          boundary.serverChallenge,
          submission.answer,
        ).correct
      : false;

    onResponse({
      playerId: humanPlayerId,
      roundNumber: round.number,
      correct,
      responseMs: submission.responseMs,
    });
  }

  return (
    <ArenaHumanChallenge
      challenge={boundary.publicChallenge}
      roundLabel={round.label}
      responseWindowMs={round.responseWindowMs}
      onSubmit={handleLocalOnlySubmission}
    />
  );
}
