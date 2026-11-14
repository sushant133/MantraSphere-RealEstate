/**
 * Local MongoDB without Docker: a single-node replica set (so transactions
 * work) bound to 127.0.0.1, data persisted in ./.mongo-data.
 *
 *   npm run db:dev     # then use MONGODB_URI=mongodb://127.0.0.1:27017/mantrasphere?replicaSet=rs0
 *
 * Prefer `docker compose up -d mongo` when Docker is available; that setup
 * also enables authentication like production.
 */
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { promises as fs } from "node:fs";
import path from "node:path";

async function main() {
  const dbPath = path.join(process.cwd(), ".mongo-data");
  await fs.mkdir(dbPath, { recursive: true });
  const port = Number(process.env.DEV_DB_PORT ?? 27017);

  const rs = await MongoMemoryReplSet.create({
    binary: { version: process.env.MONGOMS_VERSION ?? "7.0.14" },
    replSet: { name: "rs0", count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
    instanceOpts: [{ port, dbPath }],
  });
  await rs.waitUntilRunning();
  console.log(`MongoDB replica set running: mongodb://127.0.0.1:${port}/mantrasphere?replicaSet=rs0`);
  console.log("Press Ctrl+C to stop.");

  const stop = async () => {
    await rs.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
