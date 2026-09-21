# ContCave CRM — Build Spec v1

## 1. What changed and why

| Brief said | Spec says | Reason |
|---|---|---|
| Lead pipeline ends at `Converted (Booked)` | Lifecycle continues through scheduled → delayed → completed → feedback | The operational pain is post-booking. Delays and feedback were requirements that fell out of the brief. |
| "Studio(s) proposed/matched" — single field | `shortlist[]` array with per-studio quote and outcome | Loss data per studio is the only source of supply-quality intelligence. |
| `Lead → Verified/Curated Tier Decision → Onboarded → Active` | Tier is a field, not a stage | Tier is an attribute set during onboarding, not a pipeline position. |
| RBAC UI from day one | `ownerId` enforced in API, shared login in UI | 5 users. Model supports roles; UI adds them in Phase 2. |
| Kanban for both pipelines in MVP | List + filter chips in MVP, kanban Phase 2 | Kanban is a week of work and degrades on mobile. |
| Instagram + WhatsApp in Phase 2 | Moved to Phase 3 | See §9 — both carry approval latency and, for WhatsApp, an operational cost worth deciding on separately. |
| Booking value stored in CRM | `platformBookingId` reference OR `offPlatform` flag | Two sources of truth for GMV will break grant/KPT reporting. |
| — | `POST /api/enquiries/parse` added | Paste-a-WhatsApp-chat → pre-filled record. Highest-leverage feature for adoption. |

---

## 2. Core principle

**Every open record must carry a next action with a date and an owner.** A record with no next action is either won, lost with a reason, or a bug. The default home screen is the union of everything due — not a table of all clients.

---

## 3. Data model (MongoDB)

Every document carries `tenantId` from day one. There is exactly one tenant now. Do not build multi-tenancy; do not omit the field.

