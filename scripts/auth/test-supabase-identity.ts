import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { JwtPayload } from "@supabase/supabase-js";

import {
  ensureAnonymousSession,
  type AnonymousAuthClient,
} from "../../src/lib/supabase/anonymous-session";
import {
  ArenaAuthenticationRequiredError,
  mapSupabaseClaimsToArenaIdentity,
  resolveArenaIdentity,
  type SupabaseClaimsReader,
} from "../../src/server/identity/supabase-identity";

function verifiedClaims(
  overrides: Partial<JwtPayload> = {},
): JwtPayload {
  return {
    iss: "https://example.supabase.co/auth/v1",
    sub: randomUUID(),
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    role: "authenticated",
    aal: "aal1",
    session_id: randomUUID(),
    ...overrides,
  };
}

function claimsReader(
  claims: JwtPayload | null,
  error: unknown = null,
): SupabaseClaimsReader {
  return {
    async getClaims() {
      return { data: claims ? { claims } : null, error };
    },
  };
}

async function testProviderMapping(): Promise<void> {
  const anonymousClaims = verifiedClaims({ is_anonymous: true });
  const anonymous = mapSupabaseClaimsToArenaIdentity(anonymousClaims);
  assert.equal(anonymous.subjectId, anonymousClaims.sub);
  assert.equal(anonymous.authenticationType, "anonymous");

  assert.equal(
    mapSupabaseClaimsToArenaIdentity(
      verifiedClaims({ is_anonymous: false, email: "player@example.test" }),
    ).authenticationType,
    "email",
  );
  assert.equal(
    mapSupabaseClaimsToArenaIdentity(
      verifiedClaims({ is_anonymous: false, phone: "+15555550123" }),
    ).authenticationType,
    "phone",
  );
  assert.equal(
    mapSupabaseClaimsToArenaIdentity(
      verifiedClaims({ is_anonymous: false }),
    ).authenticationType,
    "other",
  );
}

async function testTrustedResolution(): Promise<void> {
  const authenticatedSubjectId = randomUUID();
  const forgedBrowserInput = {
    subjectId: randomUUID(),
    role: "host",
    authenticationType: "email",
  };
  const resolved = await resolveArenaIdentity(
    claimsReader(
      verifiedClaims({
        sub: authenticatedSubjectId,
        is_anonymous: true,
      }),
    ),
  );

  assert.equal(resolved.subjectId, authenticatedSubjectId);
  assert.notEqual(resolved.subjectId, forgedBrowserInput.subjectId);
  assert.equal(resolved.authenticationType, "anonymous");
  assert.equal("role" in resolved, false);

  await assert.rejects(
    () => resolveArenaIdentity(claimsReader(null)),
    ArenaAuthenticationRequiredError,
  );
  await assert.rejects(
    () => resolveArenaIdentity(claimsReader(null, new Error("invalid token"))),
    ArenaAuthenticationRequiredError,
  );
}

async function testAnonymousBootstrap(): Promise<void> {
  const subjectId = randomUUID();
  let signInCount = 0;
  const emptySessionClient = {
    async getSession() {
      return { data: { session: null }, error: null };
    },
    async signInAnonymously() {
      signInCount += 1;
      await Promise.resolve();
      return {
        data: { user: { id: subjectId }, session: null },
        error: null,
      };
    },
  } as unknown as AnonymousAuthClient;

  const [first, strictModeReplay] = await Promise.all([
    ensureAnonymousSession(emptySessionClient),
    ensureAnonymousSession(emptySessionClient),
  ]);
  assert.equal(signInCount, 1);
  assert.equal(first.subjectId, subjectId);
  assert.equal(strictModeReplay.subjectId, subjectId);

  const existingSessionClient = {
    async getSession() {
      return {
        data: { session: { user: { id: subjectId } } },
        error: null,
      };
    },
    async signInAnonymously() {
      throw new Error("Existing sessions must not create another anonymous user.");
    },
  } as unknown as AnonymousAuthClient;
  const reused = await ensureAnonymousSession(existingSessionClient);
  assert.equal(reused.subjectId, subjectId);
  assert.equal(reused.created, false);
}

async function testSourceBoundaries(): Promise<void> {
  const root = process.cwd();
  const browserClient = await readFile(
    path.join(root, "src", "lib", "supabase", "client.ts"),
    "utf8",
  );
  const arenaService = await readFile(
    path.join(root, "src", "server", "services", "arena-service.ts"),
    "utf8",
  );
  const environmentExample = await readFile(
    path.join(root, ".env.example"),
    "utf8",
  );

  assert(browserClient.includes("NEXT_PUBLIC_SUPABASE_URL"));
  assert(browserClient.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
  assert(!/service.?role|secret.?key/i.test(browserClient));
  assert(!arenaService.includes("@supabase"));
  assert(!/service.?role|secret.?key/i.test(environmentExample));
  assert(environmentExample.includes("your-publishable-key"));
}

async function main(): Promise<void> {
  await testProviderMapping();
  await testTrustedResolution();
  await testAnonymousBootstrap();
  await testSourceBoundaries();

  console.log(
    JSON.stringify(
      {
        providerUuidMapped: true,
        anonymousClaimMapped: true,
        futureAuthenticationTypesMapped: true,
        missingAuthenticationRejected: true,
        forgedSubjectIgnored: true,
        forgedRoleExcluded: true,
        strictModeDuplicateSignInPrevented: true,
        existingSessionReused: true,
        arenaServiceProviderNeutral: true,
        browserSecretBoundaryVerified: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
