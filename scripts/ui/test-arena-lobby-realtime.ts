import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createLobbyRealtimeNotification,
  LOBBY_REALTIME_EVENT_NAME,
  LOBBY_REALTIME_EVENT_TYPE,
  lobbyRealtimeChannel,
  parseLobbyRealtimeNotification,
  shouldApplyLobbyProjection,
  shouldReconcileLobbyNotification,
  type LobbyRealtimePublisher,
} from "../../src/arena/lobby-realtime";
import type { LobbyActionResult } from "../../src/arena/lobby-ui";
import type { PublicLobbyView } from "../../src/server/arena/lobby";
import { notifyCommittedLobbyMutation } from "../../src/server/arena/lobby-realtime-boundary";

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

function lobby(
  stateVersion: number,
  overrides: Partial<PublicLobbyView> = {},
): PublicLobbyView {
  return {
    joinCode: "K7M4Q2",
    stateVersion,
    presetId: "pin3-demo",
    presetName: "PIN³ Demo",
    status: "lobby",
    capacity: 50,
    participantCount: 1,
    participants: [{ displayName: "Host", status: "active" }],
    isHost: true,
    ownParticipant: null,
    ...overrides,
  };
}

async function main(): Promise<void> {
  const checks: Record<string, boolean> = {};
  const notification = createLobbyRealtimeNotification("K7M4Q2", 4);

  assert.deepEqual(notification, {
    type: LOBBY_REALTIME_EVENT_TYPE,
    joinCode: "K7M4Q2",
    stateVersion: 4,
  });
  checks.minimalEventContract = true;
  assert.equal(LOBBY_REALTIME_EVENT_NAME, "lobby-updated");
  checks.explicitEventName = true;
  assert.equal(lobbyRealtimeChannel("K7M4Q2"), "arena:lobby:K7M4Q2");
  checks.channelIsolatedByJoinCode = true;
  assert.deepEqual(parseLobbyRealtimeNotification(notification), notification);
  checks.validEventParsed = true;
  assert.equal(parseLobbyRealtimeNotification({ type: "OTHER" }), null);
  checks.malformedEventIgnored = true;
  assert.equal(
    shouldReconcileLobbyNotification(notification, "ZZZZZZ", 1),
    false,
  );
  checks.unrelatedLobbyIgnored = true;
  assert.equal(
    shouldReconcileLobbyNotification(notification, "K7M4Q2", 3),
    true,
  );
  checks.newEventReconciles = true;
  assert.equal(
    shouldReconcileLobbyNotification(notification, "K7M4Q2", 4),
    false,
  );
  checks.duplicateEventIgnored = true;
  assert.equal(
    shouldReconcileLobbyNotification(notification, "K7M4Q2", 5),
    false,
  );
  checks.staleEventIgnored = true;
  assert.equal(shouldApplyLobbyProjection(3, 4), false);
  checks.outOfOrderProjectionIgnored = true;
  assert.equal(shouldApplyLobbyProjection(4, 4), true);
  checks.equalProjectionSafe = true;
  assert.equal(shouldApplyLobbyProjection(5, 4), true);
  checks.newProjectionApplied = true;

  const serialized = JSON.stringify(notification);
  for (const privateField of [
    "subjectId",
    "hostSubjectId",
    "authUserId",
    "access_token",
    "refresh_token",
    "privateSeed",
    "roundSeed",
    "tieBreak",
    "challenge",
    "answer",
  ]) {
    assert.equal(serialized.includes(privateField), false);
  }
  checks.notificationContainsNoPrivateState = true;

  const published: unknown[] = [];
  const recordingPublisher: LobbyRealtimePublisher = {
    async publish(value) {
      published.push(value);
    },
  };
  const successfulResult: LobbyActionResult<PublicLobbyView> = {
    ok: true,
    data: lobby(7),
  };
  const returnedSuccess = await notifyCommittedLobbyMutation(
    successfulResult,
    (value) => value,
    recordingPublisher,
  );
  assert.equal(returnedSuccess, successfulResult);
  assert.deepEqual(published, [createLobbyRealtimeNotification("K7M4Q2", 7)]);
  checks.successfulMutationPublishes = true;

  const failedResult: LobbyActionResult<PublicLobbyView> = {
    ok: false,
    error: { code: "unauthorized", message: "Not authorized." },
  };
  await notifyCommittedLobbyMutation<PublicLobbyView>(
    failedResult,
    (value) => value,
    recordingPublisher,
  );
  assert.equal(published.length, 1);
  checks.failedMutationDoesNotPublish = true;

  const originalConsoleError = console.error;
  let publicationFailureLogged = false;
  console.error = () => {
    publicationFailureLogged = true;
  };
  try {
    const resultAfterPublicationFailure = await notifyCommittedLobbyMutation(
      successfulResult,
      (value) => value,
      { async publish() { throw new Error("transport unavailable"); } },
    );
    assert.equal(resultAfterPublicationFailure, successfulResult);
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(publicationFailureLogged, true);
  checks.publicationFailurePreservesCommittedResult = true;

  const [
    lobbyPage,
    lobbyComponent,
    browserAdapter,
    serverAdapter,
    actions,
    service,
    repository,
    readRoute,
  ] = await Promise.all([
    source("src/app/arena/lobby/[joinCode]/page.tsx"),
    source("src/components/arena/MultiplayerLobby.tsx"),
    source("src/lib/supabase/lobby-realtime.ts"),
    source("src/server/arena/supabase-lobby-realtime.ts"),
    source("src/app/arena/actions.ts"),
    source("src/server/services/arena-service.ts"),
    source("src/server/repositories/arena-repository.ts"),
    source("src/app/api/arena/lobbies/[joinCode]/route.ts"),
  ]);

  assert(lobbyPage.includes("initialLobby="));
  checks.serverInitialProjectionRendered = true;
  assert(browserAdapter.includes("lobbyRealtimeChannel(joinCode)"));
  checks.correctChannelSubscribed = true;
  assert(browserAdapter.includes('"broadcast"'));
  checks.broadcastTransportSubscribed = true;
  assert(lobbyComponent.includes("readLobby(joinCode"));
  checks.eventReconcilesTrustedRead = true;
  assert(lobbyComponent.includes('status === "connected"'));
  checks.reconnectReconciles = true;
  assert(lobbyComponent.includes('document.visibilityState === "visible"'));
  checks.visibilityRestorationReconciles = true;
  assert(lobbyComponent.includes("subscription?.unsubscribe()"));
  checks.subscriptionCleanedUp = true;
  assert(lobbyComponent.includes("refreshController.current?.abort()"));
  checks.obsoleteRequestAborted = true;
  assert(lobbyComponent.includes("refreshInFlight.current"));
  checks.overlappingReconciliationPrevented = true;
  assert.equal(lobbyComponent.includes("setInterval"), false);
  assert.equal(lobbyComponent.includes("POLLING_INTERVAL_MS"), false);
  checks.steadyPollingRemoved = true;
  assert(lobbyComponent.includes("Connection interrupted"));
  checks.degradedConnectionStatePresent = true;
  assert(lobbyComponent.includes('aria-live="polite"'));
  checks.accessibleMeaningfulUpdatesPresent = true;
  assert(serverAdapter.includes("channel.httpSend"));
  checks.serverUsesHttpBroadcastBridge = true;
  assert(serverAdapter.includes("private: false"));
  checks.publicChannelDecisionExplicit = true;
  assert(actions.includes("notifyCommittedLobbyMutation"));
  assert(actions.indexOf("runLobbyOperation") < actions.lastIndexOf("notifyCommittedLobbyMutation"));
  checks.publicationFollowsAuthoritativeOperation = true;
  assert(service.includes("authorizeHostOperation"));
  checks.hostAuthorizationRemainsServerSide = true;
  assert(service.includes("joinLobbyForIdentity"));
  checks.joinAuthorizationRemainsServerSide = true;
  assert.equal(browserAdapter.includes("startLobby"), false);
  assert.equal(browserAdapter.includes("cancelLobby"), false);
  assert.equal(browserAdapter.includes("joinLobby"), false);
  checks.realtimeCannotMutateArena = true;
  assert(readRoute.includes("runLobbyOperation"));
  assert(readRoute.includes('"Cache-Control": "private, no-store"'));
  checks.reconciliationEndpointRemainsTrusted = true;
  assert(repository.includes("for update"));
  assert(repository.includes("state_version = state_version + 1"));
  checks.concurrencyAndVersioningPreserved = true;
  assert.equal(serverAdapter.includes("service_role"), false);
  assert.equal(serverAdapter.includes("SUPABASE_SECRET"), false);
  checks.noPrivilegedCredentialAdded = true;
  assert.equal(serverAdapter.includes("from("), false);
  assert.equal(serverAdapter.includes("postgres_changes"), false);
  checks.noSecondArenaDatabaseIntroduced = true;

  assert.equal(Object.keys(checks).length, 38);
  assert(Object.values(checks).every(Boolean));

  console.log(JSON.stringify(checks, null, 2));
}

void main();
