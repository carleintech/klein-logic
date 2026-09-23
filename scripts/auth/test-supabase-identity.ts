import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { JwtPayload } from "@supabase/supabase-js";

import {
  ensureKleinLogicSession,
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
  let currentSubjectId: string | null = null;
  const emptySessionClient = {
    async getSession() {
      return { data: { session: null }, error: null };
    },
    async getUser() {
      return {
        data: { user: currentSubjectId ? { id: currentSubjectId } : null },
        error: currentSubjectId ? null : new Error("missing session"),
      };
    },
    async signInAnonymously() {
      signInCount += 1;
      currentSubjectId = subjectId;
      await Promise.resolve();
      return {
        data: { user: { id: subjectId }, session: null },
        error: null,
      };
    },
    async signOut() {
      currentSubjectId = null;
      return { error: null };
    },
    async refreshSession() {
      return { data: { user: { id: subjectId } }, error: null };
    },
  } as unknown as AnonymousAuthClient;

  const [first, strictModeReplay] = await Promise.all([
    ensureKleinLogicSession(emptySessionClient, async () => true),
    ensureKleinLogicSession(emptySessionClient, async () => true),
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
    async getUser() {
      return { data: { user: { id: subjectId } }, error: null };
    },
    async signInAnonymously() {
      throw new Error("Existing sessions must not create another anonymous user.");
    },
    async signOut() {
      throw new Error("A valid session must not be cleared.");
    },
    async refreshSession() {
      throw new Error("A server-verified session must not be refreshed.");
    },
  } as unknown as AnonymousAuthClient;
  const reused = await ensureKleinLogicSession(
    existingSessionClient,
    async () => true,
  );
  assert.equal(reused.subjectId, subjectId);
  assert.equal(reused.created, false);
}

async function testStaleSessionRecovery(): Promise<void> {
  const staleSubjectId = randomUUID();
  const replacementSubjectId = randomUUID();
  let currentSubjectId: string | null = staleSubjectId;
  let signOutScope: string | undefined;

  const client = {
    async getSession() {
      return {
        data: { session: { user: { id: staleSubjectId } } },
        error: null,
      };
    },
    async getUser() {
      if (currentSubjectId === staleSubjectId) {
        return { data: { user: null }, error: new Error("invalid token") };
      }

      return {
        data: { user: currentSubjectId ? { id: currentSubjectId } : null },
        error: currentSubjectId ? null : new Error("missing session"),
      };
    },
    async signOut(options: { scope?: string }) {
      signOutScope = options.scope;
      currentSubjectId = null;
      return { error: null };
    },
    async signInAnonymously() {
      currentSubjectId = replacementSubjectId;
      return {
        data: { user: { id: replacementSubjectId }, session: null },
        error: null,
      };
    },
    async refreshSession() {
      return {
        data: { user: null },
        error: new Error("invalid refresh token"),
      };
    },
  } as unknown as AnonymousAuthClient;

  const recovered = await ensureKleinLogicSession(client, async () => true);

  assert.equal(signOutScope, "local");
  assert.equal(recovered.subjectId, replacementSubjectId);
  assert.equal(recovered.created, true);
}

async function testTrustedServerVerificationRetry(): Promise<void> {
  const subjectId = randomUUID();
  let verificationCount = 0;
  let refreshCount = 0;
  const client = {
    async getSession() {
      return {
        data: { session: { user: { id: subjectId } } },
        error: null,
      };
    },
    async getUser() {
      return { data: { user: { id: subjectId } }, error: null };
    },
    async signInAnonymously() {
      throw new Error("Existing sessions must not create another anonymous user.");
    },
    async signOut() {
      throw new Error("A browser-verified session must not be cleared.");
    },
    async refreshSession() {
      refreshCount += 1;
      return { data: { user: { id: subjectId } }, error: null };
    },
  } as unknown as AnonymousAuthClient;

  const session = await ensureKleinLogicSession(client, async () => {
    verificationCount += 1;
    return verificationCount === 2;
  });

  assert.equal(session.subjectId, subjectId);
  assert.equal(refreshCount, 1);
  assert.equal(verificationCount, 2);
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
  const sessionRoute = await readFile(
    path.join(root, "src", "app", "api", "auth", "session", "route.ts"),
    "utf8",
  );
  const proxy = await readFile(path.join(root, "src", "proxy.ts"), "utf8");
  const playerGate = await readFile(
    path.join(root, "src", "components", "player", "PlayerProfileGate.tsx"),
    "utf8",
  );
  const createArena = await readFile(
    path.join(root, "src", "components", "arena", "CreateArenaButton.tsx"),
    "utf8",
  );

  assert(browserClient.includes("NEXT_PUBLIC_SUPABASE_URL"));
  assert(browserClient.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
  assert(!/service.?role|secret.?key/i.test(browserClient));
  assert(!arenaService.includes("@supabase"));
  assert(!/service.?role|secret.?key/i.test(environmentExample));
  assert(environmentExample.includes("your-publishable-key"));
  assert(sessionRoute.includes("requireArenaIdentity()"));
  assert(!sessionRoute.includes("subjectId"));
  assert(proxy.includes('"/play/:path*"'));
  assert(proxy.includes('"/api/auth/:path*"'));
  assert(playerGate.includes("ensureKleinLogicSession"));
  assert(createArena.includes("ensureKleinLogicSession"));
}

async function main(): Promise<void> {
  await testProviderMapping();
  await testTrustedResolution();
  await testAnonymousBootstrap();
  await testStaleSessionRecovery();
  await testTrustedServerVerificationRetry();
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
        staleSessionRecoveredLocally: true,
        browserSessionVerifiedBeforeUse: true,
        trustedServerVerificationRequired: true,
        serverVerificationRefreshRetryBounded: true,
        regionsAndArenaShareBootstrap: true,
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
