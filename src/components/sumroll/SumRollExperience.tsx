"use client";

import { useState } from "react";

import type { SumRollModeType } from "@/game/sumroll/engine";

import RushGame from "./RushGame";
import SumRollGame from "./SumRollGame";

type AvailableMode = Extract<SumRollModeType, "classic" | "rush">;

export default function SumRollExperience() {
  const [mode, setMode] = useState<AvailableMode>("classic");

  return (
    <div>
      <div className="mx-auto mb-7 grid w-full max-w-md grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-2">
        <ModeButton
          label="Classic"
          description="10 rounds"
          active={mode === "classic"}
          onClick={() => setMode("classic")}
        />
        <ModeButton
          label="Rush"
          description="60 seconds"
          active={mode === "rush"}
          onClick={() => setMode("rush")}
          rush
        />
      </div>

      {mode === "classic" ? <SumRollGame /> : <RushGame />}
    </div>
  );
}

function ModeButton({
  label,
  description,
  active,
  onClick,
  rush = false,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
  rush?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "rounded-xl px-4 py-3 text-left transition",
        active
          ? rush
            ? "bg-orange-400 text-black"
            : "bg-white text-black"
          : "text-neutral-400 hover:bg-white/5 hover:text-white",
      ].join(" ")}
    >
      <span className="block font-black">{rush ? "⚡ " : ""}{label}</span>
      <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.16em] opacity-60">
        {description}
      </span>
    </button>
  );
}
