"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { getPlayerProfileAction, savePlayerNicknameAction } from "@/app/play/actions";
import { ensureKleinLogicSession } from "@/lib/supabase/anonymous-session";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PlayerProfile, RegionsStats } from "@/server/player/types";
import { LogicPanel } from "@/components/logic/LogicPrimitives";

type PlayerProfileContextValue = Readonly<{
  profile: PlayerProfile | null;
  profileAvailable: boolean;
}>;

const PlayerProfileContext = createContext<PlayerProfileContextValue>({ profile: null, profileAvailable: false });

export function usePlayerProfile(): PlayerProfileContextValue {
  return useContext(PlayerProfileContext);
}

export default function PlayerProfileGate({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [stats, setStats] = useState<RegionsStats | null>(null);
  const [nickname, setNickname] = useState("");
  const [state, setState] = useState<"loading" | "missing" | "ready" | "local">("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        await ensureKleinLogicSession(supabase.auth);
        const result = await getPlayerProfileAction();
        if (!active) return;
        if (result.ok) {
          setProfile(result.data.profile);
          setStats(result.data.stats);
          setState(result.data.profile ? "ready" : "missing");
        } else {
          setError(result.message);
          setState("local");
        }
      } catch {
        if (active) {
          setError("Profile services are unavailable. You can still play locally.");
          setState("local");
        }
      }
    })();
    return () => { active = false; };
  }, []);

  async function saveNickname() {
    setPending(true);
    setError(null);
    const result = await savePlayerNicknameAction(nickname);
    if (result.ok) {
      setProfile(result.data);
      setState("ready");
      setNickname("");
    } else {
      setError(result.message);
    }
    setPending(false);
  }

  if (state === "loading") {
    return <p className="py-12 text-center font-mono text-xs uppercase tracking-[0.18em] text-text-muted">Preparing player profile…</p>;
  }

  if (state === "missing") {
    return (
      <LogicPanel className="mx-auto max-w-md p-6 sm:p-8">
        <p className="logic-kicker">Player profile</p>
        <h2 className="mt-3 text-2xl font-black">Choose your player name</h2>
        <p className="mt-3 text-sm leading-6 text-text-secondary">This is how you’ll appear on KleinLogic records. Your account identity stays private.</p>
        <label className="mt-6 block text-sm font-semibold text-text-primary" htmlFor="player-nickname">Player name</label>
        <input id="player-nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && nickname.trim()) void saveNickname(); }} className="logic-input mt-2 px-3" minLength={2} maxLength={24} autoComplete="nickname" />
        {error && <p role="alert" className="mt-3 text-sm text-state-danger">{error}</p>}
        <button type="button" onClick={() => void saveNickname()} disabled={pending || nickname.trim().length < 2} className="mt-5 min-h-12 w-full bg-logic-primary px-5 font-mono text-xs font-black uppercase tracking-[0.16em] text-black disabled:opacity-40">{pending ? "Saving…" : "Continue"}</button>
        <button type="button" onClick={() => setState("local")} className="mt-3 w-full px-5 py-3 font-mono text-[0.625rem] font-bold uppercase tracking-[0.16em] text-text-muted hover:text-text-primary">Continue locally</button>
      </LogicPanel>
    );
  }

  return (
    <PlayerProfileContext.Provider value={{ profile, profileAvailable: state === "ready" && profile !== null }}>
    <div>
      {state === "ready" && profile && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-border-subtle bg-surface-elevated px-4 py-3">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-text-primary">Playing as <span className="text-logic-primary">{profile.nickname}</span></p>
          {stats && <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-text-muted">Solved {stats.totalRegionsSolves} · Time Attack best {stats.bestTimeAttackBoards}</p>}
        </div>
      )}
      {state === "local" && <div className="mb-6 border border-border-subtle bg-surface-elevated px-4 py-3"><p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Local play · profile not saved</p>{error && <p className="mt-1 text-xs text-text-secondary">{error}</p>}</div>}
      {children}
    </div>
    </PlayerProfileContext.Provider>
  );
}
