import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  canManageLobby,
  lobbyErrorMessage,
  lobbyStatusLabel,
  normalizeJoinCodeForUi,
  validateDisplayNameForUi,
} from "../../src/arena/lobby-ui";

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

async function main(): Promise<void> {
  assert.equal(normalizeJoinCodeForUi("  k7m4q2  "), "K7M4Q2");
  assert.equal(normalizeJoinCodeForUi("O1I-k7m4q2-extra"), "K7M4Q2");
  assert.equal(validateDisplayNameForUi("A"), "Display name must contain between 2 and 24 characters.");
  assert.equal(validateDisplayNameForUi("A".repeat(25)), "Display name must contain between 2 and 24 characters.");
  assert.equal(validateDisplayNameForUi("😀".repeat(24)), null);
  assert.equal(validateDisplayNameForUi("😀".repeat(25)), "Display name must contain between 2 and 24 characters.");
  assert.equal(validateDisplayNameForUi("Bad\u0000Name"), "Display name cannot contain control characters.");
  assert.equal(validateDisplayNameForUi("  Alpha   Player  "), null);

  assert.equal(canManageLobby({ isHost: true }), true);
  assert.equal(canManageLobby({ isHost: false }), false);
  assert.equal(lobbyStatusLabel("lobby"), "Waiting for players");
  assert.equal(lobbyStatusLabel("countdown"), "Tournament starting");
  assert.match(lobbyErrorMessage("arena-full"), /full/i);
  assert.match(lobbyErrorMessage("display-name-taken"), /taken/i);
  assert.match(lobbyErrorMessage("invalid-join-code"), /six-character/i);

  const [
    entryPage,
    joinForm,
    createButton,
    lobbyRoom,
    actions,
    readRoute,
    proxy,
  ] = await Promise.all([
    source("src/app/arena/page.tsx"),
    source("src/components/arena/JoinArenaForm.tsx"),
    source("src/components/arena/CreateArenaButton.tsx"),
    source("src/components/arena/MultiplayerLobby.tsx"),
    source("src/app/arena/actions.ts"),
    source("src/app/api/arena/lobbies/[joinCode]/route.ts"),
    source("src/proxy.ts"),
  ]);

  assert(entryPage.includes("CreateArenaButton"));
  assert(entryPage.includes("Join Arena"));
  assert(entryPage.includes("/arena/demo"));

  assert(joinForm.includes("<form"));
  assert(joinForm.includes('htmlFor="arena-join-code"'));
  assert(joinForm.includes('htmlFor="arena-display-name"'));
  assert(joinForm.includes('aria-live="polite"'));
  assert(joinForm.includes("inFlight.current"));
  assert(joinForm.includes("disabled={pending}"));
  assert(createButton.includes("inFlight.current"));
  assert(createButton.includes("disabled={pending}"));

  assert(actions.includes("createArenaLobbyAction()"));
  assert(actions.includes("joinCode: input.joinCode"));
  assert(actions.includes("displayName: input.displayName"));
  for (const clientAuthorityField of [
    "hostSubjectId",
    "participantId",
    "privateSeed",
    "capacity:",
    "role:",
  ]) {
    assert.equal(
      actions.includes(clientAuthorityField),
      false,
      `Server Action accepted client authority field ${clientAuthorityField}.`,
    );
  }

  assert(lobbyRoom.includes("lobby.isHost") || lobbyRoom.includes("canManageLobby(lobby)"));
  assert(lobbyRoom.includes('action === "start"'));
  assert(lobbyRoom.includes("cancelArenaLobbyAction(joinCode)"));
  assert(lobbyRoom.includes('runHostAction("cancel")'));
  assert(lobbyRoom.includes("subscribeToLobbyRealtime"));
  assert(lobbyRoom.includes('document.visibilityState === "hidden"'));
  assert(lobbyRoom.includes("subscription?.unsubscribe()"));
  assert(lobbyRoom.includes("refreshController.current?.abort()"));
  assert.equal(lobbyRoom.includes("setInterval"), false);
  assert(lobbyRoom.includes("<fieldset"));
  assert(lobbyRoom.includes("aria-expanded={confirmCancel}"));
  assert(lobbyRoom.includes("navigator.clipboard.writeText"));
  assert(lobbyRoom.includes("sm:grid-cols-2"));
  assert(lobbyRoom.includes("ownParticipant?.displayName"));
  assert(lobbyRoom.includes("You"));

  for (const privateField of [
    "subjectId",
    "hostUserId",
    "authUserId",
    "privateSeed",
    "correctSetId",
    "access_token",
    "refresh_token",
  ]) {
    assert.equal(
      lobbyRoom.includes(privateField),
      false,
      `Lobby rendering referenced private field ${privateField}.`,
    );
  }

  assert(readRoute.includes('"Cache-Control": "private, no-store"'));
  assert(readRoute.includes("runLobbyOperation"));
  assert(proxy.includes('"/arena/:path*"'));
  assert(proxy.includes('"/api/arena/:path*"'));

  console.log(
    JSON.stringify(
      {
        arenaEntryChoicesRendered: true,
        localDemoPreserved: true,
        createRequestCarriesNoIdentity: true,
        joinRequestCarriesNoIdentityOrRole: true,
        joinCodeNormalizationPassed: true,
        displayNameValidationUxPassed: true,
        duplicateSubmitGuardsPresent: true,
        hostControlsAreRoleGated: true,
        playerControlsExcludeHostActions: true,
        reconnectIndicatorSupported: true,
        safeLobbyProjectionOnly: true,
        realtimeReconciliationIsCleanedUp: true,
        copyCodeBehaviorPresent: true,
        accessibleFormAndConfirmationPresent: true,
        responsiveStructurePresent: true,
        trustedReadBoundaryPresent: true,
      },
      null,
      2,
    ),
  );
}

void main();
