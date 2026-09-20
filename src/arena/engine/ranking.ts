import type {
  ArenaPlayer,
  ArenaResponse,
  RankedArenaResponse,
} from "../types";

const NO_RESPONSE_TIME = Number.MAX_SAFE_INTEGER;

export function rankArenaResponses(
  players: ArenaPlayer[],
  responses: ArenaResponse[],
  advancingPlayers: number,
): RankedArenaResponse[] {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const ranked = [...responses].sort((left, right) => {
    if (left.correct !== right.correct) {
      return left.correct ? -1 : 1;
    }

    const responseDifference =
      (left.responseMs ?? NO_RESPONSE_TIME) -
      (right.responseMs ?? NO_RESPONSE_TIME);

    if (responseDifference !== 0) {
      return responseDifference;
    }

    const tieBreakDifference =
      (playersById.get(left.playerId)?.tieBreak ?? NO_RESPONSE_TIME) -
      (playersById.get(right.playerId)?.tieBreak ?? NO_RESPONSE_TIME);

    if (tieBreakDifference !== 0) {
      return tieBreakDifference;
    }

    return left.playerId.localeCompare(right.playerId);
  });

  return ranked.map((response, index) => ({
    ...response,
    rank: index + 1,
    advanced: index < advancingPlayers,
    tieBreak: playersById.get(response.playerId)?.tieBreak ?? 0,
  }));
}
