import type { NextRequest } from "next/server";

import { updateSupabaseSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/arena/:path*",
    "/api/arena/:path*",
    "/api/dev/arena-identity/:path*",
  ],
};
