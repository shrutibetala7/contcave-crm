# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: ContCave's ops team, about five people, who run client and studio relationships from WhatsApp and Instagram DMs. They work mostly on desktop, with WhatsApp Web open beside the CRM, triaging what is due, moving enquiries forward, and chasing follow-ups. Desktop is the primary surface; mobile web must still work but is secondary.

Later audience (confirmed as a stated direction, not yet a plan): studios that would use a studio-facing version of this CRM as a sold product.

## Product Purpose

An ops CRM for ContCave, India's studio booking marketplace for photography, film and event spaces. It tracks two pipelines: demand (enquiries from brands and creators, through shortlist, booking, shoot, delay handling and feedback) and supply (studios, from lead to onboarded and active).

Its core principle is that every open record carries a next action with a date, a reason and an owner. Success means enquiries stop getting lost in WhatsApp threads, every closed enquiry has a recorded outcome and loss reason, and delayed shoots never go into limbo without a scheduled follow-up.

## Positioning

A CRM shaped to studio-booking operations rather than generic B2B sales: an enquiry carries a per-studio shortlist with quotes and loss outcomes, a post-booking lifecycle (scheduled, delayed, completed, feedback), and a separate supply-side onboarding pipeline. Work starts from the Today screen (what is due, why, and for whom), not from a table of all clients. It complements WhatsApp instead of competing with it: every contact and studio row is one tap from the conversation.

## Operating Context

- Inbound demand arrives on Instagram DM and WhatsApp; the team pastes chat text into Quick Add, which extracts fields and marks each as observed or inferred before saving.
- Follow-ups are date-driven and each carries a written reason; the Today screen leads with the reason.
- Studios are onboarded against a document checklist (legal document, pictures/videos, pricing, packages/amenities, Aadhar, bank account details, GST optional).
- Bookings are referenced from the main ContCave platform (`platformBookingId`) or flagged off-platform; the CRM does not hold a second source of truth for booking value.
- Single tenant today. Every document carries `tenantId`, deliberately, so a later multi-tenant version is a data backfill rather than a schema change.

## Capabilities and Constraints

- Web app (Next.js App Router, TypeScript, Tailwind, MongoDB); login is bcrypt plus JWT session.
- Explicitly deferred: kanban views, role-based access UI, WhatsApp Business API and Instagram Messaging API integration, analytics dashboards, background agents or automated enrichment.
- No LLM in the paste-parse path; it is heuristic by decision.
- Terminology to preserve: enquiry, shortlist, Today, next action / reason, evidence (observed, inferred, stated), delay event, onboarding checklist.
- Undecided: what a studio-facing (sold) version would change in product scope, packaging or tenancy.

## Brand Commitments

The CRM carries the ContCave brand and should read as part of the ContCave product family (contcave.com, the sibling contcave-admin panel). The specifics of that commitment (logo usage, colors, voice) have not been supplied for this project; treat them as open until the user provides or points to them.

## Evidence on Hand

- `SPEC.md` (build spec v1) and the v1.1 change brief content recorded in `README.md`.
- Demo seed data only (`scripts/seed.ts`): one brand, contact, studio and enquiry. No real client data, testimonials or metrics; do not fabricate any.
- No logo or brand assets in this repo (`public/` is empty). Brand assets exist in the sibling `../contcave/public` (icons, images) and were not reviewed as binding.

## Product Principles

1. Every open record earns its place on Today: a date, a reason and an owner, or it is closed with an outcome.
2. Never let a guess pass as a fact: record where each value came from, and make the operator confirm the uncertain ones.
3. Stay one tap from the conversation; the CRM supports WhatsApp work and must not become a competing system.
4. Guard the real operational risks (lost enquiries, undocumented losses, shoots in limbo) with friction where it counts, not with ceremony everywhere.
5. Keep a door open to becoming a studio-facing product without letting it complicate today's five-person workflow.
