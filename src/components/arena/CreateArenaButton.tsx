"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createArenaLobbyAction } from "../../app/arena/actions";
import { lobbyErrorMessage } from "../../arena/lobby-ui";
import { ensureAnonymousSession } from "../../lib/supabase/anonymous-session";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { LogicButton } from "../logic/LogicPrimitives";

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
      <LogicButton
        type="button"
        onClick={handleCreate}
        disabled={pending}
        variant="arena"
        size="large"
        className="w-full"
      >
        {pending ? "Creating Arena…" : "Create Arena"}
      </LogicButton>
      <p
        aria-live="polite"
        className="mt-3 min-h-5 text-sm leading-5 text-state-danger"
      >
        {message}
      </p>
    </div>
  );
}
