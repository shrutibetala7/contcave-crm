/**
 * One-time / re-runnable local setup:
 *   1. Creates the indexes from SPEC.md §3.9.
 *   2. Seeds the 5 team-member `users` accounts (idempotent, upsert by email).
 *   3. Seeds a small demo record set (one brand/contact/studio/enquiry) so
 *      the app doesn't open empty — only if `enquiries` is still empty.
 *
 * Run with: npm run seed   (requires a real MONGODB_URI in .env.local)
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { MongoClient, ObjectId } from "mongodb";

// Next.js reads .env.local by convention; plain "dotenv/config" only reads
// .env, so a standalone script needs this spelled out explicitly.
loadEnv({ path: existsSync(".env.local") ? ".env.local" : ".env" });
import bcrypt from "bcryptjs";

const TENANT_ID = "contcave";

const TEAM = [
  { name: "Admin", email: "admin@contcave.com", role: "admin" as const },
  { name: "Ops 1", email: "ops1@contcave.com", role: "member" as const },
  { name: "Ops 2", email: "ops2@contcave.com", role: "member" as const },
  { name: "Ops 3", email: "ops3@contcave.com", role: "member" as const },
  { name: "Ops 4", email: "ops4@contcave.com", role: "member" as const },
];

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
    await ensureIndexes(db);
    const userIds = await seedUsers(db);
    await seedDemoData(db, userIds);
    console.log("\nSeed complete.");
  } finally {
    await client.close();
  }
}

async function ensureIndexes(db: import("mongodb").Db) {
  console.log("Ensuring indexes…");
  await db.collection("enquiries").createIndexes([
    { key: { tenantId: 1, status: 1, nextActionDate: 1 }, name: "tenant_status_nextAction" },
    { key: { tenantId: 1, ownerId: 1, nextActionDate: 1 }, name: "tenant_owner_nextAction" },
    { key: { tenantId: 1, "schedule.currentShootDate": 1 }, name: "tenant_shootDate" },
    {
      key: { tenantId: 1, "schedule.delayEvents.followUpOn": 1 },
      name: "tenant_delayFollowUp",
    },
    { key: { tenantId: 1, code: 1 }, name: "tenant_code_unique", unique: true },
    { key: { "brief.rawText": "text" }, name: "brief_rawText_text" },
  ]);
  await db
    .collection("contacts")
    .createIndexes([{ key: { tenantId: 1, phone: 1 }, name: "tenant_phone_unique", unique: true }]);
  await db.collection("studios").createIndexes([
    { key: { tenantId: 1, stage: 1, city: 1 }, name: "tenant_stage_city" },
  ]);
  await db
    .collection("activities")
    .createIndexes([
      { key: { entityType: 1, entityId: 1, occurredAt: -1 }, name: "entity_occurredAt" },
    ]);
  await db.collection("users").createIndexes([{ key: { email: 1 }, name: "email_unique", unique: true }]);
}

async function seedUsers(db: import("mongodb").Db): Promise<Record<string, ObjectId>> {
  console.log("Seeding users…");
  const password = process.env.SEED_DEFAULT_PASSWORD || "changeme123";
  const passwordHash = await bcrypt.hash(password, 10);
  const users = db.collection("users");
  const ids: Record<string, ObjectId> = {};

  for (const member of TEAM) {
    const now = new Date();
    const result = await users.findOneAndUpdate(
      { email: member.email },
      {
        $setOnInsert: {
          tenantId: TENANT_ID,
          name: member.name,
          email: member.email,
          phone: null,
          role: member.role,
          passwordHash,
          active: true,
          createdAt: now,
          updatedAt: now,
          createdBy: "seed",
          updatedBy: "seed",
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    if (result?._id) ids[member.email] = result._id;
  }

  console.log(`  ${TEAM.length} users ready. Default password: "${password}"`);
  return ids;
}

async function seedDemoData(db: import("mongodb").Db, userIds: Record<string, ObjectId>) {
  const enquiries = db.collection("enquiries");
  const existing = await enquiries.countDocuments();
  if (existing > 0) {
    console.log("Demo data skipped (enquiries already has documents).");
    return;
  }

  console.log("Seeding demo brand/contact/studio/enquiry…");
  const ownerId = (userIds["admin@contcave.com"] ?? new ObjectId()).toHexString();
  const now = new Date();

  const brandResult = await db.collection("brands").insertOne({
    tenantId: TENANT_ID,
    name: "Studio Loop",
    category: "d2c_fashion",
    city: "Mumbai",
    instagramHandle: "@studioloop",
    website: null,
    notes: null,
    totalEnquiries: 0,
    totalWon: 0,
    lifetimeValue: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: "seed",
    updatedBy: "seed",
  });

  const contactResult = await db.collection("contacts").insertOne({
    tenantId: TENANT_ID,
    brandId: brandResult.insertedId.toHexString(),
    name: "Priya Menon",
    phone: "+919876500001",
    whatsappNumber: "+919876500001",
    email: "priya@studioloop.in",
    instagramHandle: "@priya.menon",
    role: "founder",
    isPrimary: true,
    createdAt: now,
    updatedAt: now,
    createdBy: "seed",
    updatedBy: "seed",
  });

  const studioResult = await db.collection("studios").insertOne({
    tenantId: TENANT_ID,
    name: "Frame & Light Studio",
    city: "Mumbai",
    locality: "Lower Parel",
    address: null,
    geo: null,
    categories: ["photo", "cyclorama"],
    stage: "verified",
    gstStatus: "registered",
    gstin: null,
    commercialModel: "commission",
    commissionPct: 15,
    saasPlanAnnual: null,
    contacts: [{ name: "Rahul Studios", phone: "+919876500002", email: null, role: "producer", isPrimary: true }],
    instagramHandle: "@framelight",
    website: null,
    agreement: { status: "signed", signedAt: now, documentUrl: null },
    onboarding: {
      legalDocument: true,
      picturesVideos: true,
      pricing: true,
      packagesAmenities: true,
      aadhar: true,
      bankAccountDetails: true,
      gst: false,
    },
    platformStudioId: null,
    ownerId,
    lastContactedAt: now,
    tags: [],
    notes: null,
    createdAt: now,
    updatedAt: now,
    createdBy: "seed",
    updatedBy: "seed",
  });

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Keep the ENQ-<year>-#### counter (src/lib/codes.ts) in sync so the next
  // enquiry created through the app doesn't collide with this seeded code.
  const counterId = `ENQ-${now.getFullYear()}`;
  await db
    .collection<{ _id: string; seq: number }>("counters")
    .updateOne({ _id: counterId }, { $inc: { seq: 1 } }, { upsert: true });
  const code = `ENQ-${now.getFullYear()}-0001`;

  await enquiries.insertOne({
    tenantId: TENANT_ID,
    code,
    brandId: brandResult.insertedId.toHexString(),
    contactId: contactResult.insertedId.toHexString(),
    source: "whatsapp",
    sourceDetail: null,
    brief: {
      rawText:
        "Hi, this is Priya from Studio Loop. We need a product shoot for our new SS26 catalogue, " +
        "around 40 SKUs, need a cyclorama and natural light. Budget ~60-80k. Looking at next week.",
      shootType: "product",
      deliverables: "40 SKU product photos",
      city: "Mumbai",
      preferredLocality: "Lower Parel",
      preferredDates: [tomorrow],
      datesFlexible: true,
      durationHours: 6,
      crewSize: 3,
      budgetMin: 60000,
      budgetMax: 80000,
      requirements: ["cyclorama", "natural light"],
    },
    status: "shortlist_sent",
    shortlist: [
      {
        id: new ObjectId().toHexString(),
        studioId: studioResult.insertedId.toHexString(),
        studioName: "Frame & Light Studio",
        quotedAmount: 70000,
        sentAt: now,
        studioRespondedAt: null,
        outcome: "pending",
        outcomeNote: null,
      },
    ],
    outcome: { result: null, lossReason: null, lossNote: null, competitorName: null, closedAt: null },
    booking: { platformBookingId: null, offPlatform: false, studioId: null, grossValue: null, commissionValue: null, currency: "INR" },
    schedule: { originalShootDate: null, currentShootDate: null, endDate: null, delayEvents: [] },
    feedback: {},
    ownerId,
    nextActionDate: tomorrow,
    nextActionReason: "Follow up on studio quote — check if they've confirmed the shoot date",
    lastContactedAt: now,
    firstResponseAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: "seed",
    updatedBy: "seed",
  });

  console.log("  Demo data seeded.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