All documents carry `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

### 3.1 `users`

```js
{
  _id, tenantId,
  name, email, phone,
  role: "admin" | "member",
  passwordHash,          // bcrypt
  active: Boolean
}
```

### 3.2 `brands`

Demand-side organisation. Solo creators may have no brand — in that case `contact.brandId` is null.

```js
{
  _id, tenantId,
  name,
  category,              // "d2c_fashion" | "beauty" | "food" | "agency" | "creator" | "other"
  city,
  instagramHandle, website,
  notes,
  totalEnquiries, totalWon, lifetimeValue   // denormalised rollups, recomputed on enquiry close
}
```

### 3.3 `contacts`

```js
{
  _id, tenantId,
  brandId,               // nullable
  name,
  phone,                 // E.164, e.g. "+919876543210" — normalise on write
  whatsappNumber,        // defaults to phone
  email, instagramHandle,
  role,                  // "founder" | "marketing" | "producer" | "agency_poc" | "other"
  isPrimary: Boolean
}
```

`phone` is the dedupe key. On create, look up by normalised phone before inserting.

### 3.4 `studios`

```js
{
  _id, tenantId,
  name,
  city, locality, address, geo: { lat, lng },
  categories: [String],  // "photo" | "video" | "podcast" | "event" | "cyclorama" | "daylight" | "chroma"
  stage,                 // see §4.2
  tier: "verified" | "curated" | null,
  tierNote,
  gstStatus: "registered" | "unregistered" | "unknown",
  gstin,
  commercialModel: "commission" | "saas" | "hybrid" | null,
  commissionPct, saasPlanAnnual,
  contacts: [{ name, phone, email, role, isPrimary }],
  instagramHandle, website,
  agreement: { status, signedAt, documentUrl },   // status: none|sent|signed|expired
  onboarding: {
    photosReceived, listingLive, pricingConfirmed,
    payoutDetailsOnFile, cashfreeSubAccountLinked, agreementSigned
  },                     // all Boolean
  platformStudioId,      // FK into main product DB — reference only, never duplicate listing data
  ownerId,
  nextActionDate, nextActionNote,
  lastContactedAt,
  tags: [String],
  notes
}
```

### 3.5 `enquiries` — the root demand object

```js
{
  _id, tenantId,
  code,                  // human-readable, e.g. "ENQ-2026-0142". Generate on insert.
  brandId, contactId,

  source,                // "instagram_dm" | "whatsapp" | "website" | "referral"
                         // | "phone" | "walk_in" | "repeat_client" | "other"
  sourceDetail,          // free text: referrer name, campaign, etc.

  brief: {
    rawText,             // verbatim, as the client stated it. Never overwrite this.
    shootType,           // "product" | "fashion" | "campaign" | "ugc" | "podcast" | "video" | "event" | "other"
    deliverables,
    city, preferredLocality,
    preferredDates: [Date],
    datesFlexible: Boolean,
    durationHours,
    crewSize,
    budgetMin, budgetMax,
    requirements: [String]    // "cyclorama", "makeup room", "parking", "natural light"
  },

  status,                // see §4.1

  shortlist: [{
    studioId, studioName,
    quotedAmount,
    sentAt,
    studioRespondedAt,   // for response-time analytics
    outcome,             // see §4.3
    outcomeNote
  }],

  outcome: {
    result,              // "won" | "lost" | "dormant" | null
    lossReason,          // see §4.4 — REQUIRED when result is "lost"
    lossNote,
    competitorName,
    closedAt
  },

  booking: {
    platformBookingId,   // set if booked through the platform
    offPlatform: Boolean,// true if closed manually — mutually exclusive with the above
    studioId,
    grossValue, commissionValue,
    currency: "INR"
  },

  schedule: {
    originalShootDate,
    currentShootDate,    // null = TBD
    endDate,
    delayEvents: [ /* see §3.6 */ ]
  },

  feedback: { /* see §3.7 */ },

  ownerId,
  nextActionDate, nextActionNote,
  lastContactedAt,
  firstResponseAt        // for response-time metric
}
```

### 3.6 Delay event (embedded in `schedule.delayEvents`)

A shoot can slip more than once. Model it as an append-only log, not a status flag.

```js
{
  _id,
  previousDate,
  newDate,               // null = not yet rescheduled
  estimatedWindow,       // free text when newDate is null: "mid-October", "after Diwali"
  reason,
  causedBy,              // "client" | "studio" | "contcave" | "external"
  reportedAt,
  followUpOn,            // REQUIRED when newDate is null
  resolved: Boolean,
  note
}
```

**Validation rule:** `newDate == null` → `followUpOn` is mandatory. This is the entire point of the model. No shoot enters limbo without a scheduled touch.

`causedBy` is the field to watch. If a meaningful share of delays are `studio`, that is a supply reliability problem, not a scheduling annoyance.

### 3.7 Feedback (embedded in `enquiries.feedback`)

```js
{
  client: {
    collectedAt, collectedBy,
    overallRating,       // 1–5
    studioRating,        // 1–5
    platformRating,      // 1–5
    wouldRebook: Boolean,
    verbatim,
    issues: [String],    // "cleanliness" | "equipment" | "access" | "pricing" | "staff" | "timing"
    publishedAsReview: Boolean,
    reviewUrl
  },
  studio: {
    collectedAt, collectedBy,
    clientRating,        // 1–5
    paymentOnTime: Boolean,
    damageReported: Boolean,
    verbatim
  }
}
```

### 3.8 `activities` — shared timeline

```js
{
  _id, tenantId,
  entityType,            // "enquiry" | "studio" | "brand"
  entityId,
  type,                  // "note" | "call" | "whatsapp" | "email" | "meeting"
                         // | "visit" | "status_change" | "system"
  direction,             // "in" | "out" | null
  body,
  occurredAt,
  createdBy,
  meta                   // for status_change: { from, to }
}
```

Status changes write an activity automatically. This is the audit log — no separate collection needed at this scale.

### 3.9 Indexes

```js
enquiries: { tenantId: 1, status: 1, nextActionDate: 1 }
enquiries: { tenantId: 1, ownerId: 1, nextActionDate: 1 }
enquiries: { tenantId: 1, "schedule.currentShootDate": 1 }
enquiries: { tenantId: 1, "schedule.delayEvents.followUpOn": 1 }
enquiries: { tenantId: 1, code: 1 }                       // unique
enquiries: text index on brief.rawText
contacts:  { tenantId: 1, phone: 1 }                      // unique
studios:   { tenantId: 1, stage: 1, city: 1 }
studios:   { tenantId: 1, nextActionDate: 1 }
activities:{ entityType: 1, entityId: 1, occurredAt: -1 }
```

---

## 4. State machines

Transitions are validated server-side in a single module. Do not let the client PATCH `status` directly — use `POST /api/enquiries/:id/status`.

### 4.1 Enquiry status

```
new → contacted → qualified → shortlist_sent → negotiating → confirmed
    → scheduled → completed → feedback_pending → closed_won
