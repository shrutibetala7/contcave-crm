/**
 * Studio status simplification: the nine old stages become four —
 *   not_contacted | in_progress | verified | curated
 *
 *   lead                                            -> not_contacted
 *   contacted / negotiating / agreement_sent /
 *   onboarding                                      -> in_progress
 *   active                                          -> curated if tier was "curated", else verified
 *   not_interested / paused / churned               -> not_contacted (no equivalent; review by hand)
 *
 * Idempotent: documents already on a new value are left alone.
 * Run with: npx tsx scripts/migrate-studio-stages.ts
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { MongoClient } from "mongodb";

loadEnv({ path: existsSync(".env.local") ? ".env.local" : ".env", quiet: true });

const NEW_STAGES = new Set(["not_contacted", "in_progress", "verified", "curated"]);
const IN_PROGRESS = new Set(["contacted", "negotiating", "agreement_sent", "onboarding"]);

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) throw new Error("MONGODB_URI / MONGODB_DB are not set.");

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const studios = client.db(dbName).collection("studios");
    let changed = 0;
    for (const doc of await studios.find({}).toArray()) {
      if (NEW_STAGES.has(doc.stage)) continue;
      const next = IN_PROGRESS.has(doc.stage)
        ? "in_progress"
        : doc.stage === "active"
          ? doc.tier === "curated" ? "curated" : "verified"
          : "not_contacted";
      await studios.updateOne({ _id: doc._id }, { $set: { stage: next } });
      console.log(`  ${doc.name}: ${doc.stage} -> ${next}`);
      changed++;
    }
    console.log(`Done. ${changed} studio(s) updated.`);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
