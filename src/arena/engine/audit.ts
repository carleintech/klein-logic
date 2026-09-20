import type { TournamentAudit, TournamentPreset } from "../types";
import { createSimulatedProfiles, simulateRoundResponses } from "./simulator";
import {
  advanceTournament,
  beginTournamentRound,
  createTournament,
  enterTournamentLobby,
  resolveTournamentRound,
  startTournament,
} from "./tournament";

export function runTournamentAudit(
  preset: TournamentPreset,
  seed: string,
): TournamentAudit {
  let state = startTournament(
    enterTournamentLobby(createTournament(preset, seed)),
  );
  const profiles = createSimulatedProfiles(state);

  while (state.status !== "completed") {
    state = beginTournamentRound(state);
    const responses = simulateRoundResponses(state, profiles);
    state = resolveTournamentRound(state, responses);
    state = advanceTournament(state);
  }

  const champion = state.players.find((player) => player.status === "champion");

  if (!champion) {
    throw new Error("Tournament audit completed without a champion.");
  }

  return {
    seed: state.seed,
    tournamentId: state.tournamentId,
    championId: champion.id,
    championName: champion.displayName,
    rounds: state.roundHistory,
    finalState: state,
  };
}
