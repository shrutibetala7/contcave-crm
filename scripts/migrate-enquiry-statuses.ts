/**
 * Enquiry pipeline simplification: twelve statuses become eight —
 *   new_lead | in_progress | confirmed | completed | on_hold | cancelled | lost | dormant
 *
 *   new, contacted, qualified, shortlist_sent, negotiating -> in_progress
 *   (new alone -> new_lead, since it hadn't been touched yet)
 *   scheduled, closed_won                                  -> confirmed
 *   feedback_pending                                       -> completed
 *   delayed                                                -> on_hold
 *   confirmed, completed, dormant, lost                    -> unchanged
 *
 * Also backfills `enquiryDate` (new field — when the enquiry actually came
 * in, distinct from `createdAt`) to `createdAt` on any record that predates
 * it, and `contacts.isCustomer` (new field) to `false` where absent. Any
 * enquiry already Confirmed/Completed is marked won and its contact a
 * customer (the old "confirmed" did neither), and its brand's rollups are
 * recomputed.
 *
 * Idempotent: a document already on a new status, already carrying
 * `enquiryDate`/`isCustomer`, or already marked won, is left alone.
 * Run with: npx tsx scripts/migrate-enquiry-statuses.ts
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { MongoClient, ObjectId } from "mongodb";

loadEnv({ path: existsSync(".env.local") ? ".env.local" : ".env", quiet: true });

const NEW_STATUSES = new Set(["new_lead", "in_progress", "confirmed", "completed", "on_hold", "cancelled", "lost", "dormant"]);
const TO_IN_PROGRESS = new Set(["contacted", "qualified", "shortlist_sent", "negotiating"]);
const TO_CONFIRMED = new Set(["scheduled", "closed_won"]);
const TO_COMPLETED = new Set(["feedback_pending"]);

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
        const next = doc.status === "new" ? "new_lead" : TO_IN_PROGRESS.has(doc.status) ? "in_progress" : TO_CONFIRMED.has(doc.status) ? "confirmed" : TO_COMPLETED.has(doc.status) ? "completed" : doc.status === "delayed" ? "on_hold" : doc.status;
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

    // The old pipeline's plain "confirmed" (unlike closed_won) never marked the
    // deal won or the lead a customer — the new Confirmed does both, and
    // Completed implies it. Bring anything already there up to that standard.
    let wonBackfilled = 0;
    const affectedBrands = new Map<string, string>(); // brandId -> tenantId
    for (const doc of await enquiries
      .find({ status: { $in: ["confirmed", "completed"] }, "outcome.result": { $ne: "won" } })
      .toArray()) {
      const confirmedAt = await db
        .collection("activities")
        .findOne(
          { entityId: doc._id.toHexString(), type: "status_change", "meta.to": "confirmed" },
          { sort: { createdAt: -1 } }
        );
      await enquiries.updateOne(
        { _id: doc._id },
        { $set: { "outcome.result": "won", "outcome.closedAt": doc.outcome?.closedAt ?? confirmedAt?.createdAt ?? doc.updatedAt } }
      );
      if (doc.contactId) {
        await db.collection("contacts").updateOne({ _id: new ObjectId(doc.contactId) }, { $set: { isCustomer: true } });
      }
      if (doc.brandId) affectedBrands.set(doc.brandId, doc.tenantId);
      console.log(`  ${doc.code}: ${doc.status}, marked won + contact marked as customer`);
      wonBackfilled++;
    }
    console.log(`won/customer backfilled on ${wonBackfilled} confirmed or completed enquiries.`);

    if (affectedBrands.size > 0) {
      // Loaded here, after the env is in place, so the app's own DB client picks it up.
      const { recomputeBrandRollups } = await import("../src/lib/brandRollup");
      for (const [brandId, tenantId] of affectedBrands) await recomputeBrandRollups(tenantId, brandId);
      console.log(`brand rollups recomputed for ${affectedBrands.size} brand(s).`);
    }

    console.log(`Done. ${statusChanged} enquiry status(es) remapped.`);
  } finally {
    await client.close();
  }
}

main()
  .then(() => process.exit(0)) // the app's DB client (used for rollups) would otherwise hold the process open
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
