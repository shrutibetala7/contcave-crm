# ContCave CRM

Phase 1 MVP of the internal ops CRM described in [SPEC.md](./SPEC.md) — two pipelines
(enquiries, studios), the Today screen, paste-parse quick add, delay log, feedback capture,
and WhatsApp deep links — plus the Change Brief v1.1 additions: evidence tiers on parsed
data, required reasons on every follow-up, and list state in the URL.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS, MongoDB (native driver), `zod` for
validation/types, `jose` for session JWTs, `bcryptjs` for password hashing, `date-fns` for
Today-screen date bucketing, `nuqs` for URL-based list/filter state (Change Brief v1.1 §C).
No Docker, no LLM/Anthropic API — see "What's stubbed" below.

## Setup

1. **Install dependencies** (already done if you're reading this right after the scaffold):
   ```bash
   npm install
   ```
2. **Environment** — copy the example and fill in real values:
   ```bash
   cp .env.example .env.local
   ```
   - `MONGODB_URI` / `MONGODB_DB` — a real MongoDB connection (Atlas or self-hosted). The
     app will throw on first DB call until these are real.
   - `JWT_SECRET` — any long random string (`openssl rand -base64 32`).
   - `SEED_DEFAULT_PASSWORD` — password assigned to every seeded user account (change it).
3. **Seed the database** (creates indexes, 5 team-member accounts, and one demo enquiry so
   the app doesn't open empty):
   ```bash
   npm run seed
   ```
   Prints the seeded accounts and the shared default password. Sign in with any of them:
   `admin@contcave.com`, `ops1@contcave.com` … `ops4@contcave.com`.
4. **Upgrading an existing (pre-v1.1) database?** Run the field-rename migration once —
   safe to skip on a fresh `npm run seed`, which already writes the new field names:
   ```bash
   npm run migrate:v1.1
   ```
   Idempotent (`nextActionNote` → `nextActionReason` on `enquiries` and `studios`; see
   [Migration checklist](#migration-checklist) below for ordering).
5. **Run it**:
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000` — it redirects to `/today`.

## What to click through

Quick add (press **C** anywhere, or the button in the nav) → paste a WhatsApp-style message
→ review the extracted fields (amber = guessed, click "confirm" or just edit the value) →
save → land on the new enquiry's detail page → shortlist a studio → set an outcome → walk
it through the status control → log a delay (with a follow-up reason) → collect feedback.
Every contact/studio row has a WhatsApp link (`wa.me/...`). Filter the Enquiries/Studios
lists or the Today screen's owner/range toggles, then hit "Copy view" — paste the URL in a
new tab and the exact filtered view comes back.

## Change Brief v1.1

Three additive changes on top of the Phase 1 MVP:

- **§A Evidence tiers** — `/api/enquiries/parse` now returns `{ fields, rawText, parseError }`
  instead of a flat draft: every field is `"observed"` (lifted from a literal substring of
  the pasted text — `sourceSpan` is that substring, re-verified server-side) or `"inferred"`
  (a judgment call — shoot type, "dates flexible" — even when a keyword triggered it,
  because the stored value isn't a literal quote). Quick Add blocks saving until every
  inferred field is confirmed or edited; the enquiry detail page shows the same amber
  marker for any field still unconfirmed, with a one-click confirm
  (`POST /api/enquiries/:id/confirm-field`). See
  [`src/lib/parseEnquiryText.ts`](./src/lib/parseEnquiryText.ts).
- **§B Required reasons** — `nextActionDate` (enquiries) and `followUpOn` (delay
  events) now require a `nextActionReason` / `followUpReason` of at least 8 characters in
  the same write — enforced by Zod refinements, not just UI copy. The Today screen leads
  with the reason; a record from before this change (or one where the API was called
  directly) shows an amber "no reason recorded" instead of silently rendering blank.
- **§C List state in the URL** — Enquiries/Studios filters and the Today screen's
  owner/range toggles live in query params via `nuqs` (`?status=delayed&owner=<id>&sort=-nextActionDate`),
  not component state. Filtered views survive a refresh, are bookmarkable, and step through
  with the browser back button; "Copy view" copies the current URL.

## Studios are deliberately simple

A studio is in one of four states — **Not contacted, In progress, Verified, Curated** —
set with one click on its page (Verified and Curated both mean onboarded). There are no
transition rules, tiers or next-action dates on studios; each change is logged on the
studio's timeline. The onboarding checklist is a plain to-do list. Upgrading an existing
database: `npm run migrate:studio-stages` (idempotent) maps the old nine stages onto the four.

An enquiry that was scheduled can be marked **lost** directly (a client cancelling a booked
shoot); once it is *completed* it can't be.

## What's stubbed vs. working

- **Paste-parse (`/api/enquiries/parse`)** is heuristic (regex/keyword extraction), **not**
  an LLM call — confirmed with the user, no Anthropic API in this build. See
  [`src/lib/parseEnquiryText.ts`](./src/lib/parseEnquiryText.ts) for what it can and can't
  pull out, and its doc comment for how to swap in a real model call later.
- **Everything else is fully wired** against MongoDB — state machines, guards, indexes,
  the Today aggregation, the §8 metrics — but untested end-to-end in this environment since
  there's no reachable Mongo instance here. `npx tsc --noEmit` and `npm run build` are both
  clean; real verification needs your own `MONGODB_URI`.
- **File storage** (signed agreements, screenshots — spec §7 says Vercel Blob) isn't wired
  up; `studios.agreement.documentUrl` is a plain string field, set manually for now.
- **Instagram/WhatsApp Business API, Cashfree/GST sync** — Phase 3 per spec §9, not started.

## Migration checklist

Only relevant if you have real (pre-v1.1) data already in Mongo — a fresh `npm run seed`
writes the new field names directly and needs none of this:

1. Deploy this code first. It's schema-tolerant: an absent `brief.fieldEvidence` reads as
   "stated" (no amber markers on old records) and an absent `nextActionReason` reads as
   null (renders as "no reason recorded", not an error) — both true by construction,
   nothing to toggle.
2. Run `npm run migrate:v1.1` against the real database. Idempotent — safe to re-run,
   safe to run multiple times if you're unsure whether it already ran.
3. From that point on, the now-live Zod validation rejects any write that sets
   `nextActionDate`/`followUpOn` without a reason. This is one deploy, not a staged
   rollout — there's no separate flag — so do step 2 promptly after step 1 rather than
   leaving old-shaped writes to accumulate.

## Known follow-ups

- `middleware.ts` uses Next's (deprecated-but-functional) middleware convention; Next 16
  suggests migrating to `proxy.ts` (`npx @next/codemod@canary middleware-to-proxy`) — left
  as-is since it still works and the codemod is canary.
- No dedicated Brand/Contact list screens (matches spec §6's 6-screen Phase 1 list) — both
  are reachable only inline from an Enquiry/Studio's detail view. Full CRUD APIs exist for
  both if a screen is wanted later.
- `/api/search` (spec §5) is implemented but not wired into a nav search box yet — the
  Enquiries/Studios list filters cover search for Phase 1.
- Evidence-tier confirmation UI covers the structured brief fields shown in Quick
  Add/BriefPanel (shoot type, city, deliverables, budget, dates-flexible, requirements) —
  `contact.name`/`contact.phone`/`brand.name` provenance is recorded in
  `brief.fieldEvidence` too but has no dedicated confirm affordance outside Quick Add
  itself, since those values live on separate contact/brand documents.

## Project structure

See the plan this was built from for the full file layout and the state-machine/guard
design — `src/lib/stateMachine/{enquiryStatus,studioStage}.ts` are the two modules that
own every transition rule in spec §4; nothing else branches on `status`/`stage` directly.
# contcave-crm
