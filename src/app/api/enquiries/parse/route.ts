import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { handleRoute, parseJson } from "@/lib/api/respond";
import { parseEnquiryText } from "@/lib/parseEnquiryText";

const parseRequestSchema = z.object({ text: z.string().min(1) });

/**
 * spec §5.1: draft only, never persisted. See parseEnquiryText.ts for why
 * this is heuristic rather than an LLM call in this build.
 *
 * Response shape is { fields, rawText, parseError } at the top level, per
 * Change Brief v1.1 §A — no `data` wrapper here, unlike the rest of the
 * API, because this isn't a persisted resource.
 */
export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await requireSession();
    const body = await parseJson(request);
    const { text } = parseRequestSchema.parse(body);
    return NextResponse.json(parseEnquiryText(text));
  });
}
