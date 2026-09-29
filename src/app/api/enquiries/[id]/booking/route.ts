import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { enquiriesCol } from "@/lib/db/collections";
import { serialize } from "@/lib/db/serialize";
import { toObjectId } from "@/lib/db/objectId";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { bookStudioSchema } from "@/lib/validation/enquiry";
import { assertValidTransition } from "@/lib/stateMachine/enquiryStatus";
import { afterStatusChange } from "@/lib/statusSideEffects";
import { recomputeBrandRollups } from "@/lib/brandRollup";

type Params = { params: Promise<{ id: string }> };

/**
 * Book one of the shortlisted studios. What used to be five separate steps
 * (mark the studio picked, fill in the booking, set the shoot date, confirm)
 * is one write here: the chosen studio becomes the only "picked" one, the
 * booking and shoot date are recorded, and the enquiry moves to Confirmed
 * through the same state machine as any other status change.
 *
 * On an enquiry that's already Confirmed or Completed it just updates the
 * booking (a changed value, date or studio) without touching the status.
 * A shoot date already in the past is fine: the enquiry becomes Completed
 * on the next page load, which is how an old booking is back-filled.
 */
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await params;
    const input = bookStudioSchema.parse(await parseJson(request));

    const enquiries = await enquiriesCol();
    const _id = toObjectId(id);
    const enquiry = await enquiries.findOne({ _id, tenantId: session.tenantId });
    if (!enquiry) throw new NotFoundError("Enquiry");

    const chosen = enquiry.shortlist.find((s) => s.id === input.shortlistEntryId);
    if (!chosen) throw new BadRequestError("That studio isn't on this enquiry's shortlist any more.");

    const shortlist = enquiry.shortlist.map((s) =>
      s.id === chosen.id ? { ...s, outcome: "picked" as const } : s.outcome === "picked" ? { ...s, outcome: "pending" as const } : s
    );
    const platformBookingId = input.platformBookingId || null;
    const booking = {
      ...enquiry.booking,
      studioId: chosen.studioId,
      grossValue: input.grossValue,
      platformBookingId,
      offPlatform: !platformBookingId,
    };
    const preferredDates = [...input.shootDates].sort((a, b) => a.getTime() - b.getTime());

    const alreadyBooked = enquiry.status === "confirmed" || enquiry.status === "completed";
    const transition = alreadyBooked
      ? null
      : assertValidTransition(
          { ...enquiry, shortlist, booking, brief: { ...enquiry.brief, preferredDates } },
          "confirmed",
          { to: "confirmed" }
        );

    const result = await enquiries.findOneAndUpdate(
      { _id, tenantId: session.tenantId, status: enquiry.status },
      {
        $set: {
          shortlist,
          booking,
          "brief.preferredDates": preferredDates,
          "brief.datesFlexible": false,
          ...(transition?.set ?? {}),
          updatedAt: new Date(),
          updatedBy: session.sub,
        },
      },
      { returnDocument: "after" }
    );
    if (!result) throw new BadRequestError("This enquiry changed while you were booking it — reload and try again.");

    if (transition) {
      await afterStatusChange({
        tenantId: session.tenantId,
        enquiry: result,
        from: enquiry.status,
        to: "confirmed",
        note: `Booked ${chosen.studioName}`,
        userId: session.sub,
      });
    } else if (result.brandId) {
      await recomputeBrandRollups(session.tenantId, result.brandId); // the value may have changed
    }

    return NextResponse.json({ data: serialize(result) });
  });
}
