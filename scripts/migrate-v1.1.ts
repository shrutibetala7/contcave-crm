/**
 * Change Brief v1.1 migration: nextActionNote → nextActionReason.
 *
 * Idempotent — safe to re-run. For enquiries and studios, copies a
 * non-empty nextActionNote into nextActionReason (only where
 * nextActionReason isn't already set) and unsets the old field — a true
 * rename, not a backfill. Docs with an empty/absent nextActionNote are left
 * alone: nextActionReason stays null and renders as the amber "no reason
 * recorded" state in the UI. Never writes placeholder text.
 *
 * Run with: npx tsx scripts/migrate-v1.1.ts
 *
 * Per the brief's migration checklist: run this AFTER deploying this
 * code (which is schema-tolerant of the old field) and BEFORE relying on
 * the now-live nextActionReason validation for new writes — see README.
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { MongoClient } from "mongodb";

loadEnv({ path: existsSync(".env.local") ? ".env.local" : ".env" });

async function migrateCollection(db: import("mongodb").Db, name: string): Promise<void> {
  const collection = db.collection(name);

  const result = await collection.updateMany(
    {
      nextActionNote: { $type: "string", $ne: "" },
      nextActionReason: { $in: [null, undefined] },
    },
    [
      { $set: { nextActionReason: "$nextActionNote" } },
      { $unset: "nextActionNote" },
    ]
  );

  // Also drop nextActionNote wherever it's empty/absent-but-present, so the
  // old field name is fully retired from the collection either way.
  const cleanupResult = await collection.updateMany(
    { nextActionNote: { $exists: true } },
    { $unset: { nextActionNote: "" } }
  );

  console.log(
    `  ${name}: migrated ${result.modifiedCount} doc(s), cleaned up ${cleanupResult.modifiedCount} empty nextActionNote field(s)`
  );
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) {
    throw new Error("MONGODB_URI / MONGODB_DB are not set. Copy .env.example to .env.local first.");
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  try {
    console.log("Migrating nextActionNote → nextActionReason…");
    await migrateCollection(db, "enquiries");
    await migrateCollection(db, "studios");
    console.log("Migration complete.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
