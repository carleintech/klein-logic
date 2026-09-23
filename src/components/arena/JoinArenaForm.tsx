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
import { ensureKleinLogicSession } from "../../lib/supabase/anonymous-session";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { LogicButton, LogicPanel, logicButtonClass } from "../logic/LogicPrimitives";

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
      await ensureKleinLogicSession(supabase.auth);
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
    <LogicPanel>
    <form
      onSubmit={handleSubmit}
      className="p-5 sm:p-8"
    >
      <div>
        <label
          htmlFor="arena-join-code"
          className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-logic-secondary"
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
          className="logic-input mt-3 min-h-16 px-4 text-center font-mono text-3xl font-black tracking-[0.28em] placeholder:text-text-muted sm:text-4xl"
          placeholder="K7M4Q2"
        />
        <p id="arena-code-help" className="mt-2 text-xs text-text-muted">
          Enter the six-character code shared by the host.
        </p>
      </div>

      <div className="mt-6">
        <label
          htmlFor="arena-display-name"
          className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-logic-secondary"
        >
          Display name
        </label>
        <input
          id="arena-display-name"
          name="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          autoComplete="nickname"
          className="logic-input mt-3 px-4 py-3 text-base placeholder:text-text-muted"
          placeholder="Your Arena name"
        />
      </div>

      <LogicButton
        type="submit"
        disabled={pending}
        variant="arena"
        size="large"
        className="mt-7 w-full"
      >
        {pending ? "Joining Arena…" : "Join Arena"}
      </LogicButton>

      <p
        aria-live="polite"
        className="mt-4 min-h-5 text-sm leading-5 text-state-danger"
      >
        {message}
      </p>

      <Link
        href="/arena"
        className={logicButtonClass({ variant: "ghost", size: "compact", className: "mt-2" })}
      >
        ← Back to Arena
      </Link>
    </form>
    </LogicPanel>
  );
}
