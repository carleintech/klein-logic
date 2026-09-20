import { generateChallenge } from "../../game/sumroll/engine";

import type {
  ArenaPlayer,
  ArenaResponse,
  CreateTournamentOptions,
  TournamentPreset,
  TournamentState,
} from "../types";
import { createRoundResult, eliminatePlayers } from "./elimination";
import { rankArenaResponses } from "./ranking";

function hashSeed(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function assertPresetIsValid(preset: TournamentPreset): void {
  if (preset.playerCount < 2 || preset.rounds.length === 0) {
    throw new Error("A tournament needs at least two players and one round.");
  }

  preset.rounds.forEach((round, index) => {
    const expectedStartingPlayers =
      index === 0
        ? preset.playerCount
        : preset.rounds[index - 1].advancingPlayers;

    if (
      round.number !== index + 1 ||
      round.startingPlayers !== expectedStartingPlayers ||
      round.advancingPlayers < 1 ||
      round.advancingPlayers >= round.startingPlayers
    ) {
      throw new Error(`Invalid tournament progression at round ${round.number}.`);
    }
  });

  if (preset.rounds.at(-1)?.advancingPlayers !== 1) {
    throw new Error("The final tournament round must advance one champion.");
  }
}

function createPlayers(
  count: number,
  seed: string,
  options: CreateTournamentOptions,
): ArenaPlayer[] {
  const hasHuman = options.participationMode === "player";
  const simulatedCount = hasHuman ? count - 1 : count;
  const players: ArenaPlayer[] = Array.from(
    { length: simulatedCount },
    (_, index) => {
    const number = index + 1;
    const id = `player-${number.toString().padStart(2, "0")}`;

    return {
      id,
      displayName: `Player ${number.toString().padStart(2, "0")}`,
      participantType: "simulated",
      status: "active",
      eliminatedRound: null,
      finalPlacement: null,
      tieBreak: hashSeed(`${seed}:tie:${id}`),
      };
    },
  );

  if (hasHuman) {
    const humanPlayer = options.humanPlayer ?? {
      id: "human-player",
      displayName: "YOU",
    };

    players.push({
      id: humanPlayer.id,
      displayName: humanPlayer.displayName,
      participantType: "human",
      status: "active",
      eliminatedRound: null,
      finalPlacement: null,
      tieBreak: hashSeed(`${seed}:tie:${humanPlayer.id}`),
    });
  }

  return players;
}

export function createTournament(
  preset: TournamentPreset,
  seed: string,
  options: CreateTournamentOptions = {},
): TournamentState {
  assertPresetIsValid(preset);
  const normalizedSeed = seed.trim() || "ABC123";
  const participationMode = options.participationMode ?? "simulation";

  return {
    tournamentId: `${preset.id}-${hashSeed(normalizedSeed).toString(16)}`,
    seed: normalizedSeed,
    participationMode,
    preset,
    status: "landing",
    roundIndex: 0,
    players: createPlayers(preset.playerCount, normalizedSeed, {
      ...options,
      participationMode,
    }),
    responses: [],
    currentChallenge: null,
    roundHistory: [],
  };
}

export function enterTournamentLobby(state: TournamentState): TournamentState {
  if (state.status !== "landing") {
    throw new Error("Only a landing tournament can enter the lobby.");
  }

  return { ...state, status: "lobby" };
}

export function startTournament(state: TournamentState): TournamentState {
  if (state.status !== "lobby") {
    throw new Error("Only a lobby tournament can be started.");
  }

  return { ...state, status: "countdown" };
}

export function beginTournamentRound(state: TournamentState): TournamentState {
  if (state.status !== "countdown") {
    throw new Error("A round can only begin after its countdown.");
  }

  const round = state.preset.rounds[state.roundIndex];

  if (!round) {
    throw new Error("Tournament round configuration is missing.");
  }

  const activePlayers = state.players.filter((player) => player.status === "active");

  if (activePlayers.length !== round.startingPlayers) {
    throw new Error("Active player count does not match the tournament preset.");
  }

  return {
    ...state,
    status: "round",
    currentChallenge: generateChallenge(round.challengeType, {
      round: round.difficultyRound,
      runSeed: hashSeed(`${state.seed}:challenge:${round.number}`),
    }),
  };
}

function assertResponsesAreValid(
  state: TournamentState,
  responses: ArenaResponse[],
): void {
  const round = state.preset.rounds[state.roundIndex];
  const activeIds = new Set(
    state.players
      .filter((player) => player.status === "active")
      .map((player) => player.id),
  );
  const responseIds = new Set(responses.map((response) => response.playerId));

  if (
    !round ||
    responses.length !== activeIds.size ||
    responseIds.size !== activeIds.size ||
    responses.some(
      (response) =>
        response.roundNumber !== round.number || !activeIds.has(response.playerId),
    )
  ) {
    throw new Error("Round responses must contain one response per active player.");
  }
}

export function resolveTournamentRound(
  state: TournamentState,
  responses: ArenaResponse[],
): TournamentState {
  if (state.status !== "round" || !state.currentChallenge) {
    throw new Error("Only an active round can be resolved.");
  }

  assertResponsesAreValid(state, responses);
  const round = state.preset.rounds[state.roundIndex];
  const activePlayers = state.players.filter((player) => player.status === "active");
  const rankings = rankArenaResponses(
    activePlayers,
    responses,
    round.advancingPlayers,
  );
  const elimination = eliminatePlayers(state.players, rankings, round.number);
  const result = createRoundResult(
    rankings,
    state.currentChallenge.id,
    round.startingPlayers,
    round.advancingPlayers,
    elimination.eliminatedPlayerIds,
  );

  return {
    ...state,
    status: "round-results",
    players: elimination.players,
    responses: [...state.responses, ...responses],
    roundHistory: [...state.roundHistory, result],
  };
}

export function advanceTournament(state: TournamentState): TournamentState {
  if (state.status !== "round-results") {
    throw new Error("Tournament can only advance from round results.");
  }

  const isFinalRound = state.roundIndex === state.preset.rounds.length - 1;

  if (isFinalRound) {
    const finalists = state.players.filter((player) => player.status === "active");

    if (finalists.length !== 1) {
      throw new Error("The final round must produce exactly one champion.");
    }

    return {
      ...state,
      status: "completed",
      players: state.players.map((player) =>
        player.id === finalists[0].id
          ? { ...player, status: "champion" as const, finalPlacement: 1 }
          : player,
      ),
    };
  }

  return {
    ...state,
    status: "countdown",
    roundIndex: state.roundIndex + 1,
    currentChallenge: null,
  };
}
