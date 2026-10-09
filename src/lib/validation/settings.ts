import { z } from "zod";

/**
 * The numbers behind the lead workflow — settings, not constants, so ops can
 * tune the cadence without a deploy. Client-safe: the Log update sheet uses
 * them to preview exactly what a save will do.
 */
export const workflowSettingsSchema = z.object({
  /**
   * Days after the first no-reply in a row that each chase falls due:
   * no-reply #1 schedules the chase at +cadenceDays[0], #2 at +cadenceDays[1]…
   */
  cadenceDays: z.array(z.number().int().min(1).max(60)).min(1).max(6),
  /** The no-reply that parks the lead as Ghosted (e.g. 3 = the third in a row). */
  parkAfter: z.number().int().min(1).max(10),
  /** How long after sending options to check whether they've picked one. */
  optionsFollowupHours: z.number().int().min(1).max(168),
  /** First reply should go out within this long of a lead coming in. */
  firstReplyHours: z.number().int().min(1).max(72),
});
export type WorkflowSettings = z.infer<typeof workflowSettingsSchema>;

export const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  cadenceDays: [1, 3, 7],
  parkAfter: 3,
  optionsFollowupHours: 24,
  firstReplyHours: 2,
};
