import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

async function main(): Promise<void> {
  const [provider, primitives, css, layout, shell, home, regions, sumroll, rush, round, player] = await Promise.all([
    source("src/components/feedback/FeedbackProvider.tsx"),
    source("src/components/feedback/FeedbackPrimitives.tsx"),
    source("src/app/globals.css"),
    source("src/app/layout.tsx"),
    source("src/components/logic/KleinLogicShell.tsx"),
    source("src/app/page.tsx"),
    source("src/components/game/GameBoard.tsx"),
    source("src/components/sumroll/SumRollGame.tsx"),
    source("src/components/sumroll/RushGame.tsx"),
    source("src/components/arena/ArenaRound.tsx"),
    source("src/components/arena/ArenaPlayerRound.tsx"),
  ]);
  const checks: Record<string, boolean> = {};
  function check(name: string, condition: boolean): void {
    assert.equal(condition, true, name);
    checks[name] = true;
  }

  check("clientBoundary", provider.startsWith('"use client"'));
  check("providerMounted", layout.includes("<FeedbackProvider>") && layout.includes("</FeedbackProvider>"));
  check("contextHook", provider.includes("createContext") && provider.includes("useFeedback"));
  for (const cue of ["select", "success", "failure", "warning", "qualify", "eliminate", "countdown", "roundChange"]) {
    check(`cue:${cue}`, provider.includes(`${cue}:`));
  }
  check("preferenceSound", provider.includes("sound: boolean"));
  check("preferenceHaptics", provider.includes("haptics: boolean"));
  check("preferenceMotion", provider.includes('motion: MotionPreference'));
  check("validatedMotion", provider.includes('value === "system"') && provider.includes('value === "full"') && provider.includes('value === "reduced"'));
  check("safeDefaults", provider.includes('motion: "system"') && provider.includes("sound: true") && provider.includes("haptics: true"));
  check("namespacedStorage", provider.includes('kleinlogic.feedback.v1'));
  check("storageReadGuarded", provider.includes("window.localStorage.getItem") && provider.includes("catch"));
  check("storageWriteGuarded", provider.includes("window.localStorage.setItem") && provider.includes("JSON.stringify(preferences)"));
  check("noIdentityStorage", !provider.includes("userId") && !provider.includes("participantId") && !provider.includes("access_token"));
  check("audioApi", provider.includes("AudioContext") && provider.includes("createOscillator") && provider.includes("createGain"));
  check("audioAutoplaySafe", provider.includes('typeof window === "undefined"') && provider.includes('context.state === "suspended"'));
  check("audioFailureSafe", provider.includes("resume().catch") && provider.includes("Audio is an enhancement"));
  check("originalSynthTones", provider.includes('oscillator.type = "sine"') && !provider.includes("new Audio("));
  check("cueRateLimit", provider.includes("lastCue") && provider.includes("now - previous < 45"));
  check("hapticsOptional", provider.includes("navigator.vibrate") && provider.includes('typeof navigator !== "undefined"'));
  check("motionDataAttribute", provider.includes("data-logic-motion={preferences.motion}"));
  check("preferenceControl", provider.includes("Feedback preferences") && provider.includes('setPreference("sound"') && provider.includes('setPreference("haptics"'));
  check("feedbackPulsePrimitive", primitives.includes("LogicPulse"));
  check("feedbackCountdownPrimitive", primitives.includes("LogicCountdown") && primitives.includes("aria-live"));
  check("feedbackStatePrimitive", primitives.includes("LogicFeedbackState") && primitives.includes("data-feedback-state"));
  check("pulseKeyframes", css.includes("@keyframes logic-pulse") && css.includes("@keyframes logic-countdown"));
  check("reducedMotionAttribute", css.includes('[data-logic-motion="reduced"]') && css.includes("animation: none"));
  check("systemReducedMotion", css.includes("prefers-reduced-motion: reduce"));
  check("shellPreferences", shell.includes("FeedbackPreferences"));
  check("homepagePulse", home.includes("LogicPulse"));
  check("regionsSelectionCue", regions.includes("feedbackApi.select()"));
  check("regionsSuccessCue", regions.includes("feedbackApi.success()") && regions.includes("feedbackApi.qualify()"));
  check("regionsFailureCue", regions.includes("feedbackApi.failure()") && regions.includes("feedbackApi.eliminate()"));
  check("sumrollSelectionCue", sumroll.includes("feedbackApi.select()"));
  check("sumrollResultCue", sumroll.includes("feedbackApi.success()") && sumroll.includes("feedbackApi.failure()"));
  check("rushModeCue", rush.includes("feedbackApi.roundChange()") && rush.includes("feedbackApi.warning()"));
  check("arenaCountdownCue", round.includes("feedbackApi.countdown") && round.includes("feedbackApi.roundChange()"));
  check("arenaPlayerCue", player.includes("feedbackApi.select()") && player.includes("feedbackApi.qualify()") && player.includes("feedbackApi.eliminate()"));
  check("gameLogicStillPresent", regions.includes("validateRegion") && sumroll.includes("validateChallenge") && rush.includes("tickRushSession"));
  check("arenaStateStillPresent", round.includes("tournament.status") && player.includes("onSubmit"));
  check("noFeedbackTimers", !provider.includes("setInterval") && !provider.includes("setTimeout"));

  console.log(JSON.stringify({ checksPassed: Object.keys(checks).length, checks }, null, 2));
}

void main();
