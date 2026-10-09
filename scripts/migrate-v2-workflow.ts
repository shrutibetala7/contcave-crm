/**
 * Lead workflow redesign (Phase A): stages, and one follow-up per open lead.
 *
 *   new_lead            -> new
 *   in_progress         -> options_sent if studios were offered, else talking
 *   on_hold             -> talking
 *   completed           -> done
 *   dormant             -> parked
 *   confirmed, lost, cancelled -> unchanged
 *
 * nextActionDate / nextActionReason become the enquiry's `followUp`. An open
 * enquiry without one gets one, so the "every open lead has a next step" rule
 * holds from the first page load:
 *   New          -> "Send the first reply", due 2h after it came in (so old ones show overdue)
 *   Confirmed    -> "Confirm timings", the day before the shoot
 *   Options sent -> "Check which studio they like", today
 *   Talking      -> "Set the next step", today
 *
 * Parked and Lost enquiries with no reason get one guessed from the text ops
 * typed in the old next-action / loss note ("Ghosted over text" -> Ghosted,
 * "Dont want to pay gst" -> GST); the text is kept in the loss note.
 *
 * Also adds noReplyCount / noReplyStartedAt / lastActivityAt / lastActivityId,
 * unsets the old next-action fields, and swaps the next-action indexes for
 * follow-up ones.
 *
 * Idempotent. DRY RUN by default — prints every change and writes nothing.
 * Run with: npx tsx scripts/migrate-v2-workflow.ts           (dry run)
 *           npx tsx scripts/migrate-v2-workflow.ts --apply   (write)
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { MongoClient, type Document } from "mongodb";

loadEnv({ path: existsSync(".env.local") ? ".env.local" : ".env", quiet: true });

const APPLY = process.argv.includes("--apply");
const DAY = 86_400_000;
const NEW_STAGES = new Set(["new", "talking", "options_sent", "confirmed", "done", "parked", "lost", "cancelled"]);
const OPEN = new Set(["new", "talking", "options_sent", "confirmed"]);

function stageFor(doc: Document): string {
  switch (doc.status) {
    case "new_lead":
      return "new";
    case "in_progress":
      return (doc.shortlist?.length ?? 0) > 0 ? "options_sent" : "talking";
    case "on_hold":
      return "talking";
    case "completed":
      return "done";
    case "dormant":
      return "parked";
    default:
      return doc.status;
  }
}

/** UTC midnight of the India calendar day of `d`, plus `days`. */
function dayAt(d: Date, days = 0): Date {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return new Date(Date.parse(`${key}T00:00:00.000Z`) + days * DAY);
}

function arrivedAt(doc: Document): Date {
  const created = new Date(doc.createdAt);
  if (!doc.enquiryDate) return created;
  const day = new Date(doc.enquiryDate);
  return created.getTime() - day.getTime() < DAY && created >= day ? created : day;
}

