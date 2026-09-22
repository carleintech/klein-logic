import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { LOBBY_REALTIME_EVENT_NAME } from "../../src/arena/lobby-realtime";

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  assert(value, `${name} is required.`);
  return value;
}

const url = requiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = requiredEnvironmentVariable(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);

function client() {
  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function main(): Promise<void> {
  const topic = `kleinlogic:v24:verification:${randomUUID()}`;
  const payload = { verificationId: randomUUID() };
  const subscriber = client();
  const publisher = client();
  const subscriberChannel = subscriber.channel(topic, {
    config: { private: false },
  });
  const publisherChannel = publisher.channel(topic, {
    config: { private: false },
  });

  let resolveReceived: ((value: unknown) => void) | undefined;
  const received = new Promise<unknown>((resolve) => {
    resolveReceived = resolve;
  });
  const subscribed = new Promise<void>((resolve, reject) => {
    subscriberChannel
      .on(
        "broadcast",
        { event: LOBBY_REALTIME_EVENT_NAME },
        ({ payload: receivedPayload }) => resolveReceived?.(receivedPayload),
      )
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(error ?? new Error(`Realtime subscription failed: ${status}`));
        }
      });
  });

  try {
    await Promise.race([
      subscribed,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Realtime subscription timed out.")), 15_000),
      ),
    ]);

    const publishResult = await publisherChannel.httpSend(
      LOBBY_REALTIME_EVENT_NAME,
      payload,
    );
    assert.equal(publishResult.success, true);

    const receivedPayload = await Promise.race([
      received,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Realtime broadcast was not received.")), 15_000),
      ),
    ]);
    assert.deepEqual(receivedPayload, payload);

    console.log(
      JSON.stringify(
        {
          publicChannelSubscription: true,
          httpBroadcastAccepted: true,
          independentClientReceivedSignal: true,
          dashboardChangesRequired: false,
        },
        null,
        2,
      ),
    );
  } finally {
    await Promise.all([
      subscriber.removeChannel(subscriberChannel),
      publisher.removeChannel(publisherChannel),
    ]);
  }
}

void main();