```

Branches:

- **`scheduled ⇄ delayed`** — entering `delayed` requires creating a delay event. Leaving `delayed` requires either a `newDate` (→ `scheduled`) or a cancellation (→ `lost`, `lossReason: "project_cancelled"`).
- **`→ lost`** — allowed from any status up to and including `confirmed`, and from `delayed`. Requires `outcome.lossReason`. Not allowed from `completed`.
- **`→ dormant`** — allowed from any non-terminal status. Reversible back to `contacted`. Requires `nextActionDate` (a revival date) — dormant is parked, not dead.
- Backward transitions are allowed one step, and write an activity with a reason.

Terminal: `closed_won`, `lost`.

**Guards:**
- `→ confirmed` requires exactly one shortlist entry with `outcome: "picked"`.
- `→ confirmed` requires either `booking.platformBookingId` or `booking.offPlatform === true`.
- `→ scheduled` requires `schedule.currentShootDate`.
- `→ completed` requires `schedule.currentShootDate` to be in the past.
- `→ closed_won` requires `feedback.client.collectedAt` **or** an explicit `feedbackWaived: true` with a note.

That last guard is deliberate friction. It is why feedback will actually get collected.

### 4.2 Studio stage

```
lead → contacted → negotiating → agreement_sent → onboarding → active
```

Exits, allowed from any stage: `not_interested`, `paused`, `churned`.

**Guard:** `→ active` requires all six `onboarding` flags true and `tier` set.

### 4.3 Shortlist outcome enum

```
pending | picked | rejected_price | rejected_availability
| rejected_location | rejected_look | studio_declined | studio_no_response
```

Only one entry per enquiry may be `picked`.

### 4.4 Loss reason enum

```
price | availability | studio_declined | went_direct | chose_competitor
| project_cancelled | no_response | budget_too_low | out_of_scope | other
```

Mandatory enum, free-text note alongside. Free text alone will rot into uselessness within forty records.

`went_direct` is the one to watch — it is the disintermediation metric.

---

## 5. API surface

REST, Next.js route handlers. All routes scoped by `tenantId` from session.

**Enquiries**
```
GET    /api/enquiries              ?status=&ownerId=&city=&source=&q=&from=&to=&page=&limit=
POST   /api/enquiries
GET    /api/enquiries/:id
PATCH  /api/enquiries/:id          // everything except status
POST   /api/enquiries/:id/status   { to, note, ...guardPayload }
POST   /api/enquiries/parse        { text } → parsed draft, NOT persisted
```

**Shortlist**
```
POST   /api/enquiries/:id/shortlist            { studioId, quotedAmount }
PATCH  /api/enquiries/:id/shortlist/:entryId   { outcome, outcomeNote, studioRespondedAt }
DELETE /api/enquiries/:id/shortlist/:entryId
```

**Delays**
```
POST   /api/enquiries/:id/delays               { previousDate, newDate|null, estimatedWindow,
                                                 reason, causedBy, followUpOn }
PATCH  /api/enquiries/:id/delays/:delayId      { newDate, resolved, note }
```

**Feedback**
```
POST   /api/enquiries/:id/feedback             { side: "client"|"studio", ...payload }
```

**Studios / Brands / Contacts** — standard CRUD, plus:
```
POST   /api/studios/:id/stage      { to, note }
```

**Dashboard**
```
GET    /api/dashboard/today        → { overdue[], today[], thisWeek[], newUnactioned[], counts{} }
```

Unions three sources: `enquiries.nextActionDate`, `studios.nextActionDate`, and unresolved `delayEvents.followUpOn`. One query per source, merged and sorted server-side.

**Activities**
```
GET    /api/activities             ?entityType=&entityId=
POST   /api/activities
```

**Search**
```
GET    /api/search                 ?q=   → across brands, contacts, studios, enquiry.code, brief.rawText
```

### 5.1 Paste-parse endpoint

`POST /api/enquiries/parse` takes raw pasted WhatsApp or Instagram text and returns a **draft object only** — never writes to the DB. The operator reviews and corrects before saving.

Call the Anthropic API with a system prompt instructing JSON-only output matching the `brief` sub-schema plus `contact.name`, `contact.phone`, `brand.name`. Strip markdown fences before parsing. On parse failure, return the raw text in `brief.rawText` and empty fields — degrade to manual entry, never block the save.

This is the feature that determines whether the tool gets used. Build it in Phase 1.

---

## 6. Screens — Phase 1

1. **Today** (default route) — Overdue / Today / This week / New unactioned. Each row: what it is, who it's for, one-tap WhatsApp link, snooze, open. Nothing else on this screen.
2. **Enquiries** — list with status filter chips, owner filter, search. Row click opens detail.
3. **Enquiry detail** — brief (raw text always visible), shortlist table with inline outcome dropdowns, status control with guard-aware transitions, delay log, feedback panel, activity timeline.
4. **Studios** — list with stage/city/tier filters; detail with onboarding checklist and timeline.
5. **Quick add** — one modal: paste box → parse → review → save. Reachable by keyboard shortcut from anywhere.
6. **Login** — single shared credential, bcrypt + jose JWT (same pattern as the existing admin panel).

**Every contact and studio row renders `https://wa.me/<E164 without +>`.** One tap from the record to the conversation. This is what stops the tool from becoming a second system that competes with WhatsApp.

