"use client";

import { useEffect, useState } from "react";

import { ensureKleinLogicSession } from "../../lib/supabase/anonymous-session";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

type VerificationState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "verified";
      authentication: string;
      subjectId: string;
      reused: boolean;
    };

export function AnonymousIdentityVerification() {
  const [state, setState] = useState<VerificationState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function verifyIdentity() {
      try {
        const supabase = createSupabaseBrowserClient();
        const browserSession = await ensureKleinLogicSession(supabase.auth);
        const response = await fetch("/api/dev/arena-identity", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) {
          throw new Error(`Server identity verification failed (${response.status}).`);
        }

        const serverIdentity = (await response.json()) as {
          authentication: string;
          subjectId: string;
        };

        if (serverIdentity.subjectId !== browserSession.subjectId) {
          throw new Error("Browser and server identity subjects do not match.");
        }

        if (active) {
          setState({
            status: "verified",
            authentication: serverIdentity.authentication,
            subjectId: serverIdentity.subjectId,
            reused: !browserSession.created,
          });
        }
      } catch (error) {
        if (active) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Anonymous identity verification failed.",
          });
        }
      }
    }

    void verifyIdentity();

    return () => {
      active = false;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-300">
        Establishing an anonymous authenticated session…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-red-100">
        <p className="font-semibold">Identity verification failed</p>
        <p className="mt-2 text-sm text-red-200/80">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-6">
      <div className="flex items-center gap-3 text-emerald-200">
        <span aria-hidden="true" className="text-xl">✓</span>
        <p className="font-semibold">Browser and server identity verified</p>
      </div>
      <dl className="mt-6 grid gap-4 text-sm">
        <div>
          <dt className="text-slate-400">Authentication</dt>
          <dd className="mt-1 capitalize text-white">{state.authentication}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Subject ID</dt>
          <dd className="mt-1 break-all font-mono text-white">{state.subjectId}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Session behavior</dt>
          <dd className="mt-1 text-white">
            {state.reused ? "Existing session reused" : "Anonymous session created"}
          </dd>
        </div>
      </dl>
      <p className="mt-6 text-xs leading-5 text-slate-400">
        No access token, refresh token, or provider metadata is displayed.
      </p>
    </div>
  );
}
