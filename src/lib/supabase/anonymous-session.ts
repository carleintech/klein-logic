import type { SupabaseClient } from "@supabase/supabase-js";

export type AnonymousAuthClient = Pick<
  SupabaseClient["auth"],
  "getSession" | "signInAnonymously"
>;

export type BrowserArenaSession = {
  subjectId: string;
  created: boolean;
};

let anonymousBootstrapPromise: Promise<BrowserArenaSession> | null = null;

export async function ensureAnonymousSession(
  auth: AnonymousAuthClient,
): Promise<BrowserArenaSession> {
  const existing = await auth.getSession();

  if (existing.error) {
    throw new Error(`Unable to read the authentication session: ${existing.error.message}`);
  }

  if (existing.data.session?.user.id) {
    return {
      subjectId: existing.data.session.user.id,
      created: false,
    };
  }

  anonymousBootstrapPromise ??= auth
    .signInAnonymously()
    .then(({ data, error }) => {
      if (error) {
        throw new Error(`Anonymous authentication failed: ${error.message}`);
      }

      if (!data.user?.id) {
        throw new Error("Anonymous authentication returned no user.");
      }

      return { subjectId: data.user.id, created: true };
    })
    .finally(() => {
      anonymousBootstrapPromise = null;
    });

  return anonymousBootstrapPromise;
}
