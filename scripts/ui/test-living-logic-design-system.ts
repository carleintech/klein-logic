import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

async function main(): Promise<void> {
  const [css, primitives, shell, home, arena, join, lobby, demo, regions, sumroll] = await Promise.all([
    source("src/app/globals.css"), source("src/components/logic/LogicPrimitives.tsx"),
    source("src/components/logic/KleinLogicShell.tsx"), source("src/app/page.tsx"),
    source("src/app/arena/page.tsx"), source("src/components/arena/JoinArenaForm.tsx"),
    source("src/components/arena/MultiplayerLobby.tsx"), source("src/app/arena/demo/page.tsx"),
    source("src/app/play/page.tsx"), source("src/app/games/sumroll/page.tsx"),
  ]);
  const checks: Record<string, boolean> = {};
  function check(name: string, condition: boolean, message = name) {
    assert.equal(condition, true, message); checks[name] = true;
  }

  check("tokenFoundation", css.includes(":root"));
  for (const token of ["--surface-background", "--surface-panel", "--text-primary", "--border-focus", "--logic-primary", "--logic-secondary", "--state-danger", "--pressure-critical", "--layout-content", "--radius-panel", "--shadow-panel"]) {
    check(`token:${token}`, css.includes(token), `Missing semantic token ${token}`);
  }
  check("reducedMotion", css.includes("prefers-reduced-motion: reduce"));
  check("globalFocus", css.includes(":focus-visible"));
  check("lightweightGrid", css.includes(".logic-grid::before"));
  check("noCanvas", !css.includes("canvas"));
  for (const primitive of ["LogicMark", "LogicPanel", "LogicDivider", "LogicButton", "LogicStatus", "LogicMetric", "LogicCode"]) {
    check(`primitive:${primitive}`, primitives.includes(`function ${primitive}`) || primitives.includes(`const ${primitive}`));
  }
  for (const variant of ["primary", "secondary", "ghost", "danger", "arena"]) {
    check(`button:${variant}`, primitives.includes(`${variant}:`));
  }
  for (const status of ["waiting", "ready", "active", "qualified", "eliminated", "completed", "cancelled", "connecting", "reconnecting", "error"]) {
    check(`status:${status}`, primitives.includes(`${status}:`) || primitives.includes(`\"${status}\"`));
  }
  check("statusHasText", primitives.includes("{label ?? status}"));
  check("appShell", shell.includes("KleinLogicShell") && shell.includes("LogicMark"));
  check("mobileGutters", shell.includes("--page-gutter"));
  check("homepageUsesSystem", home.includes("KleinLogicShell") && home.includes("LogicPanel"));
  check("noFakeStatistics", !home.includes("player count") && !home.includes("#001"));
  check("arenaUsesSystem", arena.includes("LogicPanel") && arena.includes("logicButtonClass"));
  check("joinUsesSystem", join.includes("logic-input") && join.includes("LogicButton"));
  check("lobbyUsesSystem", lobby.includes("LogicStatus") && lobby.includes("LogicCode") && lobby.includes("LogicMetric"));
  check("hostControlsPreserved", lobby.includes('runHostAction("start")') && lobby.includes('runHostAction("cancel")'));
  check("realtimePreserved", lobby.includes("subscribeToLobbyRealtime") && lobby.includes("shouldReconcileLobbyNotification"));
  check("privateFieldsAbsent", !lobby.includes("privateSeed") && !lobby.includes("access_token"));
  check("responsiveLobby", lobby.includes("sm:grid-cols-2") && lobby.includes("max-h-[25rem]"));
  check("demoPreserved", demo.includes("ArenaExperience"));
  check("regionsLogicPreserved", regions.includes("GameBoard") && regions.includes("puzzle001"));
  check("sumrollLogicPreserved", sumroll.includes("SumRollExperience"));

  console.log(JSON.stringify({ checksPassed: Object.keys(checks).length, checks }, null, 2));
}

void main();
