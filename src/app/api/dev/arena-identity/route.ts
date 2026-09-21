import { NextResponse } from "next/server";

import {
  ArenaAuthenticationRequiredError,
  requireArenaIdentity,
} from "../../../../server/identity/supabase-identity";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const identity = await requireArenaIdentity();

    return NextResponse.json(
      {
        authentication: identity.authenticationType,
        subjectId: identity.subjectId,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof ArenaAuthenticationRequiredError) {
      return NextResponse.json(
        { error: "Authentication required." },
        {
          status: 401,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }

    throw error;
  }
}
