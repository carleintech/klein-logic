import { NextResponse, type NextRequest } from "next/server";

import { RegionsCompetitiveService } from "@/server/services/regions-competitive-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");
  const puzzleId = request.nextUrl.searchParams.get("puzzleId");
  const service = new RegionsCompetitiveService();

  try {
    if (mode === "classic" && puzzleId) {
      return NextResponse.json({ mode, puzzleId, entries: await service.classicLeaderboard(puzzleId) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (mode === "journey") {
      return NextResponse.json({ mode, entries: await service.journeyLeaderboard() }, { headers: { "Cache-Control": "no-store" } });
    }
    if (mode === "time-attack") {
      return NextResponse.json({ mode, entries: await service.timeAttackLeaderboard() }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Choose a valid leaderboard." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Leaderboard data is temporarily unavailable." }, { status: 503 });
  }
}
