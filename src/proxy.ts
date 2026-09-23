import type { NextRequest } from "next/server";

import { updateSupabaseSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/play/:path*",
    "/arena/:path*",
    "/api/auth/:path*",
    "/api/arena/:path*",
    "/api/dev/arena-identity/:path*",
  ],
};