function guessLossReason(text: string | null | undefined): string | null {
  const t = (text ?? "").toLowerCase();
  if (!t) return null;
  if (/ghost|no repl|not repl|no response|didn.?t repl|not respond|seen|revert/.test(t)) return "no_response";
  if (/\bgst\b/.test(t)) return "gst";
  if (/price|expensive|costly|budget|rate/.test(t)) return "price";
  if (/cancel/.test(t)) return "project_cancelled";
  if (/no studio|not available in|other city/.test(t)) return "no_studio_in_city";
  if (/went with|booked (elsewhere|directly)|competitor|another studio/.test(t)) return "chose_competitor";
  return null;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) throw new Error("MONGODB_URI / MONGODB_DB are not set.");
  console.log(APPLY ? "APPLYING changes." : "DRY RUN — nothing will be written. Pass --apply to write.");

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const enquiries = db.collection("enquiries");
    const activities = db.collection("activities");
    const now = new Date();
    const today = dayAt(now);
    let changed = 0;

    for (const doc of await enquiries.find({}).sort({ code: 1 }).toArray()) {
      const set: Record<string, unknown> = {};
      const notes: string[] = [];
      const stage = NEW_STAGES.has(doc.status) ? doc.status : stageFor(doc);
      if (stage !== doc.status) {
        set.status = stage;
        notes.push(`${doc.status} -> ${stage}`);
      }

      if (!("followUp" in doc)) {
        let followUp: Record<string, unknown> | null = null;
        if (OPEN.has(stage)) {
          const base = { createdAt: now, createdBy: "migration" };
          if (doc.nextActionDate) {
            followUp = {
              ...base,
              kind: stage === "new" ? "first_reply" : stage === "confirmed" ? "confirm_timings" : "chase",
              label: doc.nextActionReason?.trim() || "Follow up",
              dueAt: dayAt(new Date(doc.nextActionDate)),
              allDay: true,
            };
          } else if (stage === "new") {
            followUp = { ...base, kind: "first_reply", label: "Send the first reply", dueAt: new Date(arrivedAt(doc).getTime() + 2 * 3_600_000), allDay: false };
          } else if (stage === "confirmed") {
            const first = [...(doc.brief?.preferredDates ?? [])].map((d: Date) => new Date(d)).sort((a, b) => a.getTime() - b.getTime())[0];
            const due = first ? dayAt(first, -1) : today;
            followUp = { ...base, kind: "confirm_timings", label: "Confirm timings with studio and client", dueAt: due < today ? today : due, allDay: true };
          } else if (stage === "options_sent") {
            followUp = { ...base, kind: "options_check", label: "Check which studio they like", dueAt: today, allDay: true };
          } else {
            followUp = { ...base, kind: "chase", label: "Set the next step — none was recorded", dueAt: today, allDay: true };
          }
          notes.push(`follow-up: "${followUp.label}" ${(followUp.dueAt as Date).toISOString().slice(0, 10)}`);
        }
        set.followUp = followUp;
      }

      if ((stage === "parked" || stage === "lost") && !doc.outcome?.lossReason) {
        const text = [doc.nextActionReason, doc.outcome?.lossNote].filter(Boolean).join(" · ");
        const guess = guessLossReason(text);
        if (guess) {
          set["outcome.lossReason"] = guess;
          notes.push(`loss reason: ${guess} (from "${text}")`);
        } else if (text) {
          notes.push(`loss reason: none matched "${text}" — left blank`);
        }
        if (text && !doc.outcome?.lossNote) set["outcome.lossNote"] = text;
      }
      if (stage === "parked" && doc.outcome?.result !== "dormant") set["outcome.result"] = "dormant";

      if (doc.noReplyCount == null) {
        set.noReplyCount = 0;
        set.noReplyStartedAt = null;
      }
      if (!("lastActivityAt" in doc)) {
        const last = await activities.findOne({ entityType: "enquiry", entityId: doc._id.toHexString() }, { sort: { occurredAt: -1 } });
        set.lastActivityAt = last?.occurredAt ?? doc.updatedAt;
        set.lastActivityId = null;
      }

      const unset = "nextActionDate" in doc || "nextActionReason" in doc ? { nextActionDate: "", nextActionReason: "" } : null;
      if (!Object.keys(set).length && !unset) continue;
      changed++;
      if (notes.length) console.log(`  ${doc.code}: ${notes.join("; ")}`);
      if (APPLY) await enquiries.updateOne({ _id: doc._id }, { $set: set, ...(unset ? { $unset: unset } : {}) });
    }

    if (APPLY) {
      for (const name of ["tenant_status_nextAction", "tenant_owner_nextAction"]) {
        await enquiries.dropIndex(name).catch(() => undefined); // absent on some databases
      }
      await enquiries.createIndexes([
        { key: { tenantId: 1, status: 1, "followUp.dueAt": 1 }, name: "tenant_status_followUp" },
        { key: { tenantId: 1, ownerId: 1, "followUp.dueAt": 1 }, name: "tenant_owner_followUp" },
      ]);
    }
    console.log(`${APPLY ? "Updated" : "Would update"} ${changed} enquiries.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
