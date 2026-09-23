import type { SupabaseClient } from "@supabase/supabase-js";

export type AnonymousAuthClient = Pick<
  SupabaseClient["auth"],
  | "getSession"
  | "getUser"
  | "refreshSession"
  | "signInAnonymously"
  | "signOut"
>;

export type BrowserArenaSession = {
  subjectId: string;
  created: boolean;
};

export type KleinLogicSessionVerifier = () => Promise<boolean>;

let anonymousBootstrapPromise: Promise<BrowserArenaSession> | null = null;

async function verifyTrustedServerSession(): Promise<boolean> {
  const response = await fetch("/api/auth/session", {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (response.ok) {
    return true;
  }

  if (response.status === 401) {
    return false;
  }

  throw new Error(`Session verification failed (${response.status}).`);
}

async function createAnonymousSession(
  auth: AnonymousAuthClient,
): Promise<BrowserArenaSession> {
  const { data, error } = await auth.signInAnonymously();

  if (error) {
    throw new Error(`Anonymous authentication failed: ${error.message}`);
  }

  if (!data.user?.id) {
    throw new Error("Anonymous authentication returned no user.");
  }

  return { subjectId: data.user.id, created: true };
}

async function verifyBrowserUser(
  auth: AnonymousAuthClient,
  expectedSubjectId: string,
): Promise<void> {
  const { data, error } = await auth.getUser();

  if (error || data.user?.id !== expectedSubjectId) {
    throw new Error("The browser authentication session could not be verified.");
  }
}

export async function ensureKleinLogicSession(
  auth: AnonymousAuthClient,
  verifyServerSession: KleinLogicSessionVerifier = verifyTrustedServerSession,
): Promise<BrowserArenaSession> {
  anonymousBootstrapPromise ??= (async () => {
    const existing = await auth.getSession();

    if (existing.error) {
      throw new Error(
        `Unable to read the authentication session: ${existing.error.message}`,
      );
    }

    let browserSession: BrowserArenaSession;
    const existingSubjectId = existing.data.session?.user.id;

    if (existingSubjectId) {
      const verifiedUser = await auth.getUser();

      if (!verifiedUser.error && verifiedUser.data.user?.id === existingSubjectId) {
        browserSession = { subjectId: existingSubjectId, created: false };
      } else {
        const refreshed = await auth.refreshSession();
        const refreshedSubjectId = refreshed.data.user?.id;

        if (!refreshed.error && refreshedSubjectId === existingSubjectId) {
          await verifyBrowserUser(auth, existingSubjectId);
          browserSession = { subjectId: existingSubjectId, created: false };
        } else {
          const { error: signOutError } = await auth.signOut({ scope: "local" });

          if (signOutError) {
            throw new Error(
              `Unable to clear the invalid authentication session: ${signOutError.message}`,
            );
          }

          browserSession = await createAnonymousSession(auth);
        }
      }
    } else {
      browserSession = await createAnonymousSession(auth);
    }

    await verifyBrowserUser(auth, browserSession.subjectId);

    if (await verifyServerSession()) {
      return browserSession;
    }

    const refreshed = await auth.refreshSession();
    const refreshedSubjectId = refreshed.data.user?.id;

    if (refreshed.error || refreshedSubjectId !== browserSession.subjectId) {
      throw new Error("The trusted server could not verify the browser session.");
    }

    await verifyBrowserUser(auth, browserSession.subjectId);

    if (!(await verifyServerSession())) {
      throw new Error("The trusted server could not verify the browser session.");
    }

    return browserSession;
  })()
    .finally(() => {
      anonymousBootstrapPromise = null;
    });

  return anonymousBootstrapPromise;
}

export const ensureAnonymousSession = ensureKleinLogicSession;
