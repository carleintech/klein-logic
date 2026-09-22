"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createArenaLobbyAction } from "../../app/arena/actions";
import { lobbyErrorMessage } from "../../arena/lobby-ui";
import { ensureAnonymousSession } from "../../lib/supabase/anonymous-session";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export default function CreateArenaButton() {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreate() {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setPending(true);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      await ensureAnonymousSession(supabase.auth);
      const result = await createArenaLobbyAction();

      if (!result.ok) {
        setMessage(lobbyErrorMessage(result.error.code));
        return;
      }

      router.push(`/arena/lobby/${result.data.joinCode}`);
    } catch {
      setMessage(lobbyErrorMessage("session-error"));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCreate}
        disabled={pending}
        className="min-h-14 w-full border border-cyan-300 bg-cyan-300 px-6 py-4 font-mono text-xs font-black uppercase tracking-[0.2em] text-black outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#071019] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Creating Arena…" : "Create Arena"}
      </button>
      <p
        aria-live="polite"
        className="mt-3 min-h-5 text-sm leading-5 text-rose-200"
      >
        {message}
      </p>
    </div>
  );
}
