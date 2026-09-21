import "server-only";

import { Pool } from "pg";

declare global {
  var kleinlogicDatabasePool: Pool | undefined;
}

export function createDatabasePool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export function getDatabasePool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Arena persistence.");
  }

  if (!globalThis.kleinlogicDatabasePool) {
    globalThis.kleinlogicDatabasePool = createDatabasePool(connectionString);
  }

  return globalThis.kleinlogicDatabasePool;
}

export async function closeDatabasePool(): Promise<void> {
  if (!globalThis.kleinlogicDatabasePool) {
    return;
  }

  await globalThis.kleinlogicDatabasePool.end();
  globalThis.kleinlogicDatabasePool = undefined;
}