**Not in Phase 1:** kanban, role UI, charts, exports, email, notifications.

---

## 7. Answers to the open questions

**Serverless vs. dedicated Node.** Vercel serverless is fine. At 5 users and low-thousands of documents you will never approach connection limits, provided you cache the Mongo client on the global object across warm invocations:

```js
// lib/mongodb.js
import { MongoClient } from "mongodb";
let cached = global._mongo;
if (!cached) cached = global._mongo = { conn: null, promise: null };

export async function getDb() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 10 })
      .connect()
      .then((client) => client.db(process.env.MONGODB_DB));
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
```

Skipping this is the single most common way this stack falls over. Do not skip it.

**File storage.** Vercel Blob. Studio listing photography lives in the main product; the CRM only holds signed agreements, occasional screenshots, and payout documents. Cloudinary buys image transforms you do not need here and adds a second vendor.

**WhatsApp Business API provider.** Deferred — see §9. Do not select a provider until the number question below is settled.

---

## 8. Metrics to instrument in Phase 1

Three numbers, visible on the Today screen footer:

1. **Outcome coverage** — % of enquiries older than 14 days that have a logged `outcome.result`. Target 100%. If this drops below 80%, the tool is being abandoned.
2. **Median time to first response** — `firstResponseAt − createdAt`.
3. **Revived enquiries** — count of enquiries that moved `dormant → contacted → closed_won`. This is the number that justifies the build.

Secondary, once there is data: loss reason distribution, `causedBy` distribution on delays, and studio response time from the shortlist array.

---

## 9. Phasing

**Phase 1 — MVP (target: 1 week, not 4)**
Both pipelines, CRUD, list views, Today screen, paste-parse, shared auth, delay log, feedback capture, WhatsApp deep links.

**Phase 2 — after 30 days of real usage**
Kanban view (only if the stages have proved stable), role UI, saved filters, CSV export, analytics on loss reasons and delay causes.

**Phase 3 — integrations**

*WhatsApp Business Platform.* Before scoping this, settle one question: a number registered on the WhatsApp Business Platform can no longer be used in the consumer WhatsApp or WhatsApp Business apps. If the ops team currently runs client comms from a phone, migrating that number changes how they work every day. The usual answer is to migrate a *new* number and keep the existing one manual — decide this before anyone compares providers. Also note that business-initiated messages outside the 24-hour service window require pre-approved templates, so reschedule follow-ups are template messages, not free text. Verify current per-message rates against Meta's live rate card; the pricing model has changed more than once.

*Instagram Messaging API.* Requires an Instagram professional account, app review for `instagram_manage_messages`, and a 24-hour messaging window (extendable to 7 days with the human-agent tag). Webhooks deliver only messages received after subscription — there is no historical backfill, so existing DM history stays in the app. Budget for review latency, not just build time.

*Cashfree and GST invoicing sync.* Read-only pull of settlement status onto the enquiry record. Invoicing itself stays in the main platform.

---

## 10. Backfill

Budget one person-day before launch to reconstruct the last three months of WhatsApp threads into enquiry records — including the ones already lost, with loss reasons. A CRM that opens empty feels like homework and gets abandoned in week two. One that opens with your real history feels like a system of record from day one.

Start with the 6–7 delayed shoots. They are the highest-value records and they are the reason this is being built.
