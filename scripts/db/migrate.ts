import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { closeDatabasePool, getDatabasePool } from "../../src/server/db/pool";

async function migrate(): Promise<void> {
  const pool = getDatabasePool();
  const migrationsDirectory = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  await pool.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      checksum text not null,
      applied_at timestamptz not null default clock_timestamp()
    )
  `);

  for (const filename of files) {
    const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const client = await pool.connect();

    try {
      await client.query("begin");
      const existing = await client.query<{ checksum: string }>(
        "select checksum from public.schema_migrations where filename = $1 for update",
        [filename],
      );

      if (existing.rowCount === 1) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Applied migration ${filename} has changed.`);
        }

        await client.query("commit");
        console.log(`Already applied: ${filename}`);
        continue;
      }

      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations (filename, checksum) values ($1, $2)",
        [filename, checksum],
      );
      await client.query("commit");
      console.log(`Applied: ${filename}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}

migrate()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDatabasePool);
