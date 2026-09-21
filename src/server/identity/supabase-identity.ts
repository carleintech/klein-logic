import "server-only";

import type { JwtPayload } from "@supabase/supabase-js";

import {
  createArenaIdentity,
  type ArenaAuthenticationType,
  type ArenaIdentity,
} from "../arena/identity";
import { createSupabaseServerClient } from "../../lib/supabase/server";

export class ArenaAuthenticationRequiredError extends Error {
  constructor(message = "An authenticated Arena identity is required.") {
    super(message);
    this.name = "ArenaAuthenticationRequiredError";
  }
}

export type SupabaseClaimsReader = {
  getClaims(): Promise<{
    data: { claims?: JwtPayload | null } | null;
    error: unknown;
  }>;
};

export function mapSupabaseAuthenticationType(
  claims: Pick<JwtPayload, "is_anonymous" | "email" | "phone">,
): ArenaAuthenticationType {
  if (claims.is_anonymous === true) {
    return "anonymous";
  }

  if (claims.email) {
    return "email";
  }

  if (claims.phone) {
    return "phone";
  }

  return "other";
}

export function mapSupabaseClaimsToArenaIdentity(
  claims: Pick<JwtPayload, "sub" | "is_anonymous" | "email" | "phone">,
): ArenaIdentity {
  return createArenaIdentity(
    claims.sub,
    mapSupabaseAuthenticationType(claims),
  );
}

export async function resolveArenaIdentity(
  claimsReader: SupabaseClaimsReader,
): Promise<ArenaIdentity> {
  const { data, error } = await claimsReader.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    throw new ArenaAuthenticationRequiredError();
  }

  return mapSupabaseClaimsToArenaIdentity(claims);
}

export async function requireArenaIdentity(): Promise<ArenaIdentity> {
  const supabase = await createSupabaseServerClient();

  return resolveArenaIdentity(supabase.auth);
}
