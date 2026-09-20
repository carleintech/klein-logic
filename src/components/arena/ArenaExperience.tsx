"use client";

import { useEffect, useState } from "react";

import { PIN3_DEMO_PRESET } from "@/arena/presets/pin3-demo";
import {
  createSimulatedProfiles,
  simulateRoundResponses,
} from "@/arena/engine/simulator";
import {
  advanceTournament,
  beginTournamentRound,
  createTournament,
  enterTournamentLobby,
  resolveTournamentRound,
  startTournament,
} from "@/arena/engine/tournament";
import type {
  SimulatedPlayerProfile,
  TournamentState,
} from "@/arena/types";

import ArenaLobby from "./ArenaLobby";
import ArenaResults from "./ArenaResults";
import ArenaRound from "./ArenaRound";

const DEFAULT_SEED = "PIN3-DEMO-001";

export default function ArenaExperience() {
  const [seedInput, setSeedInput] = useState(DEFAULT_SEED);
  const [tournament, setTournament] = useState<TournamentState>(() =>
    createTournament(PIN3_DEMO_PRESET, DEFAULT_SEED),
  );
  const [profiles, setProfiles] = useState<SimulatedPlayerProfile[]>(() =>
    createSimulatedProfiles(createTournament(PIN3_DEMO_PRESET, DEFAULT_SEED)),
  );
  const [countdown, setCountdown] = useState(3);
  const [alternateRun, setAlternateRun] = useState(1);

  useEffect(() => {
    if (tournament?.status !== "countdown") {
      return;
    }

    const timer = window.setTimeout(() => {
      if (countdown > 0) {
        setCountdown((current) => current - 1);
        return;
      }

      setTournament((current) =>
        current?.status === "countdown"
          ? beginTournamentRound(current)
          : current,
      );
      setCountdown(3);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [countdown, tournament?.status]);

  useEffect(() => {
    if (tournament?.status !== "round") {
      return;
    }

    const timer = window.setTimeout(() => {
      setTournament((current) => {
        if (current?.status !== "round") {
          return current;
        }

        return resolveTournamentRound(
          current,
          simulateRoundResponses(current, profiles),
        );
      });
    }, 1_250);

    return () => window.clearTimeout(timer);
  }, [profiles, tournament?.status]);

  function enterArena(seed: string) {
    const landingTournament = createTournament(PIN3_DEMO_PRESET, seed);
    const nextTournament = enterTournamentLobby(landingTournament);
    setTournament(nextTournament);
    setProfiles(createSimulatedProfiles(nextTournament));
    setCountdown(3);
  }

  function handleStart() {
    setTournament((current) => startTournament(current));
    setCountdown(3);
  }

  function handleContinue() {
    setTournament((current) => advanceTournament(current));
    setCountdown(3);
  }

  function handleDifferentSeed() {
    const nextSeed = `VECTOR-${alternateRun.toString().padStart(3, "0")}`;
    setAlternateRun((current) => current + 1);
    setSeedInput(nextSeed);
    enterArena(nextSeed);
  }

  if (tournament.status === "landing") {
    return (
      <section className="mx-auto flex min-h-[680px] w-full max-w-4xl flex-col items-center justify-center text-center">
        <p className="font-mono text-xs font-black uppercase tracking-[0.36em] text-neutral-500">
          KleinLogic Arena
        </p>
        <h1 className="mt-6 text-8xl font-black tracking-[-0.07em] text-white sm:text-9xl">
          PIN<sup className="text-3xl text-cyan-300 sm:text-4xl">3</sup>
        </h1>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.28em] text-cyan-300 sm:text-sm">
          Pressure Intelligence Network
        </p>
        <p className="mt-5 text-lg font-bold text-neutral-300">
          3 seconds. One choice. Stay sharp.
        </p>

        <div className="mt-10 w-full max-w-lg border border-cyan-300/20 bg-cyan-300/[0.035] p-7 shadow-2xl shadow-cyan-950/20 sm:p-9">
          <p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-white">
            Demo Tournament
          </p>
          <div className="mt-7 grid grid-cols-2 gap-px bg-white/10">
            <LandingMetric label="Players" value="50" />
            <LandingMetric label="Rounds" value="7" />
          </div>
          <label className="mt-6 block text-left font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            Tournament seed
            <input
              value={seedInput}
              onChange={(event) => setSeedInput(event.target.value.toUpperCase())}
              className="mt-2 w-full border border-white/15 bg-black/30 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-cyan-300"
              maxLength={24}
            />
          </label>
          <button
            type="button"
            onClick={() => enterArena(seedInput)}
            className="mt-5 w-full border border-cyan-300 bg-cyan-300 px-6 py-4 font-mono text-sm font-black uppercase tracking-[0.22em] text-black transition hover:bg-white"
          >
            Enter Arena
          </button>
        </div>

        <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-600">
          Powered by KleinLogic
        </p>
      </section>
    );
  }

  if (tournament.status === "lobby") {
    return <ArenaLobby tournament={tournament} onStart={handleStart} />;
  }

  if (tournament.status === "completed") {
    return (
      <ArenaResults
        tournament={tournament}
        onReplay={() => enterArena(tournament.seed)}
        onDifferentSeed={handleDifferentSeed}
      />
    );
  }

  return (
    <ArenaRound
      tournament={tournament}
      countdown={countdown}
      onContinue={handleContinue}
    />
  );
}

function LandingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#080d13] px-4 py-5">
      <p className="font-mono text-3xl font-black text-white">{value}</p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </p>
    </div>
  );
}
