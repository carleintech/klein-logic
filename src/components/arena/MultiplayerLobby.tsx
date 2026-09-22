"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  cancelArenaLobbyAction,
  startArenaLobbyAction,
} from "../../app/arena/actions";
import {
  canManageLobby,
  lobbyErrorMessage,
  lobbyStatusLabel,
  type LobbyActionResult,
} from "../../arena/lobby-ui";
import type { PublicLobbyView } from "../../server/arena/lobby";
import { ensureAnonymousSession } from "../../lib/supabase/anonymous-session";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

const POLLING_INTERVAL_MS = 5_000;

type LobbyScreenState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; lobby: PublicLobbyView };

async function readLobby(
  joinCode: string,
  signal?: AbortSignal,
): Promise<LobbyActionResult<PublicLobbyView>> {
  const response = await fetch(
    `/api/arena/lobbies/${encodeURIComponent(joinCode)}`,
    {
      cache: "no-store",
      credentials: "same-origin",
      signal,
    },
  );

  return (await response.json()) as LobbyActionResult<PublicLobbyView>;
}

export default function MultiplayerLobby({ joinCode }: { joinCode: string }) {
  const [screen, setScreen] = useState<LobbyScreenState>({ status: "loading" });
  const [actionPending, setActionPending] = useState<
    "start" | "cancel" | null
  >(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const actionInFlight = useRef(false);
  const refreshInFlight = useRef(false);
  const sessionReady = useRef(false);
  const currentStatus = useRef<PublicLobbyView["status"] | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function refreshLobby(initial = false) {
      if (refreshInFlight.current || document.visibilityState === "hidden") {
        return;
      }

      refreshInFlight.current = true;

      try {
        const result = await readLobby(joinCode, controller.signal);
        if (!active) {
          return;
        }

        if (!result.ok) {
          setScreen({
            status: "error",
            message: lobbyErrorMessage(result.error.code),
          });
          return;
        }

        currentStatus.current = result.data.status;
        setScreen({ status: "ready", lobby: result.data });
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        if (initial) {
          setScreen({
            status: "error",
            message: lobbyErrorMessage("server-error"),
          });
        }
      } finally {
        refreshInFlight.current = false;
      }
    }

    async function initialize() {
      try {
        const supabase = createSupabaseBrowserClient();
        await ensureAnonymousSession(supabase.auth);
        sessionReady.current = true;
        await refreshLobby(true);
      } catch {
        if (active) {
          setScreen({
            status: "error",
            message: lobbyErrorMessage("session-error"),
          });
        }
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshLobby();
      }
    }

    void initialize();
    const timer = window.setInterval(() => {
      if (
        sessionReady.current &&
        (currentStatus.current === null || currentStatus.current === "lobby")
      ) {
        void refreshLobby();
      }
    }, POLLING_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [joinCode]);

  async function runHostAction(action: "start" | "cancel") {
    if (actionInFlight.current) {
      return;
    }

    actionInFlight.current = true;
    setActionPending(action);
    setActionMessage(null);

    try {
      const result =
        action === "start"
          ? await startArenaLobbyAction(joinCode)
          : await cancelArenaLobbyAction(joinCode);

      if (!result.ok) {
        setActionMessage(lobbyErrorMessage(result.error.code));
        return;
      }

      currentStatus.current = result.data.status;
      setScreen({ status: "ready", lobby: result.data });
      setConfirmCancel(false);
    } catch {
      setActionMessage(lobbyErrorMessage("server-error"));
    } finally {
      actionInFlight.current = false;
      setActionPending(null);
    }
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(successMessage);
    } catch {
      setCopyMessage("Copy failed. Select the code manually.");
    }
  }

  if (screen.status === "loading") {
    return (
      <section className="mx-auto flex min-h-[620px] max-w-4xl items-center justify-center">
        <div className="text-center" role="status">
          <div className="mx-auto h-3 w-3 rounded-full bg-cyan-200 shadow-[0_0_24px_rgba(103,232,249,0.95)] motion-safe:animate-pulse" />
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.28em] text-cyan-200">
            Resolving Arena
          </p>
        </div>
      </section>
    );
  }

  if (screen.status === "error") {
    return (
      <section className="mx-auto flex min-h-[620px] max-w-xl items-center justify-center text-center">
        <div className="w-full border border-rose-300/25 bg-rose-300/[0.045] p-7 sm:p-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-rose-200">
            Arena connection
          </p>
          <h1 className="mt-4 text-3xl font-black">Unable to enter</h1>
          <p className="mt-4 leading-7 text-neutral-300">{screen.message}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-12 border border-cyan-300 bg-cyan-300 px-5 font-mono text-xs font-black uppercase tracking-[0.18em] text-black outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-white"
            >
              Try again
            </button>
            <Link
              href="/arena/join"
              className="flex min-h-12 items-center justify-center border border-white/15 px-5 font-mono text-xs font-black uppercase tracking-[0.18em] text-white outline-none hover:border-white focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Enter a code
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const { lobby } = screen;
  const isHost = canManageLobby(lobby);
  const isLobbyOpen = lobby.status === "lobby";
  const canStart =
    isHost && isLobbyOpen && lobby.participantCount === lobby.capacity;
  const ownDisplayName = lobby.ownParticipant?.displayName;
  const inviteUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/arena/join?code=${lobby.joinCode}`;

  if (lobby.status === "countdown") {
    return <TournamentTransition status="TOURNAMENT STARTING" joinCode={lobby.joinCode} />;
  }

  if (lobby.status === "cancelled") {
    return <TournamentTransition status="ARENA CANCELLED" joinCode={lobby.joinCode} />;
  }

  if (
    lobby.status === "round" ||
    lobby.status === "round-results" ||
    lobby.status === "completed"
  ) {
    return <TournamentTransition status={lobbyStatusLabel(lobby.status)} joinCode={lobby.joinCode} />;
  }

  return (
    <section className="mx-auto w-full max-w-5xl py-8 sm:py-12">
      <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="border border-cyan-300/20 bg-cyan-300/[0.035] p-5 sm:p-7">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">
            PIN³ · {isHost ? "Host console" : "Player lobby"}
          </p>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
            Waiting Room
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-400">
            {isHost
              ? "Share the code. The tournament can begin when the field is complete."
              : "You are connected. The host controls the start."}
          </p>

          <div className="mt-7 border-y border-white/10 py-6 text-center">
            <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-neutral-500">
              Join code
            </p>
            <p className="mt-3 font-mono text-4xl font-black tracking-[0.28em] text-white sm:text-5xl">
              {lobby.joinCode}
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button
                type="button"
                onClick={() => void copyText(lobby.joinCode, "Arena code copied.")}
                className="min-h-11 border border-white/15 px-3 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-white outline-none transition hover:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Copy code
              </button>
              <button
                type="button"
                onClick={() => void copyText(inviteUrl, "Invite link copied.")}
                className="min-h-11 border border-white/15 px-3 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-white outline-none transition hover:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Copy invite
              </button>
            </div>
            <p aria-live="polite" className="mt-3 min-h-5 text-xs text-cyan-100">
              {copyMessage}
            </p>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-px bg-white/10">
            <LobbyMetric
              label="Players"
              value={`${lobby.participantCount}/${lobby.capacity}`}
            />
            <LobbyMetric label="Status" value="Waiting" />
          </dl>

          {!isHost && !lobby.ownParticipant && (
            <Link
              href={`/arena/join?code=${lobby.joinCode}`}
              className="mt-6 flex min-h-12 items-center justify-center border border-cyan-300 bg-cyan-300 px-4 font-mono text-xs font-black uppercase tracking-[0.18em] text-black outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-white"
            >
              Join this Arena
            </Link>
          )}
        </aside>

        <div className="border border-white/10 bg-[#080d13]/90 p-5 sm:p-7">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-500">
                Connected field
              </p>
              <h2 className="mt-2 text-2xl font-black">Players</h2>
            </div>
            <p className="font-mono text-sm font-black text-emerald-200">
              {lobby.participantCount} / {lobby.capacity} READY
            </p>
          </div>

          <div className="mt-5 h-1 overflow-hidden bg-white/8">
            <div
              className="h-full bg-cyan-300 transition-[width] duration-500 motion-reduce:transition-none"
              style={{
                width: `${Math.min(100, (lobby.participantCount / lobby.capacity) * 100)}%`,
              }}
            />
          </div>

          <ul className="mt-5 grid max-h-[25rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {lobby.participants.length === 0 ? (
              <li className="col-span-full border border-dashed border-white/10 px-4 py-10 text-center text-sm text-neutral-500">
                Waiting for the first player to join.
              </li>
            ) : (
              lobby.participants.map((participant) => {
                const isCurrentPlayer = participant.displayName === ownDisplayName;

                return (
                  <li
                    key={participant.displayName}
                    className={`flex min-h-12 items-center justify-between border px-4 py-3 ${
                      isCurrentPlayer
                        ? "border-cyan-300/45 bg-cyan-300/[0.07]"
                        : "border-white/8 bg-white/[0.02]"
                    }`}
                  >
                    <span className="min-w-0 truncate text-sm font-semibold text-neutral-100">
                      {participant.displayName}
                    </span>
                    <span className="ml-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-200">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-emerald-200 shadow-[0_0_8px_rgba(110,231,183,0.8)]"
                      />
                      {isCurrentPlayer ? "You" : "Ready"}
                    </span>
                  </li>
                );
              })
            )}
          </ul>

          {isHost ? (
            <div className="mt-6 border-t border-white/10 pt-6">
              <button
                type="button"
                onClick={() => void runHostAction("start")}
                disabled={!canStart || actionPending !== null}
                className="min-h-14 w-full border border-cyan-300 bg-cyan-300 px-5 font-mono text-xs font-black uppercase tracking-[0.2em] text-black outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-neutral-500"
              >
                {actionPending === "start"
                  ? "Starting…"
                  : canStart
                    ? "Start Tournament"
                    : `Waiting for ${lobby.capacity - lobby.participantCount} players`}
              </button>

              <button
                type="button"
                onClick={() => setConfirmCancel((current) => !current)}
                disabled={actionPending !== null}
                aria-expanded={confirmCancel}
                aria-controls="cancel-arena-confirmation"
                className="mt-3 min-h-11 w-full font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500 outline-none transition hover:text-rose-200 focus-visible:ring-2 focus-visible:ring-rose-300"
              >
                Cancel Tournament
              </button>
              {confirmCancel ? (
                <fieldset
                  id="cancel-arena-confirmation"
                  aria-describedby="cancel-arena-description"
                  className="mt-4 border border-rose-300/25 bg-rose-300/[0.04] p-4"
                >
                  <legend className="px-1 font-bold text-rose-100">
                    Cancel this Arena?
                  </legend>
                  <p id="cancel-arena-description" className="mt-1 text-sm text-neutral-400">
                    Players will no longer be able to join.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void runHostAction("cancel")}
                      disabled={actionPending !== null}
                      className="min-h-11 border border-rose-300 bg-rose-300 px-3 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-black outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60"
                    >
                      {actionPending === "cancel" ? "Cancelling…" : "Cancel Arena"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(false)}
                      disabled={actionPending !== null}
                      className="min-h-11 border border-white/15 px-3 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-60"
                    >
                      Keep Lobby
                    </button>
                  </div>
                </fieldset>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 border-t border-white/10 pt-6 text-center">
              <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                Waiting for host
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                Keep this screen open. The lobby refreshes automatically.
              </p>
            </div>
          )}

          <p aria-live="polite" className="mt-4 min-h-5 text-sm text-rose-200">
            {actionMessage}
          </p>
        </div>
      </div>

      <p className="mt-6 text-center font-mono text-[9px] uppercase tracking-[0.22em] text-neutral-600">
        Secure lobby state · Refreshes every 5 seconds until V2.4 Realtime
      </p>
    </section>
  );
}

function LobbyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#080d13] px-3 py-4 text-center">
      <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-2 font-mono text-sm font-black text-white">{value}</dd>
    </div>
  );
}

function TournamentTransition({
  status,
  joinCode,
}: {
  status: string;
  joinCode: string;
}) {
  return (
    <section className="mx-auto flex min-h-[620px] max-w-2xl items-center justify-center text-center">
      <div>
        <div className="mx-auto h-3 w-3 rounded-full bg-cyan-200 shadow-[0_0_28px_rgba(103,232,249,0.95)] motion-safe:animate-pulse" />
        <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-200">
          PIN³ · {joinCode}
        </p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-tight sm:text-6xl">
          {status}
        </h1>
        <p className="mx-auto mt-5 max-w-lg leading-7 text-neutral-400">
          Synchronized round delivery arrives in V2.4. The authoritative Arena
          transition is complete.
        </p>
        <Link
          href="/arena"
          className="mt-8 inline-flex min-h-12 items-center justify-center border border-white/15 px-6 font-mono text-xs font-black uppercase tracking-[0.18em] text-white outline-none hover:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          Return to Arena
        </Link>
      </div>
    </section>
  );
}
