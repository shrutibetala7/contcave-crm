/**
 * Enquiry pipeline simplification: twelve statuses become seven —
 *   new_lead | in_progress | confirmed | on_hold | cancelled | lost | dormant
 *
 *   new, contacted, qualified, shortlist_sent, negotiating -> in_progress
 *   (new alone -> new_lead, since it hadn't been touched yet)
 *   confirmed, scheduled, completed, feedback_pending, closed_won -> confirmed
 *   delayed                                                      -> on_hold
 *   dormant, lost                                                -> unchanged
 *
 * Also backfills `enquiryDate` (new field — when the enquiry actually came
 * in, distinct from `createdAt`) to `createdAt` on any record that predates
 * it, and `contacts.isCustomer` (new field) to `false` where absent.
 *
 * Idempotent: a document already on a new status, or already carrying
 * `enquiryDate`/`isCustomer`, is left alone.
 * Run with: npx tsx scripts/migrate-enquiry-statuses.ts
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { MongoClient } from "mongodb";

loadEnv({ path: existsSync(".env.local") ? ".env.local" : ".env", quiet: true });

const NEW_STATUSES = new Set(["new_lead", "in_progress", "confirmed", "on_hold", "cancelled", "lost", "dormant"]);
const TO_IN_PROGRESS = new Set(["contacted", "qualified", "shortlist_sent", "negotiating"]);
const TO_CONFIRMED = new Set(["confirmed", "scheduled", "completed", "feedback_pending", "closed_won"]);

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) throw new Error("MONGODB_URI / MONGODB_DB are not set.");

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const enquiries = db.collection("enquiries");

    let statusChanged = 0;
    for (const doc of await enquiries.find({}).toArray()) {
      if (!NEW_STATUSES.has(doc.status)) {
        const next = doc.status === "new" ? "new_lead" : TO_IN_PROGRESS.has(doc.status) ? "in_progress" : TO_CONFIRMED.has(doc.status) ? "confirmed" : doc.status === "delayed" ? "on_hold" : doc.status;
        await enquiries.updateOne({ _id: doc._id }, { $set: { status: next } });
        console.log(`  ${doc.code}: ${doc.status} -> ${next}`);
        statusChanged++;
      }
    }

    const dateResult = await enquiries.updateMany(
      { enquiryDate: { $exists: false } },
      [{ $set: { enquiryDate: "$createdAt" } }]
    );
    console.log(`enquiryDate backfilled on ${dateResult.modifiedCount} enquiries (defaulted to createdAt).`);

    const customerResult = await db
      .collection("contacts")
      .updateMany({ isCustomer: { $exists: false } }, { $set: { isCustomer: false } });
    console.log(`isCustomer backfilled on ${customerResult.modifiedCount} contacts.`);

    console.log(`Done. ${statusChanged} enquiry status(es) remapped.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
