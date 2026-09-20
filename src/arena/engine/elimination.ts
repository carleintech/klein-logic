import type {
  ArenaPlayer,
  ArenaRoundResult,
  RankedArenaResponse,
} from "../types";

export function eliminatePlayers(
  players: ArenaPlayer[],
  rankings: RankedArenaResponse[],
  roundNumber: number,
): { players: ArenaPlayer[]; eliminatedPlayerIds: string[] } {
  const advancingIds = new Set(
    rankings.filter((response) => response.advanced).map((response) => response.playerId),
  );
  const placementById = new Map(
    rankings.map((response) => [response.playerId, response.rank]),
  );
  const eliminatedPlayerIds: string[] = [];
  const updatedPlayers = players.map((player) => {
    if (player.status !== "active" || advancingIds.has(player.id)) {
      return player;
    }

    eliminatedPlayerIds.push(player.id);
    return {
      ...player,
      status: "eliminated" as const,
      eliminatedRound: roundNumber,
      finalPlacement: placementById.get(player.id) ?? null,
    };
  });

  return { players: updatedPlayers, eliminatedPlayerIds };
}

export function createRoundResult(
  rankings: RankedArenaResponse[],
  challengeId: string,
  startingPlayers: number,
  advancingPlayers: number,
  eliminatedPlayerIds: string[],
): ArenaRoundResult {
  return {
    roundNumber: rankings[0]?.roundNumber ?? 0,
    challengeId,
    startingPlayers,
    advancingPlayers,
    correctPlayers: rankings.filter((response) => response.correct).length,
    incorrectPlayers: rankings.filter((response) => !response.correct).length,
    eliminatedPlayerIds,
    rankings,
  };
}
