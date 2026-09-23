import { NextResponse } from "next/server";

import {
  ArenaAuthenticationRequiredError,
  requireArenaIdentity,
} from "@/server/identity/supabase-identity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireArenaIdentity();

    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof ArenaAuthenticationRequiredError) {
      return new NextResponse(null, {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    throw error;
  }
}
