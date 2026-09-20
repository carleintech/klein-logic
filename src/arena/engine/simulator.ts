import type {
  ArenaResponse,
  SimulatedPlayerProfile,
  TournamentState,
} from "../types";

function hashSeed(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function seededValue(value: string): number {
  let state = hashSeed(value) + 0x6d2b79f5;
  state = Math.imul(state ^ (state >>> 15), state | 1);
  state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
  return ((state ^ (state >>> 14)) >>> 0) / 4_294_967_296;
}

export function createSimulatedProfiles(
  state: TournamentState,
): SimulatedPlayerProfile[] {
  return state.players.map((player) => ({
    playerId: player.id,
    accuracy: 0.68 + seededValue(`${state.seed}:accuracy:${player.id}`) * 0.29,
    speed: 0.5 + seededValue(`${state.seed}:speed:${player.id}`) * 0.49,
  }));
}

export function simulateRoundResponses(
  state: TournamentState,
  profiles: SimulatedPlayerProfile[],
): ArenaResponse[] {
  if (state.status !== "round" || !state.currentChallenge) {
    throw new Error("Simulator requires an active tournament round.");
  }

  const round = state.preset.rounds[state.roundIndex];
  const profilesById = new Map(
    profiles.map((profile) => [profile.playerId, profile]),
  );

  return state.players
    .filter((player) => player.status === "active")
    .map((player) => {
      const profile = profilesById.get(player.id);

      if (!profile) {
        throw new Error(`Missing simulator profile for ${player.id}.`);
      }

      const correctnessRoll = seededValue(
        `${state.seed}:correct:${round.number}:${player.id}`,
      );
      const difficultyPenalty = Math.max(0, round.difficultyRound - 1) * 0.018;
      const correct = correctnessRoll < Math.max(0.35, profile.accuracy - difficultyPenalty);
      const responseRoll = seededValue(
        `${state.seed}:response:${round.number}:${player.id}`,
      );
      const didNotAnswer =
        !correct &&
        seededValue(`${state.seed}:timeout:${round.number}:${player.id}`) > 0.9;
      const rawResponseMs =
        450 +
        (1 - profile.speed) * 1_900 +
        round.difficultyRound * 65 +
        responseRoll * 650;

      return {
        playerId: player.id,
        roundNumber: round.number,
        correct,
        responseMs: didNotAnswer ? null : Math.round(rawResponseMs / 10) * 10,
      };
    });
}
