"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { joinArenaLobbyAction } from "../../app/arena/actions";
import {
  lobbyErrorMessage,
  normalizeJoinCodeForUi,
  validateDisplayNameForUi,
} from "../../arena/lobby-ui";
import { ensureAnonymousSession } from "../../lib/supabase/anonymous-session";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export default function JoinArenaForm({
  initialJoinCode = "",
}: {
  initialJoinCode?: string;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [joinCode, setJoinCode] = useState(() =>
    normalizeJoinCodeForUi(initialJoinCode),
  );
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (inFlight.current) {
      return;
    }

    if (joinCode.length !== 6) {
      setMessage(lobbyErrorMessage("invalid-join-code"));
      return;
    }

    const displayNameError = validateDisplayNameForUi(displayName);
    if (displayNameError) {
      setMessage(displayNameError);
      return;
    }

    inFlight.current = true;
    setPending(true);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      await ensureAnonymousSession(supabase.auth);
      const result = await joinArenaLobbyAction({ joinCode, displayName });

      if (!result.ok) {
        setMessage(lobbyErrorMessage(result.error.code));
        return;
      }

      router.push(`/arena/lobby/${result.data.lobby.joinCode}`);
    } catch {
      setMessage(lobbyErrorMessage("session-error"));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-cyan-300/20 bg-[#081019]/90 p-5 shadow-2xl shadow-cyan-950/20 sm:p-8"
    >
      <div>
        <label
          htmlFor="arena-join-code"
          className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200"
        >
          Join code
        </label>
        <input
          id="arena-join-code"
          name="joinCode"
          value={joinCode}
          onChange={(event) =>
            setJoinCode(normalizeJoinCodeForUi(event.target.value))
          }
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          maxLength={6}
          spellCheck={false}
          aria-describedby="arena-code-help"
          className="mt-3 min-h-16 w-full border border-white/15 bg-black/30 px-4 text-center font-mono text-3xl font-black tracking-[0.36em] text-white outline-none transition placeholder:text-neutral-700 focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300 sm:text-4xl"
          placeholder="K7M4Q2"
        />
        <p id="arena-code-help" className="mt-2 text-xs text-neutral-500">
          Enter the six-character code shared by the host.
        </p>
      </div>

      <div className="mt-6">
        <label
          htmlFor="arena-display-name"
          className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200"
        >
          Display name
        </label>
        <input
          id="arena-display-name"
          name="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          autoComplete="nickname"
          className="mt-3 min-h-12 w-full border border-white/15 bg-black/30 px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-700 focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300"
          placeholder="Your Arena name"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-7 min-h-14 w-full border border-cyan-300 bg-cyan-300 px-6 py-4 font-mono text-xs font-black uppercase tracking-[0.2em] text-black outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#081019] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Joining Arena…" : "Join Arena"}
      </button>

      <p
        aria-live="polite"
        className="mt-4 min-h-5 text-sm leading-5 text-rose-200"
      >
        {message}
      </p>

      <Link
        href="/arena"
        className="mt-4 inline-flex min-h-11 items-center font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        ← Back to Arena
      </Link>
    </form>
  );
}
