import { NextResponse } from "next/server";

import type { PublicLobbyView } from "../../../../../server/arena/lobby";
import {
  lobbyErrorHttpStatus,
  runLobbyOperation,
} from "../../../../../server/arena/lobby-boundary";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ joinCode: string }> },
) {
  const { joinCode } = await params;
  const result = await runLobbyOperation<PublicLobbyView>((service, identity) =>
    service.getLobby(identity, joinCode),
  );

  return NextResponse.json(result, {
    status: result.ok ? 200 : lobbyErrorHttpStatus(result.error.code),
    headers: { "Cache-Control": "private, no-store" },
  });
}
